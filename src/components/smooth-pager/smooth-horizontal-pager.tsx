import {
  forwardRef,
  memo,
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  NativeSyntheticEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import {
  type HandlerStateChangeEvent,
  PanGestureHandler,
  type PanGestureHandlerEventPayload,
  type PanGestureHandlerProps,
  State,
} from "react-native-gesture-handler";
import {
  applyHorizontalRubberBand,
  clampPagerIndex,
  clampSpringVelocity,
  getVisiblePagerIndices,
  getWindowShiftThreshold,
  isScrollOffsetSettledAtPage,
  resolveSwipeTargetPage,
  scrollXToPageScrollEvent,
  shouldShiftPagerWindow,
} from "./smooth-horizontal-pager.utils";

export type SmoothPagerScrollState = "idle" | "dragging" | "settling";

export type SmoothHorizontalPagerHandle = {
  setPage: (page: number) => void;
  setPageWithoutAnimation: (page: number) => void;
};

export type SmoothHorizontalPagerProps = {
  pageCount: number;
  initialPage: number;
  pageWidth: number;
  renderPage: (pageIndex: number) => ReactNode;
  windowRadius?: number;
  extraOffsets?: readonly number[];
  scrollEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
  onPageSelected?: (event: { nativeEvent: { position: number } }) => void;
  onPageScroll?: (event: {
    nativeEvent: { position: number; offset: number };
  }) => void;
  onPageScrollStateChanged?: (event: {
    nativeEvent: { pageScrollState: SmoothPagerScrollState };
  }) => void;
};

const RUBBER_BAND_FACTOR = 0.25;
const PAN_ACTIVE_OFFSET_X: [number, number] = [-10, 10];
const PAN_FAIL_OFFSET_Y: [number, number] = [-20, 20];
const WINDOW_SHIFT_SETTLE_DELAY_MS = 260;

const SPRING_CONFIG = {
  stiffness: 320,
  damping: 32,
  mass: 0.85,
  overshootClamping: true,
  restDisplacementThreshold: 0.35,
  restSpeedThreshold: 2.5,
  useNativeDriver: true,
} as const;

const SmoothHorizontalPagerInner = forwardRef<
  SmoothHorizontalPagerHandle,
  SmoothHorizontalPagerProps
>(
  (
    {
      pageCount,
      initialPage,
      pageWidth,
      renderPage,
      windowRadius = 2,
      extraOffsets,
      scrollEnabled = true,
      style,
      onPageSelected,
      onPageScroll,
      onPageScrollStateChanged,
    },
    ref,
  ) => {
    const safeInitial = clampPagerIndex(initialPage, pageCount);
    const initialBaseTx = pageWidth > 0 ? -safeInitial * pageWidth : 0;
    const [windowCenter, setWindowCenter] = useState(safeInitial);
    const [retainedPages, setRetainedPages] = useState<number[]>([]);

    const baseTx = useRef(new Animated.Value(initialBaseTx)).current;
    const dragX = useRef(new Animated.Value(0)).current;

    const pageCountRef = useRef(pageCount);
    pageCountRef.current = pageCount;
    const pageWidthRef = useRef(pageWidth);
    pageWidthRef.current = pageWidth;
    const windowRadiusRef = useRef(windowRadius);
    windowRadiusRef.current = windowRadius;

    const onPageSelectedRef = useRef(onPageSelected);
    onPageSelectedRef.current = onPageSelected;
    const onPageScrollRef = useRef(onPageScroll);
    onPageScrollRef.current = onPageScroll;
    const onPageScrollStateChangedRef = useRef(onPageScrollStateChanged);
    onPageScrollStateChangedRef.current = onPageScrollStateChanged;

    const currentPageRef = useRef(safeInitial);
    const windowCenterRef = useRef(safeInitial);
    const baseTxRef = useRef(initialBaseTx);
    const lastScrollXRef = useRef(-initialBaseTx);
    const scrollStateRef = useRef<SmoothPagerScrollState>("idle");
    const prevPageWidthRef = useRef(pageWidth);

    const gestureActiveRef = useRef(false);
    const emittedScrollInGestureRef = useRef(false);
    const interruptedSpringRef = useRef(false);
    const pendingStopReadRef = useRef(false);
    const dragStartBaseTxRef = useRef(initialBaseTx);
    const dragStartPageRef = useRef(safeInitial);
    const activeSpringRef = useRef<Animated.CompositeAnimation | null>(null);
    const springEpochRef = useRef(0);
    const deferredReleaseRef = useRef<((resolvedBaseTx: number) => void) | null>(
      null,
    );

    const jumpEpochRef = useRef(0);
    const jumpRaf1Ref = useRef<number | null>(null);
    const jumpRaf2Ref = useRef<number | null>(null);
    const windowShiftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );
    const retainedClearRafRef = useRef<number | null>(null);

    const cancelJumpTimers = useCallback(() => {
      jumpEpochRef.current += 1;
      if (jumpRaf1Ref.current !== null) {
        cancelAnimationFrame(jumpRaf1Ref.current);
        jumpRaf1Ref.current = null;
      }
      if (jumpRaf2Ref.current !== null) {
        cancelAnimationFrame(jumpRaf2Ref.current);
        jumpRaf2Ref.current = null;
      }
      if (windowShiftTimerRef.current !== null) {
        clearTimeout(windowShiftTimerRef.current);
        windowShiftTimerRef.current = null;
      }
      if (retainedClearRafRef.current !== null) {
        cancelAnimationFrame(retainedClearRafRef.current);
        retainedClearRafRef.current = null;
      }
    }, []);

    const emitScrollState = useCallback((next: SmoothPagerScrollState) => {
      if (scrollStateRef.current === next) return;
      scrollStateRef.current = next;
      onPageScrollStateChangedRef.current?.({
        nativeEvent: { pageScrollState: next },
      });
    }, []);

    const emitPageScroll = useCallback((scrollX: number) => {
      const ev = scrollXToPageScrollEvent(
        scrollX,
        pageWidthRef.current,
        pageCountRef.current,
      );
      onPageScrollRef.current?.({ nativeEvent: ev });
    }, []);

    const syncWindowCenterIfNeeded = useCallback(
      (nextCenter: number, force = false) => {
        const clamped = clampPagerIndex(nextCenter, pageCountRef.current);
        const radius = windowRadiusRef.current;
        const threshold = force ? 1 : getWindowShiftThreshold(radius);
        if (
          windowCenterRef.current !== clamped &&
          Math.abs(clamped - windowCenterRef.current) >= threshold
        ) {
          windowCenterRef.current = clamped;
          setWindowCenter(clamped);
        }
      },
      [],
    );

    const scheduleWindowShift = useCallback(
      (targetCenter: number, force = false) => {
        if (windowShiftTimerRef.current !== null) {
          clearTimeout(windowShiftTimerRef.current);
        }
        windowShiftTimerRef.current = setTimeout(() => {
          windowShiftTimerRef.current = null;
          if (!gestureActiveRef.current) {
            syncWindowCenterIfNeeded(targetCenter, force);
          }
        }, WINDOW_SHIFT_SETTLE_DELAY_MS);
      },
      [syncWindowCenterIfNeeded],
    );

    const visibleIndices = useMemo(() => {
      const extras: number[] = [];
      if (extraOffsets) {
        for (const off of extraOffsets) {
          extras.push(windowCenter + off);
        }
      }
      if (retainedPages.length > 0) {
        extras.push(...retainedPages);
      }
      return getVisiblePagerIndices(windowCenter, pageCount, windowRadius, extras);
    }, [windowCenter, pageCount, windowRadius, extraOffsets, retainedPages]);

    const visibleIndicesRef = useRef<number[]>(visibleIndices);
    useLayoutEffect(() => {
      visibleIndicesRef.current = visibleIndices;
    }, [visibleIndices]);

    const finalizeSettle = useCallback(
      (settledPage: number) => {
        const clamped = clampPagerIndex(settledPage, pageCountRef.current);
        const width = pageWidthRef.current;
        const settledX = width > 0 ? clamped * width : 0;
        const settledTx = -settledX;

        dragX.setValue(0);
        baseTx.setValue(settledTx);
        baseTxRef.current = settledTx;
        lastScrollXRef.current = settledX;
        currentPageRef.current = clamped;
        syncWindowCenterIfNeeded(clamped);
        emitPageScroll(settledX);
        emitScrollState("idle");
        onPageSelectedRef.current?.({ nativeEvent: { position: clamped } });
      },
      [baseTx, dragX, emitPageScroll, emitScrollState, syncWindowCenterIfNeeded],
    );

    const startSpringTo = useCallback(
      (
        targetPage: number,
        fromTx: number,
        velocityX: number,
        releaseCommit?: { dragStartPage: number; dragStartTx: number },
      ) => {
        cancelJumpTimers();
        const epoch = ++springEpochRef.current;
        if (activeSpringRef.current !== null) {
          activeSpringRef.current.stop();
          activeSpringRef.current = null;
        }
        pendingStopReadRef.current = false;
        deferredReleaseRef.current = null;

        const clamped = clampPagerIndex(targetPage, pageCountRef.current);
        const width = pageWidthRef.current;
        const targetTx = width > 0 ? -clamped * width : 0;

        dragX.setValue(0);
        baseTx.setValue(fromTx);
        baseTxRef.current = fromTx;
        currentPageRef.current = clamped;

        // Ensure target page mounts offscreen without blocking spring Frame 0 unless already missing.
        if (!visibleIndicesRef.current.includes(clamped)) {
          syncWindowCenterIfNeeded(clamped, true);
        }

        // Notify peer headers/grids immediately at finger release so quick flicks never wait for spring end.
        if (releaseCommit && width > 0) {
          if (clamped !== releaseCommit.dragStartPage) {
            if (!emittedScrollInGestureRef.current) {
              emitPageScroll(-releaseCommit.dragStartTx);
            }
            emitPageScroll(clamped * width);
          } else {
            emitPageScroll(releaseCommit.dragStartPage * width);
          }
        }

        if (
          width <= 0 ||
          (isScrollOffsetSettledAtPage(-fromTx, width, 0.5) &&
            Math.abs(fromTx - targetTx) <= 0.5 &&
            Math.abs(velocityX) < 25)
        ) {
          finalizeSettle(clamped);
          return;
        }

        emitScrollState("settling");
        const spring = Animated.spring(baseTx, {
          ...SPRING_CONFIG,
          toValue: targetTx,
          velocity: clampSpringVelocity(velocityX),
        });
        activeSpringRef.current = spring;
        spring.start(({ finished }) => {
          if (
            springEpochRef.current !== epoch ||
            activeSpringRef.current !== spring
          ) {
            return;
          }
          activeSpringRef.current = null;
          if (finished) {
            finalizeSettle(clamped);
          }
        });
      },
      [
        baseTx,
        cancelJumpTimers,
        dragX,
        emitPageScroll,
        emitScrollState,
        finalizeSettle,
        syncWindowCenterIfNeeded,
      ],
    );

    // Keep pixel offset aligned when pageWidth or pageCount changes (e.g. foldable resize).
    useLayoutEffect(() => {
      if (pageWidth <= 0 || gestureActiveRef.current) return;
      const clamped = clampPagerIndex(currentPageRef.current, pageCount);
      if (
        prevPageWidthRef.current !== pageWidth ||
        clamped !== currentPageRef.current
      ) {
        prevPageWidthRef.current = pageWidth;
        cancelJumpTimers();
        springEpochRef.current += 1;
        activeSpringRef.current?.stop();
        activeSpringRef.current = null;
        pendingStopReadRef.current = false;
        deferredReleaseRef.current = null;

        const targetX = clamped * pageWidth;
        const targetTx = -targetX;
        currentPageRef.current = clamped;
        baseTxRef.current = targetTx;
        lastScrollXRef.current = targetX;
        dragX.setValue(0);
        baseTx.setValue(targetTx);
        windowCenterRef.current = clamped;
        setWindowCenter(clamped);
        setRetainedPages((prev) => (prev.length > 0 ? [] : prev));
      }
    }, [baseTx, cancelJumpTimers, dragX, pageWidth, pageCount]);

    useEffect(() => {
      return () => {
        cancelJumpTimers();
        springEpochRef.current += 1;
        activeSpringRef.current?.stop();
        activeSpringRef.current = null;
      };
    }, [cancelJumpTimers]);

    useImperativeHandle(
      ref,
      () => ({
        setPage(target: number) {
          gestureActiveRef.current = false;
          interruptedSpringRef.current = false;
          const clamped = clampPagerIndex(target, pageCountRef.current);
          const width = pageWidthRef.current;

          if (width <= 0) {
            finalizeSettle(clamped);
            return;
          }

          const targetTx = -clamped * width;
          if (activeSpringRef.current === null && !pendingStopReadRef.current) {
            if (
              clamped === currentPageRef.current &&
              Math.abs(baseTxRef.current - targetTx) <= 0.5
            ) {
              finalizeSettle(clamped);
              return;
            }
            startSpringTo(clamped, baseTxRef.current, 0);
            return;
          }

          activeSpringRef.current?.stop();
          activeSpringRef.current = null;
          pendingStopReadRef.current = true;
          deferredReleaseRef.current = null;
          const epoch = ++springEpochRef.current;
          baseTx.stopAnimation((nativeVal) => {
            if (springEpochRef.current !== epoch) return;
            pendingStopReadRef.current = false;
            const resolvedTx = Number.isFinite(nativeVal)
              ? nativeVal
              : baseTxRef.current;
            startSpringTo(clamped, resolvedTx, 0);
          });
        },
        setPageWithoutAnimation(target: number) {
          cancelJumpTimers();
          springEpochRef.current += 1;
          activeSpringRef.current?.stop();
          activeSpringRef.current = null;
          pendingStopReadRef.current = false;
          deferredReleaseRef.current = null;
          gestureActiveRef.current = false;
          interruptedSpringRef.current = false;

          const clamped = clampPagerIndex(target, pageCountRef.current);
          const width = pageWidthRef.current;
          const targetX = width > 0 ? clamped * width : 0;
          const targetTx = -targetX;

          const alreadyRendered = visibleIndicesRef.current.includes(clamped);
          if (width > 0 && !alreadyRendered) {
            // Retain the currently visible page while mounting the offscreen target first
            // so rapid multi-year jumps never reveal a blank black frame before Fabric paints.
            const keepPage = currentPageRef.current;
            const epoch = jumpEpochRef.current;
            currentPageRef.current = clamped;
            lastScrollXRef.current = targetX;
            setRetainedPages([keepPage, clamped]);
            if (scrollStateRef.current !== "idle") {
              emitScrollState("idle");
            }
            jumpRaf1Ref.current = requestAnimationFrame(() => {
              jumpRaf1Ref.current = null;
              if (jumpEpochRef.current !== epoch) return;
              jumpRaf2Ref.current = requestAnimationFrame(() => {
                jumpRaf2Ref.current = null;
                if (jumpEpochRef.current !== epoch) return;
                baseTxRef.current = targetTx;
                dragX.setValue(0);
                baseTx.setValue(targetTx);
                syncWindowCenterIfNeeded(clamped, true);
                retainedClearRafRef.current = requestAnimationFrame(() => {
                  retainedClearRafRef.current = null;
                  if (jumpEpochRef.current !== epoch) return;
                  setRetainedPages((prev) => (prev.length > 0 ? [] : prev));
                });
              });
            });
            return;
          }

          currentPageRef.current = clamped;
          baseTxRef.current = targetTx;
          lastScrollXRef.current = targetX;
          dragX.setValue(0);
          baseTx.setValue(targetTx);
          if (Math.abs(clamped - windowCenterRef.current) >= getWindowShiftThreshold(windowRadiusRef.current)) {
            scheduleWindowShift(clamped);
          }
          if (scrollStateRef.current !== "idle") {
            emitScrollState("idle");
          }
        },
      }),
      [
        baseTx,
        cancelJumpTimers,
        dragX,
        emitScrollState,
        finalizeSettle,
        scheduleWindowShift,
        startSpringTo,
        syncWindowCenterIfNeeded,
      ],
    );

    const handleGestureMove = useCallback(
      (nativeEvent: PanGestureHandlerEventPayload) => {
        if (!gestureActiveRef.current) return;
        const width = pageWidthRef.current;
        const count = pageCountRef.current;
        if (width <= 0 || count <= 0) return;

        emittedScrollInGestureRef.current = true;
        const minTx = count > 1 ? -(count - 1) * width : 0;
        const visualTx = applyHorizontalRubberBand(
          baseTxRef.current + nativeEvent.translationX,
          minTx,
          0,
          RUBBER_BAND_FACTOR,
        );
        const maxScrollX = count > 1 ? (count - 1) * width : 0;
        const scrollX = Math.max(0, Math.min(maxScrollX, -visualTx));
        lastScrollXRef.current = scrollX;
        emitPageScroll(scrollX);

        const livePage = clampPagerIndex(Math.round(scrollX / width), count);
        const radius = windowRadiusRef.current;
        if (shouldShiftPagerWindow(livePage, windowCenterRef.current, radius)) {
          syncWindowCenterIfNeeded(livePage, true);
        }
      },
      [emitPageScroll, syncWindowCenterIfNeeded],
    );

    const handleGestureMoveRef = useRef(handleGestureMove);
    handleGestureMoveRef.current = handleGestureMove;

    const panGestureEvent = useMemo(
      () =>
        Animated.event([{ nativeEvent: { translationX: dragX } }], {
          useNativeDriver: true,
          listener: (e: NativeSyntheticEvent<PanGestureHandlerEventPayload>) => {
            handleGestureMoveRef.current(e.nativeEvent);
          },
        }) as unknown as NonNullable<PanGestureHandlerProps["onGestureEvent"]>,
      [dragX],
    );

    const handleHandlerStateChange = useCallback(
      (event: HandlerStateChangeEvent<PanGestureHandlerEventPayload>) => {
        const { state, translationX, velocityX } = event.nativeEvent;

        if (state === State.BEGAN) {
          cancelJumpTimers();
          if (
            Math.abs(currentPageRef.current - windowCenterRef.current) >=
            getWindowShiftThreshold(windowRadiusRef.current)
          ) {
            syncWindowCenterIfNeeded(currentPageRef.current, true);
          }
          deferredReleaseRef.current = null;
          interruptedSpringRef.current = false;
          emittedScrollInGestureRef.current = false;

          if (activeSpringRef.current !== null || pendingStopReadRef.current) {
            interruptedSpringRef.current = true;
            activeSpringRef.current?.stop();
            activeSpringRef.current = null;
            pendingStopReadRef.current = true;
            const stopEpoch = ++springEpochRef.current;
            baseTx.stopAnimation((nativeVal) => {
              if (springEpochRef.current !== stopEpoch) return;
              pendingStopReadRef.current = false;
              const resolvedBase = Number.isFinite(nativeVal)
                ? nativeVal
                : baseTxRef.current;
              baseTxRef.current = resolvedBase;
              dragStartBaseTxRef.current = resolvedBase;
              const width = pageWidthRef.current;
              dragStartPageRef.current =
                width > 0
                  ? clampPagerIndex(
                      Math.round(-resolvedBase / width),
                      pageCountRef.current,
                    )
                  : currentPageRef.current;
              const deferred = deferredReleaseRef.current;
              if (deferred) {
                deferredReleaseRef.current = null;
                deferred(resolvedBase);
              }
            });
          } else {
            dragStartBaseTxRef.current = baseTxRef.current;
            dragStartPageRef.current = currentPageRef.current;
          }
          return;
        }

        if (state === State.ACTIVE) {
          deferredReleaseRef.current = null;
          gestureActiveRef.current = true;
          emitScrollState("dragging");
          return;
        }

        if (
          state === State.END ||
          state === State.CANCELLED ||
          state === State.FAILED
        ) {
          const wasActive = gestureActiveRef.current;
          const wasInterrupted = interruptedSpringRef.current;
          gestureActiveRef.current = false;
          interruptedSpringRef.current = false;

          if (!wasActive && !wasInterrupted) return;

          const finalDragX = wasActive ? translationX : 0;
          const finalVx = wasActive ? velocityX : 0;

          const completeRelease = (startBaseTx: number) => {
            const width = pageWidthRef.current;
            const count = pageCountRef.current;
            const rawReleaseTx = startBaseTx + finalDragX;

            if (!wasActive) {
              startSpringTo(currentPageRef.current, rawReleaseTx, 0);
              return;
            }

            const startPage = dragStartPageRef.current;
            const startTx = dragStartBaseTxRef.current;
            const targetPage = resolveSwipeTargetPage({
              startPage,
              startScrollX: -startTx,
              currentScrollX: -rawReleaseTx,
              pageWidth: width,
              pageCount: count,
              velocityX: finalVx,
            });
            startSpringTo(targetPage, rawReleaseTx, finalVx, {
              dragStartPage: startPage,
              dragStartTx: startTx,
            });
          };

          if (pendingStopReadRef.current) {
            deferredReleaseRef.current = completeRelease;
          } else {
            completeRelease(baseTxRef.current);
          }
        }
      },
      [baseTx, cancelJumpTimers, emitScrollState, startSpringTo, syncWindowCenterIfNeeded],
    );

    const clampedTx = useMemo(() => {
      const raw = Animated.add(baseTx, dragX);
      const safeW = pageWidth > 0 ? pageWidth : 1;
      if (pageCount <= 1) {
        return raw.interpolate({
          inputRange: [-safeW, 0, safeW],
          outputRange: [
            -safeW * RUBBER_BAND_FACTOR,
            0,
            safeW * RUBBER_BAND_FACTOR,
          ],
        });
      }
      const minTx = -(pageCount - 1) * safeW;
      return raw.interpolate({
        inputRange: [minTx - safeW, minTx, 0, safeW],
        outputRange: [
          minTx - safeW * RUBBER_BAND_FACTOR,
          minTx,
          0,
          safeW * RUBBER_BAND_FACTOR,
        ],
      });
    }, [baseTx, dragX, pageCount, pageWidth]);

    const canvasWidth =
      pageWidth > 0 ? Math.max(pageWidth, pageCount * pageWidth) : undefined;

    return (
      <PanGestureHandler
        enabled={scrollEnabled && pageCount > 1 && pageWidth > 0}
        maxPointers={1}
        activeOffsetX={PAN_ACTIVE_OFFSET_X}
        failOffsetY={PAN_FAIL_OFFSET_Y}
        onGestureEvent={panGestureEvent}
        onHandlerStateChange={handleHandlerStateChange}
      >
        <Animated.View
          collapsable={false}
          style={[
            styles.viewport,
            pageWidth > 0 ? { width: pageWidth } : null,
            style,
          ]}
        >
          <Animated.View
            renderToHardwareTextureAndroid={false}
            style={[
              styles.canvas,
              canvasWidth ? { width: canvasWidth } : null,
              { transform: [{ translateX: clampedTx }] },
            ]}
          >
            {pageWidth > 0 &&
              visibleIndices.map((p) => (
                <View
                  key={p}
                  style={[
                    styles.pageSlot,
                    {
                      left: p * pageWidth,
                      width: pageWidth,
                    },
                  ]}
                >
                  {renderPage(p)}
                </View>
              ))}
          </Animated.View>
        </Animated.View>
      </PanGestureHandler>
    );
  },
);

const styles = StyleSheet.create({
  viewport: {
    overflow: "hidden",
  },
  canvas: {
    height: "100%",
    position: "relative",
  },
  pageSlot: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },
});

const SmoothHorizontalPager = memo(SmoothHorizontalPagerInner);

export default SmoothHorizontalPager;
