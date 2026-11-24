import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { getRadioDotMetrics } from "./radio-dot.utils";

type Props = {
  checked: boolean;
  size?: number;
  color: string;
  snapKey?: string | number;
};

export default function AnimatedRadioDot({
  checked,
  size = 22,
  color,
  snapKey,
}: Props) {
  const dotProgress = useRef(new Animated.Value(checked ? 1 : 0)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const prevCheckedRef = useRef(checked);
  const prevSnapKeyRef = useRef(snapKey);

  useEffect(() => {
    if (prevSnapKeyRef.current !== snapKey) {
      prevSnapKeyRef.current = snapKey;
      prevCheckedRef.current = checked;
      dotProgress.stopAnimation();
      ringScale.stopAnimation();
      dotProgress.setValue(checked ? 1 : 0);
      ringScale.setValue(1);
      return;
    }

    if (prevCheckedRef.current === checked) return;
    prevCheckedRef.current = checked;

    dotProgress.stopAnimation();
    ringScale.stopAnimation();

    if (checked) {
      Animated.parallel([
        Animated.spring(dotProgress, {
          toValue: 1,
          damping: 11,
          stiffness: 300,
          mass: 0.65,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(ringScale, {
            toValue: 0.88,
            duration: 65,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.spring(ringScale, {
            toValue: 1,
            damping: 12,
            stiffness: 280,
            mass: 0.7,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(dotProgress, {
          toValue: 0,
          duration: 150,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(ringScale, {
            toValue: 0.92,
            duration: 60,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.spring(ringScale, {
            toValue: 1,
            damping: 14,
            stiffness: 260,
            mass: 0.7,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [checked, snapKey, dotProgress, ringScale]);

  const { boxSize, ringSize, strokeWidth, dotSize } = getRadioDotMetrics(size);
  const center = boxSize / 2;
  const ringRadius = (ringSize - strokeWidth) / 2;
  const dotRadius = dotSize / 2;

  const dotOpacity = dotProgress.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 1, 1],
    extrapolate: "clamp",
  });
  const dotScale = dotProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 1],
  });

  return (
    <View
      style={{
        width: boxSize,
        height: boxSize,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={{
          width: boxSize,
          height: boxSize,
          transform: [{ scale: ringScale }],
        }}
      >
        <Svg width={boxSize} height={boxSize}>
          <Circle
            cx={center}
            cy={center}
            r={ringRadius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </Svg>
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: boxSize,
            height: boxSize,
            opacity: dotOpacity,
            transform: [{ scale: dotScale }],
          }}
        >
          <Svg width={boxSize} height={boxSize}>
            <Circle cx={center} cy={center} r={dotRadius} fill={color} />
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
