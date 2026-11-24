import {
  computeWidthScale,
  getScaledMeasuredWidth,
} from "@/components/calendar-grid/calendar-grid.utils";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing } from "react-native";

export const HEADER_TEXT_PADDING = 48;
export const HEADER_ANIM_DURATION = 260;

export type UseHeaderWidthSyncOptions = {
  activeKey: number;
  measureKey: string;
  fixedWidth: number;
  defaultWidth: number;
  minScale: number;
  textPadding?: number;
  animDuration?: number;
  minWidthDelta?: number;
  snapVersion?: number | string;
};

/**
 * Dynamically measures label widths offscreen and animates a centered header window
 * so surrounding chevrons track the active month/year label width without clipping.
 */
export function useHeaderWidthSync(options: UseHeaderWidthSyncOptions) {
  const {
    activeKey,
    measureKey,
    fixedWidth,
    defaultWidth,
    minScale,
    textPadding = HEADER_TEXT_PADDING,
    animDuration = HEADER_ANIM_DURATION,
    minWidthDelta = 0,
    snapVersion = "",
  } = options;
  const maxTextWidth = fixedWidth - 8;
  const snapToken = `${measureKey}|${snapVersion}`;

  const [fontScale, setFontScale] = useState(1);
  const widthAnim = useRef(new Animated.Value(defaultWidth)).current;
  const widthsByKey = useRef<Record<string, Record<number, number>>>({});
  const snappedToken = useRef<string | null>(null);
  const lastTargetWidthRef = useRef<Record<string, number>>({});
  const activeAnim = useRef<Animated.CompositeAnimation | null>(null);

  const activeKeyRef = useRef(activeKey);
  const measureKeyRef = useRef(measureKey);
  const snapTokenRef = useRef(snapToken);
  const scaleRef = useRef(fontScale);

  useLayoutEffect(() => {
    activeKeyRef.current = activeKey;
    measureKeyRef.current = measureKey;
    snapTokenRef.current = snapToken;
    scaleRef.current = fontScale;
  }, [activeKey, measureKey, snapToken, fontScale]);

  const animateTo = useCallback(
    (target: number) => {
      activeAnim.current?.stop();
      const anim = Animated.timing(widthAnim, {
        toValue: target,
        duration: animDuration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      });
      activeAnim.current = anim;
      anim.start(() => {
        if (activeAnim.current === anim) {
          activeAnim.current = null;
        }
      });
    },
    [widthAnim, animDuration],
  );

  useEffect(() => {
    const scale = computeWidthScale(
      widthsByKey.current[measureKey],
      maxTextWidth,
      minScale,
    );
    setFontScale(scale);
  }, [measureKey, maxTextWidth, minScale]);

  useLayoutEffect(() => {
    const target = getScaledMeasuredWidth(
      widthsByKey.current[measureKey],
      activeKey,
      fontScale,
      maxTextWidth,
    );
    if (target === undefined) return;
    if (snappedToken.current !== snapToken) {
      activeAnim.current?.stop();
      widthAnim.setValue(target);
      snappedToken.current = snapToken;
      lastTargetWidthRef.current[snapToken] = target;
      return;
    }
    const prevTarget = lastTargetWidthRef.current[snapToken];
    if (
      minWidthDelta > 0 &&
      prevTarget !== undefined &&
      Math.abs(target - prevTarget) < minWidthDelta
    ) {
      return;
    }
    lastTargetWidthRef.current[snapToken] = target;
    animateTo(target);
  }, [activeKey, measureKey, snapToken, fontScale, maxTextWidth, minWidthDelta, widthAnim, animateTo]);

  const onMeasure = useCallback(
    (itemKey: number, rawWidth: number) => {
      const bucket = (widthsByKey.current[measureKey] ??= {});
      bucket[itemKey] = rawWidth;
      const scale = computeWidthScale(bucket, maxTextWidth, minScale);
      if (scale !== scaleRef.current) {
        setFontScale(scale);
      }
      if (
        measureKey === measureKeyRef.current &&
        itemKey === activeKeyRef.current
      ) {
        const scaledWidth = Math.min(maxTextWidth, rawWidth * scale);
        const token = snapTokenRef.current;
        if (snappedToken.current !== token) {
          activeAnim.current?.stop();
          widthAnim.setValue(scaledWidth);
          snappedToken.current = token;
          lastTargetWidthRef.current[token] = scaledWidth;
        } else {
          const prevTarget = lastTargetWidthRef.current[token];
          if (
            minWidthDelta > 0 &&
            prevTarget !== undefined &&
            Math.abs(scaledWidth - prevTarget) < minWidthDelta
          ) {
            return;
          }
          lastTargetWidthRef.current[token] = scaledWidth;
          animateTo(scaledWidth);
        }
      }
    },
    [measureKey, maxTextWidth, minScale, minWidthDelta, widthAnim, animateTo],
  );

  const containerWidth = useMemo(
    () => Animated.add(widthAnim, textPadding),
    [widthAnim, textPadding],
  );
  const pagerMarginLeft = useMemo(
    () =>
      Animated.multiply(
        Animated.add(widthAnim, textPadding - fixedWidth),
        0.5,
      ),
    [widthAnim, textPadding, fixedWidth],
  );

  return {
    fontScale,
    containerWidth,
    pagerMarginLeft,
    onMeasure,
  };
}
