import { View } from "react-native";

type Props = {
  size?: number;
  color: string;
  cutoutColor?: string;
  filled?: boolean;
};

export default function ReadingModeMobileIcon({
  size = 26,
  color,
  cutoutColor = "#000000",
  filled = false,
}: Props) {
  const scale = size / 24;
  const boxWidth = Math.round(16 * scale * 10) / 10;
  const boxHeight = Math.round(20 * scale * 10) / 10;
  const strokeWidth = Math.max(1.5, Math.round(1.65 * scale * 10) / 10);
  const borderRadius = Math.round(2.75 * scale * 10) / 10;
  const paddingLeft = Math.round(2.5 * scale * 10) / 10;
  const paddingTop = Math.round(3.6 * scale * 10) / 10;
  const lineGap = Math.round(2.4 * scale * 10) / 10;
  const lineLong = Math.round(8.2 * scale * 10) / 10;
  const lineShort = Math.round(5.0 * scale * 10) / 10;
  const lineColor = filled ? cutoutColor : color;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: boxWidth,
          height: boxHeight,
          borderRadius,
          borderWidth: strokeWidth,
          borderColor: color,
          backgroundColor: filled ? color : "transparent",
          paddingLeft,
          paddingTop,
          gap: lineGap,
        }}
      >
        <View
          style={{
            width: lineLong,
            height: strokeWidth,
            borderRadius: strokeWidth / 2,
            backgroundColor: lineColor,
          }}
        />
        <View
          style={{
            width: lineLong,
            height: strokeWidth,
            borderRadius: strokeWidth / 2,
            backgroundColor: lineColor,
          }}
        />
        <View
          style={{
            width: lineShort,
            height: strokeWidth,
            borderRadius: strokeWidth / 2,
            backgroundColor: lineColor,
          }}
        />
      </View>
    </View>
  );
}
