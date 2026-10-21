import "@/global.css";
import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#000000",
    background: "#ffffff",
    backgroundElement: "#F0F0F3",
    backgroundSelected: "#E0E1E6",
    textSecondary: "#60646C",
    // Kalendarz — dostosuj tutaj
    calendarDayLogged: "#000000", // dzień z zapisanym snem — pełny kolor
    calendarDayUnlogged: "#8A8A8E", // dzień przeszły bez zapisu — średni szary
    calendarDayFuture: "#B8B8BC", // dzień przyszły — jasniejszy szary, italic
    calendarDayOtherMonth: "#D8D8DC", // dni z innego miesiąca — najjaśniejszy
    calendarToday: "#000000", // dzisiejszy dzień — pełny + bold
    modalBackground: "#ffffff",
    modalOverlay: "rgba(0,0,0,0.4)",
  },
  dark: {
    text: "#ffffff",
    background: "#000000",
    backgroundElement: "#212225",
    backgroundSelected: "#2E3135",
    textSecondary: "#B0B4BA",
    // Kalendarz — dostosuj tutaj (poprawione, żeby było widać w dark mode)
    calendarDayLogged: "#ffffff", // dzień z zapisanym snem — pełny biały
    calendarDayUnlogged: "#75757A", // dzień przeszły bez zapisu — wyraźny szary
    calendarDayFuture: "#4A4A4F", // dzień przyszły — ciemniejszy, ale widoczny
    calendarDayOtherMonth: "#38383D", // dni z innego miesiąca — najciemniejszy widoczny
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
