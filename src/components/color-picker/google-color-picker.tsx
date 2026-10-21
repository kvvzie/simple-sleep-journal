import { Image } from "expo-image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type GoogleColorPickerProps = {
  color: string;
  onChange: (hex: string) => void;
  label?: string;
  fontFamily?: string;
  textColor?: string;
  borderColor?: string;
};

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b];
  }
  return [0, 0, 0];
}

function rgbToHsv(r: number, g: number, b: number): {
  h: number;
  s: number;
  v: number;
} {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (max !== min) {
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h: Math.round(h) % 360, s, v };
}

const QUICK_PALETTE = [
  "#FFFFFF",
  "#000000",
  "#FFE500",
  "#FF007F",
  "#00FF99",
  "#00E5FF",
  "#9933FF",
  "#FF6600",
];

export function GoogleColorPicker({
  color,
  onChange,
  label,
  fontFamily,
  textColor = "#FFFFFF",
  borderColor = "#444444",
}: GoogleColorPickerProps) {
  const [rgb] = useState(() => hexToRgb(color));
  const initialHsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);

  const [hue, setHue] = useState<number>(initialHsv.h);
  const [sat, setSat] = useState<number>(initialHsv.s);
  const [val, setVal] = useState<number>(initialHsv.v);
  const [hexInput, setHexInput] = useState<string>(color.toUpperCase());

  const boxSize = useRef({ width: 280, height: 150 });
  const sliderWidth = useRef(280);

  const updateFromColor = useCallback((newColor: string) => {
    const [r, g, b] = hexToRgb(newColor);
    const hsv = rgbToHsv(r, g, b);
    setHue(hsv.h);
    setSat(hsv.s);
    setVal(hsv.v);
    setHexInput(newColor.toUpperCase());
  }, []);

  useEffect(() => {
    if (color.toUpperCase() !== hexInput.toUpperCase()) {
      updateFromColor(color);
    }
  }, [color, updateFromColor, hexInput]);

  const pureHueHex = rgbToHex(...hsvToRgb(hue, 1, 1));

  const handleBoxTouch = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    const w = Math.max(1, boxSize.current.width);
    const h = Math.max(1, boxSize.current.height);
    const clampedX = Math.max(0, Math.min(w, locationX));
    const clampedY = Math.max(0, Math.min(h, locationY));
    const newSat = clampedX / w;
    const newVal = 1 - clampedY / h;
    setSat(newSat);
    setVal(newVal);
    const newHex = rgbToHex(...hsvToRgb(hue, newSat, newVal));
    setHexInput(newHex);
    onChange(newHex);
  };

  const handleHueTouch = (e: GestureResponderEvent) => {
    const { locationX } = e.nativeEvent;
    const w = Math.max(1, sliderWidth.current);
    const clampedX = Math.max(0, Math.min(w, locationX));
    const newHue = Math.round((clampedX / w) * 360) % 360;
    setHue(newHue);
    const newHex = rgbToHex(...hsvToRgb(newHue, sat, val));
    setHexInput(newHex);
    onChange(newHex);
  };

  const handleHexInputChange = (text: string) => {
    let clean = text.trim().toUpperCase();
    if (!clean.startsWith("#")) {
      clean = `#${clean}`;
    }
    setHexInput(clean);
    if (/^#[0-9A-F]{6}$/i.test(clean)) {
      updateFromColor(clean);
      onChange(clean);
    }
  };

  const cursorX = Math.max(
    0,
    Math.min(boxSize.current.width, sat * boxSize.current.width),
  );
  const cursorY = Math.max(
    0,
    Math.min(boxSize.current.height, (1 - val) * boxSize.current.height),
  );
  const sliderThumbX = Math.max(
    0,
    Math.min(sliderWidth.current, (hue / 360) * sliderWidth.current),
  );

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: textColor, fontFamily }]}>
          {label}
        </Text>
      )}

      <View
        style={[styles.boxContainer, { backgroundColor: pureHueHex }]}
        onLayout={(e: LayoutChangeEvent) => {
          boxSize.current = {
            width: e.nativeEvent.layout.width,
            height: e.nativeEvent.layout.height,
          };
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleBoxTouch}
        onResponderMove={handleBoxTouch}
      >
        <Image
          source={require("../../../assets/color-picker-white-h.png")}
          style={StyleSheet.absoluteFill}
          contentFit="fill"
        />
        <Image
          source={require("../../../assets/color-picker-black-v.png")}
          style={StyleSheet.absoluteFill}
          contentFit="fill"
        />
        <View
          pointerEvents="none"
          style={[
            styles.cursor,
            {
              left: cursorX - 10,
              top: cursorY - 10,
              backgroundColor: hexInput,
            },
          ]}
        />
      </View>

      <View
        style={styles.hueTrack}
        onLayout={(e: LayoutChangeEvent) => {
          sliderWidth.current = e.nativeEvent.layout.width;
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleHueTouch}
        onResponderMove={handleHueTouch}
      >
        <Image
          source={require("../../../assets/color-picker-hue.png")}
          style={StyleSheet.absoluteFill}
          contentFit="fill"
        />
        <View
          pointerEvents="none"
          style={[
            styles.hueThumb,
            {
              left: sliderThumbX - 11,
              backgroundColor: pureHueHex,
            },
          ]}
        />
      </View>

      <View style={styles.bottomRow}>
        <View
          style={[
            styles.swatchPreview,
            { backgroundColor: hexInput, borderColor },
          ]}
        />
        <View style={[styles.inputBox, { borderColor }]}>
          <TextInput
            value={hexInput}
            onChangeText={handleHexInputChange}
            maxLength={7}
            autoCapitalize="characters"
            autoCorrect={false}
            style={[styles.hexText, { color: textColor, fontFamily }]}
          />
        </View>
      </View>

      <View style={styles.paletteRow}>
        {QUICK_PALETTE.map((chipHex) => (
          <Pressable
            key={chipHex}
            onPress={() => {
              updateFromColor(chipHex);
              onChange(chipHex);
            }}
            hitSlop={4}
            style={[
              styles.paletteChip,
              { backgroundColor: chipHex, borderColor },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingVertical: 8,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    textTransform: "lowercase",
  },
  boxContainer: {
    width: "100%",
    height: 140,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  cursor: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    elevation: 4,
  },
  hueTrack: {
    width: "100%",
    height: 22,
    borderRadius: 11,
    overflow: "hidden",
    marginTop: 12,
    position: "relative",
    justifyContent: "center",
  },
  hueThumb: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    elevation: 4,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 12,
  },
  swatchPreview: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
  },
  inputBox: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  hexText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  paletteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  paletteChip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
  },
});
