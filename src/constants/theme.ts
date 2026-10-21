import "@/global.css";
import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#000000",
    background: "#ffffff",
    backgroundElement: "#F0F0F3",
    backgroundSelected: "#E0E1E6",
    textSecondary: "#60646C",
    calendarDayLogged: "#000000",
    calendarDayUnlogged: "#8A8A8E",
    calendarDayFuture: "#B8B8BC",
    calendarDayOtherMonth: "#D8D8DC",
    calendarToday: "#000000",
    modalBackground: "#ffffff",
    modalOverlay: "rgba(0,0,0,0.4)",
  },
  dark: {
    text: "#ffffff",
    background: "#000000",
    backgroundElement: "#212225",
    backgroundSelected: "#2E3135",
    textSecondary: "#B0B4BA",
    calendarDayLogged: "#ffffff",
    calendarDayUnlogged: "#75757A",
    calendarDayFuture: "#4A4A4F",
    calendarDayOtherMonth: "#38383D",
    calendarToday: "#ffffff",
    modalBackground: "#1C1C1E",
    modalOverlay: "rgba(0,0,0,0.6)",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
