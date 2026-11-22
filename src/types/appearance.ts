export type BuildMode = "default" | "baked" | "dynamic";

export type ThemePaletteColors = {
  text: string;
  background: string;
  backgroundElement: string;
  backgroundSelected: string;
  textSecondary: string;
  calendarDayLogged: string;
  calendarDayUnlogged: string;
  calendarDayFuture: string;
  calendarDayOtherMonth: string;
  calendarToday: string;
  modalBackground: string;
  modalOverlay: string;
};

export type ThemePalette = {
  light?: Partial<ThemePaletteColors>;
  dark?: Partial<ThemePaletteColors>;
};

export type FeatureFlags = {
  colorSchemeToggleEnabled: boolean;
  bodyCareEnabled: boolean;
  moodStarsEnabled: boolean;
  commentsEnabled: boolean;
  todoListEnabled: boolean;
  toDiscussToggleEnabled: boolean;
  toDiscussDefaultEnabled?: boolean;
  gridPickerEnabled: boolean;
  inAppCustomizationEnabled: boolean;
};

export type AppBackgrounds = {
  calendar: string | null;
  settings: string | null;
};

export type CustomFontConfig = {
  name: string;
  dataUriOrPath?: string | null;
};

export type AppTheme = {
  name: string;
  version: number;
  palette: ThemePalette;
  font: CustomFontConfig | null;
  backgrounds: AppBackgrounds;
  features?: Partial<FeatureFlags>;
};

export type MoodThemeFile = {
  format: "simple-sleep-journal-theme";
  version: number;
  createdAt: string;
  name: string;
  palette: ThemePalette;
  font?: CustomFontConfig | null;
  backgrounds: {
    calendarBase64?: string | null;
    settingsBase64?: string | null;
  };
  features: Partial<FeatureFlags>;
};

export type BuildConfig = {
  mode: BuildMode;
  appName: string;
  packageId: string;
  features: FeatureFlags;
  lockedGrid: { rows: number; columns: number } | null;
  bakedTheme: AppTheme;
};
