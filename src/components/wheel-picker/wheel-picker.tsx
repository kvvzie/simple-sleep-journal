import { Ionicons } from "@expo/vector-icons";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Animated,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  clampWheelPage,
  computeRubberBandWheelPage,
  getVisibleWheelIndices,
  projectWheelReleasePage,
} from "./wheel-picker.utils";

export type WheelPickerHandle = {
  bump: (delta: number) => void;
  syncTo: (page: number) => void;
};

type LockRef = React.MutableRefObject<string | null>;

type WheelPickerProps = {
  pagerKey?: number | string;
  page: number;
  totalPages: number;
  renderLabel: (page: number) => string;
  onSelected: (page: number) => void;
  onScrollStateChanged?: (state: "idle" | "dragging" | "settling") => void;
  canIncrease?: boolean;
  canDecrease?: boolean;
  arrowColor: string;
  arrowSize?: number;
  containerStyle?: any;
  arrowSlotStyle?: any;
  pagerStyle?: any;
  pageStyle?: any;
  labelStyle?: any;
  lockRef?: LockRef;
  lockKey?: string;
};

const DEFAULT_PAGE_HEIGHT = 70;

const WheelPicker = forwardRef<WheelPickerHandle, WheelPickerProps>(
  (
    {
      pagerKey,
      page,
      totalPages,
      renderLabel,
      onSelected,
      onScrollStateChanged,
      canIncrease = true,
      canDecrease = true,
      arrowColor,
      arrowSize = 16,
      containerStyle,
      arrowSlotStyle,
      pagerStyle,
      pageStyle,
      labelStyle,
      lockRef,
      lockKey = "wheel",
    },
    ref,
  ) => {
    const flattenedHeight = StyleSheet.flatten(pagerStyle)?.height;
    const initialHeight =
      typeof flattenedHeight === "number" && flattenedHeight > 0
        ? flattenedHeight
        : DEFAULT_PAGE_HEIGHT;

    const [viewportHeight, setViewportHeight] = useState(initialHeight);
    const [windowCenter, setWindowCenter] = useState(() =>
      clampWheelPage(page, totalPages),
    );

    const pageHeightRef = useRef(initialHeight);
    const currentPageRef = useRef(clampWheelPage(page, totalPages));
    const windowCenterRef = useRef(currentPageRef.current);
    const dragStartPageRef = useRef(currentPageRef.current);
    const activeDragRef = useRef(false);
    const animPage = useRef(new Animated.Value(currentPageRef.current)).current;
    const activeAnimRef = useRef<Animated.CompositeAnimation | null>(null);

    const totalPagesRef = useRef(totalPages);
    totalPagesRef.current = totalPages;
    const onSelectedRef = useRef(onSelected);
    onSelectedRef.current = onSelected;
    const onScrollStateChangedRef = useRef(onScrollStateChanged);
    onScrollStateChangedRef.current = onScrollStateChanged;
    const lockRefObj = useRef(lockRef);
    lockRefObj.current = lockRef;
    const lockKeyRef = useRef(lockKey);
    lockKeyRef.current = lockKey;

    const tryLock = useCallback(() => {
      const lr = lockRefObj.current;
      if (lr && lr.current === null) lr.current = lockKeyRef.current;
    }, []);

    const releaseLock = useCallback(() => {
      const lr = lockRefObj.current;
      if (lr && lr.current === lockKeyRef.current) lr.current = null;
    }, []);

    const isLockedOut = useCallback(() => {
      const lr = lockRefObj.current;
      return !!lr && lr.current !== null && lr.current !== lockKeyRef.current;
    }, []);

    const animateToPage = useCallback(
      (targetPage: number, notifySelected: boolean) => {
        const clamped = clampWheelPage(targetPage, totalPagesRef.current);
        activeAnimRef.current?.stop();
        onScrollStateChangedRef.current?.("settling");

        const prev = currentPageRef.current;
        currentPageRef.current = clamped;
        windowCenterRef.current = clamped;
        setWindowCenter(clamped);

        if (notifySelected && clamped !== prev) {
          onSelectedRef.current(clamped);
        }

        const anim = Animated.spring(animPage, {
          toValue: clamped,
          damping: 22,
          stiffness: 260,
          overshootClamping: true,
          useNativeDriver: true,
        });
        activeAnimRef.current = anim;
        anim.start(({ finished }) => {
          if (finished && activeAnimRef.current === anim) {
            activeAnimRef.current = null;
          }
          if (!activeDragRef.current) {
            releaseLock();
            onScrollStateChangedRef.current?.("idle");
          }
        });
      },
      [animPage, releaseLock],
    );

    const prevPagerKeyRef = useRef(pagerKey);
    useEffect(() => {
      if (prevPagerKeyRef.current === pagerKey) return;
      prevPagerKeyRef.current = pagerKey;
      activeAnimRef.current?.stop();
      activeAnimRef.current = null;
      activeDragRef.current = false;
      const safePage = clampWheelPage(page, totalPages);
      currentPageRef.current = safePage;
      windowCenterRef.current = safePage;
      dragStartPageRef.current = safePage;
      setWindowCenter(safePage);
      animPage.setValue(safePage);
      releaseLock();
      onScrollStateChangedRef.current?.("idle");
    }, [pagerKey, page, totalPages, animPage, releaseLock]);

    useEffect(() => {
      return () => {
        activeAnimRef.current?.stop();
      };
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        bump: (delta: number) => {
          animateToPage(currentPageRef.current + delta, true);
        },
        syncTo: (targetPage: number) => {
          const safeTarget = clampWheelPage(targetPage, totalPagesRef.current);
          if (safeTarget === currentPageRef.current && !activeDragRef.current) {
            return;
          }
          animateToPage(safeTarget, false);
        },
      }),
      [animateToPage],
    );

    const handlePagerLayout = (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0 && h !== pageHeightRef.current) {
        pageHeightRef.current = h;
        setViewportHeight(h);
      }
    };

    const wheelPan = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => !isLockedOut(),
        onStartShouldSetPanResponderCapture: () => !isLockedOut(),
        onMoveShouldSetPanResponder: () => !isLockedOut(),
        onMoveShouldSetPanResponderCapture: () => !isLockedOut(),
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          tryLock();
          activeDragRef.current = true;
          dragStartPageRef.current = currentPageRef.current;
          activeAnimRef.current?.stop();
          activeAnimRef.current = null;
          animPage.stopAnimation((val) => {
            if (typeof val === "number" && !Number.isNaN(val)) {
              dragStartPageRef.current = clampWheelPage(
                val,
                totalPagesRef.current,
              );
            }
          });
          onScrollStateChangedRef.current?.("dragging");
        },
        onPanResponderMove: (_, g) => {
          if (!activeDragRef.current) return;
          const raw =
            dragStartPageRef.current - g.dy / Math.max(1, pageHeightRef.current);
          const rubber = computeRubberBandWheelPage(raw, totalPagesRef.current);
          animPage.setValue(rubber);

          const nearest = clampWheelPage(
            Math.round(rubber),
            totalPagesRef.current,
          );
          if (nearest !== windowCenterRef.current) {
            windowCenterRef.current = nearest;
            setWindowCenter(nearest);
          }
        },
        onPanResponderRelease: (_, g) => {
          activeDragRef.current = false;
          const target = projectWheelReleasePage({
            startPage: dragStartPageRef.current,
            dy: g.dy,
            vy: g.vy,
            pageHeight: pageHeightRef.current,
            totalPages: totalPagesRef.current,
          });
          animateToPage(target, true);
        },
        onPanResponderTerminate: (_, g) => {
          activeDragRef.current = false;
          const target = projectWheelReleasePage({
            startPage: dragStartPageRef.current,
            dy: g.dy,
            vy: g.vy,
            pageHeight: pageHeightRef.current,
            totalPages: totalPagesRef.current,
          });
          animateToPage(target, true);
        },
      }),
    ).current;

    const visibleIndices = getVisibleWheelIndices(windowCenter, totalPages, 2);

    return (
      <View
        style={containerStyle}
        pointerEvents={isLockedOut() ? "none" : "auto"}
        onTouchStart={tryLock}
        onTouchEnd={() => {
          if (!activeDragRef.current) releaseLock();
        }}
        onTouchCancel={() => {
          if (!activeDragRef.current) {
            releaseLock();
            onScrollStateChangedRef.current?.("idle");
          }
        }}
      >
        <View style={arrowSlotStyle}>
          {canIncrease && (
            <Pressable
              onPress={() => animateToPage(currentPageRef.current + 1, true)}
              hitSlop={14}
            >
              <Ionicons name="chevron-up" size={arrowSize} color={arrowColor} />
            </Pressable>
          )}
        </View>

        <View
          {...wheelPan.panHandlers}
          onTouchStartCapture={() => {
            if (!isLockedOut()) {
              tryLock();
              onScrollStateChangedRef.current?.("dragging");
            }
          }}
          onTouchEndCapture={() => {
            if (!activeDragRef.current && !activeAnimRef.current) {
              releaseLock();
              onScrollStateChangedRef.current?.("idle");
            }
          }}
          onTouchCancelCapture={() => {
            if (!activeDragRef.current && !activeAnimRef.current) {
              releaseLock();
              onScrollStateChangedRef.current?.("idle");
            }
          }}
          onLayout={handlePagerLayout}
          style={[
            pagerStyle,
            { overflow: "hidden", position: "relative" },
          ]}
        >
          {visibleIndices.map((idx) => (
            <Animated.View
              key={idx}
              pointerEvents="none"
              style={[
                pageStyle,
                StyleSheet.absoluteFill,
                {
                  opacity: animPage.interpolate({
                    inputRange: [idx - 1, idx, idx + 1],
                    outputRange: [0.22, 1, 0.22],
                    extrapolate: "clamp",
                  }),
                  transform: [
                    {
                      translateY: Animated.multiply(
                        Animated.subtract(idx, animPage),
                        viewportHeight,
                      ),
                    },
                  ],
                },
              ]}
            >
              <Text style={labelStyle}>{renderLabel(idx)}</Text>
            </Animated.View>
          ))}
        </View>

        <View style={arrowSlotStyle}>
          {canDecrease && (
            <Pressable
              onPress={() => animateToPage(currentPageRef.current - 1, true)}
              hitSlop={14}
            >
              <Ionicons
                name="chevron-down"
                size={arrowSize}
                color={arrowColor}
              />
            </Pressable>
          )}
        </View>
      </View>
    );
  },
);

export default memo(WheelPicker);
