import { memo, ReactNode, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleProp,
  View,
  ViewStyle,
} from "react-native";
import Svg, { Rect } from "react-native-svg";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const DASH_LENGTH = 6;
const GAP_LENGTH = 5;
const DASH_PITCH = DASH_LENGTH + GAP_LENGTH;

type OverlayProps = {
  active: boolean;
  paused: boolean;
  width: number;
  height: number;
  idleColor: string;
  highlightColor: string;
  borderRadius: number;
  strokeWidth: number;
};

const DottedBorderSvgOverlay = memo(function DottedBorderSvgOverlay({
  active,
  paused,
  width,
  height,
  idleColor,
  highlightColor,
  borderRadius,
  strokeWidth,
}: OverlayProps) {
  const dashOffset = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const shouldAnimate = active && !paused;

  useEffect(() => {
    if (!shouldAnimate) {
      dashOffset.stopAnimation();
      pulseAnim.stopAnimation();
      if (!active) {
        dashOffset.setValue(0);
        pulseAnim.setValue(0);
      }
      return;
    }

    dashOffset.setValue(0);
    pulseAnim.setValue(0);

    const dashLoop = Animated.loop(
      Animated.timing(dashOffset, {
        toValue: -DASH_PITCH,
        duration: 4500,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );

    dashLoop.start();
    pulseLoop.start();

    return () => {
      dashLoop.stop();
      pulseLoop.stop();
    };
  }, [active, shouldAnimate, dashOffset, pulseAnim]);

  if (width <= 0 || height <= 0) {
    return null;
  }

  const highlightOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.12, 0.78],
  });

  const rectWidth = Math.max(0, width - strokeWidth);
  const rectHeight = Math.max(0, height - strokeWidth);
  const rectX = strokeWidth / 2;
  const rectY = strokeWidth / 2;

  return (
    <Svg
      width={width}
      height={height}
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
      }}
    >
      {shouldAnimate ? (
        <>
          <AnimatedRect
            x={rectX}
            y={rectY}
            width={rectWidth}
            height={rectHeight}
            rx={borderRadius}
            ry={borderRadius}
            fill="none"
            stroke={idleColor}
            strokeWidth={strokeWidth}
            strokeDasharray={[DASH_LENGTH, GAP_LENGTH]}
            strokeDashoffset={dashOffset}
          />
          <AnimatedRect
            x={rectX}
            y={rectY}
            width={rectWidth}
            height={rectHeight}
            rx={borderRadius}
            ry={borderRadius}
            fill="none"
            stroke={highlightColor}
            strokeWidth={strokeWidth}
            strokeDasharray={[DASH_LENGTH, GAP_LENGTH]}
            strokeDashoffset={dashOffset}
            strokeOpacity={highlightOpacity}
          />
        </>
      ) : active ? (
        <>
          <Rect
            x={rectX}
            y={rectY}
            width={rectWidth}
            height={rectHeight}
            rx={borderRadius}
            ry={borderRadius}
            fill="none"
            stroke={idleColor}
            strokeWidth={strokeWidth}
            strokeDasharray={[DASH_LENGTH, GAP_LENGTH]}
          />
          <Rect
            x={rectX}
            y={rectY}
            width={rectWidth}
            height={rectHeight}
            rx={borderRadius}
            ry={borderRadius}
            fill="none"
            stroke={highlightColor}
            strokeWidth={strokeWidth}
            strokeDasharray={[DASH_LENGTH, GAP_LENGTH]}
            strokeOpacity={0.55}
          />
        </>
      ) : (
        <Rect
          x={rectX}
          y={rectY}
          width={rectWidth}
          height={rectHeight}
          rx={borderRadius}
          ry={borderRadius}
          fill="none"
          stroke={idleColor}
          strokeWidth={strokeWidth}
          strokeDasharray={[DASH_LENGTH, GAP_LENGTH]}
        />
      )}
    </Svg>
  );
});

type Props = {
  active: boolean;
  paused?: boolean;
  idleColor: string;
  highlightColor: string;
  innerBorderColor?: string;
  borderRadius?: number;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * Wraps content with a rounded dotted/dashed border that slowly marches around
 * its perimeter with a gentle color pulse while `active` is true, with the SVG
 * overlay memoized so keystrokes inside `children` do not re-reconcile the SVG.
 */
export default function AnimatedDottedBorder({
  active,
  paused = false,
  idleColor,
  highlightColor,
  innerBorderColor,
  borderRadius = 12,
  strokeWidth = 1.5,
  style,
  children,
}: Props) {
  const [boxSize, setBoxSize] = useState({ width: 0, height: 0 });

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    setBoxSize((prev) =>
      prev.width === nextWidth && prev.height === nextHeight
        ? prev
        : { width: nextWidth, height: nextHeight },
    );
  };

  const innerRadius = Math.max(0, borderRadius - strokeWidth);

  return (
    <View onLayout={handleLayout} style={style}>
      <View
        style={
          innerBorderColor
            ? {
                margin: strokeWidth,
                borderWidth: 1,
                borderColor: innerBorderColor,
                borderRadius: innerRadius,
                overflow: "hidden",
              }
            : undefined
        }
      >
        {children}
      </View>

      <DottedBorderSvgOverlay
        active={active}
        paused={paused}
        width={boxSize.width}
        height={boxSize.height}
        idleColor={idleColor}
        highlightColor={highlightColor}
        borderRadius={borderRadius}
        strokeWidth={strokeWidth}
      />
    </View>
  );
}
