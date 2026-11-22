import type { BuildConfig, FeatureFlags, AppTheme, ThemePaletteColors } from "../types/appearance.ts";

export const BASE_PALETTE: { light: ThemePaletteColors; dark: ThemePaletteColors } = {
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
};

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  colorSchemeToggleEnabled: true,
  bodyCareEnabled: false,
  moodStarsEnabled: true,
  commentsEnabled: true,
  todoListEnabled: true,
  toDiscussToggleEnabled: true,
  toDiscussDefaultEnabled: true,
  gridPickerEnabled: true,
  inAppCustomizationEnabled: false,
};

export const DEFAULT_THEME: AppTheme = {
  name: "Vanilla Default",
  version: 1,
  palette: {},
  font: null,
  backgrounds: {
    calendar: null,
    settings: null,
  },
  features: {},
};

export const DEFAULT_BUILD_CONFIG: BuildConfig = {
  mode: "dynamic",
  appName: "mood journal",
  packageId: "com.shittyassapps.sleepinapp",
  features: {
    ...DEFAULT_FEATURE_FLAGS,
    inAppCustomizationEnabled: true,
  },
  lockedGrid: null,
  bakedTheme: DEFAULT_THEME,
};
