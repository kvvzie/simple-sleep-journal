import { BASE_PALETTE, DEFAULT_FEATURE_FLAGS, DEFAULT_THEME } from "../constants/default-theme.ts";
import type {
  AppTheme,
  BuildMode,
  FeatureFlags,
  MoodThemeFile,
  ThemePalette,
  ThemePaletteColors,
} from "../types/appearance.ts";

export const THEME_FORMAT_IDENTIFIER = "simple-sleep-journal-theme";

export function resolveEffectiveColors(
  scheme: "light" | "dark",
  palette?: ThemePalette,
): ThemePaletteColors {
  const base = BASE_PALETTE[scheme];
  const overrides = palette?.[scheme] || {};
  const textColor = overrides.text || base.text;
  const textSecondaryColor = overrides.textSecondary || base.textSecondary;
  return {
    ...base,
    calendarDayLogged: textColor,
    calendarToday: textColor,
    calendarDayUnlogged: textSecondaryColor,
    ...overrides,
  };
}

export function serializeMoodTheme(
  theme: AppTheme,
  options?: { createdAt?: string },
): MoodThemeFile {
  return {
    format: THEME_FORMAT_IDENTIFIER,
    version: 1,
    createdAt: options?.createdAt || new Date().toISOString(),
    name: theme.name || "Custom Look",
    palette: theme.palette || {},
    font: theme.font || null,
    backgrounds: {
      calendarBase64: theme.backgrounds?.calendar || null,
      toDiscussBase64: theme.backgrounds?.toDiscuss || null,
      settingsBase64: theme.backgrounds?.settings || null,
    },
    features: theme.features || {},
  };
}

export function parseAndValidateMoodTheme(
  input: unknown,
): { valid: true; theme: AppTheme } | { valid: false; error: string } {
  if (!input || typeof input !== "object") {
    return { valid: false, error: "Invalid theme format: payload is not an object" };
  }

  const raw = input as Record<string, unknown>;
  const target =
    raw.format === THEME_FORMAT_IDENTIFIER && raw.theme && typeof raw.theme === "object"
      ? (raw.theme as Record<string, unknown>)
      : raw;

  if (raw.format !== THEME_FORMAT_IDENTIFIER) {
    if (!target.palette && !target.backgrounds && !target.font) {
      return {
        valid: false,
        error: "Unrecognized theme format: missing required theme structure",
      };
    }
  }

  const name =
    typeof target.name === "string" && target.name.trim().length > 0
      ? target.name
      : "Imported Theme";
  const palette: ThemePalette = {};

  if (target.palette && typeof target.palette === "object") {
    const rawPalette = target.palette as Record<string, unknown>;
    if (rawPalette.light && typeof rawPalette.light === "object") {
      palette.light = rawPalette.light as Partial<ThemePaletteColors>;
    }
    if (rawPalette.dark && typeof rawPalette.dark === "object") {
      palette.dark = rawPalette.dark as Partial<ThemePaletteColors>;
    }
  }

  let font: AppTheme["font"] = null;
  if (target.font && typeof target.font === "object") {
    const rawFont = target.font as Record<string, unknown>;
    if (typeof rawFont.name === "string" && rawFont.name.trim().length > 0) {
      font = {
        name: rawFont.name.trim(),
        dataUriOrPath: typeof rawFont.dataUriOrPath === "string" ? rawFont.dataUriOrPath : null,
      };
    }
  }

  const backgrounds: AppTheme["backgrounds"] = {
    calendar: null,
    toDiscuss: null,
    settings: null,
  };

  if (target.backgrounds && typeof target.backgrounds === "object") {
    const rawBg = target.backgrounds as Record<string, unknown>;
    if (typeof rawBg.calendarBase64 === "string") {
      backgrounds.calendar = rawBg.calendarBase64;
    } else if (typeof rawBg.calendar === "string") {
      backgrounds.calendar = rawBg.calendar;
    }

    if (typeof rawBg.toDiscussBase64 === "string") {
      backgrounds.toDiscuss = rawBg.toDiscussBase64;
    } else if (typeof rawBg.toDiscuss === "string") {
      backgrounds.toDiscuss = rawBg.toDiscuss;
    } else if (typeof rawBg.weeklyRecapsBase64 === "string") {
      backgrounds.toDiscuss = rawBg.weeklyRecapsBase64;
    } else if (typeof rawBg.weeklyRecaps === "string") {
      backgrounds.toDiscuss = rawBg.weeklyRecaps;
    }

    if (typeof rawBg.settingsBase64 === "string") {
      backgrounds.settings = rawBg.settingsBase64;
    } else if (typeof rawBg.settings === "string") {
      backgrounds.settings = rawBg.settings;
    }
  }

  const features: Partial<FeatureFlags> = {};
  if (target.features && typeof target.features === "object") {
    const rawFeat = target.features as Record<string, unknown>;
    if (typeof rawFeat.colorSchemeToggleEnabled === "boolean") {
      features.colorSchemeToggleEnabled = rawFeat.colorSchemeToggleEnabled;
    }
    if (typeof rawFeat.bodyCareEnabled === "boolean") {
      features.bodyCareEnabled = rawFeat.bodyCareEnabled;
    }
    if (typeof rawFeat.moodStarsEnabled === "boolean") {
      features.moodStarsEnabled = rawFeat.moodStarsEnabled;
    }
    if (typeof rawFeat.commentsEnabled === "boolean") {
      features.commentsEnabled = rawFeat.commentsEnabled;
    }
    if (typeof rawFeat.todoListEnabled === "boolean") {
      features.todoListEnabled = rawFeat.todoListEnabled;
    }
    if (typeof rawFeat.toDiscussToggleEnabled === "boolean") {
      features.toDiscussToggleEnabled = rawFeat.toDiscussToggleEnabled;
    }
    if (typeof rawFeat.toDiscussDefaultEnabled === "boolean") {
      features.toDiscussDefaultEnabled = rawFeat.toDiscussDefaultEnabled;
    }
    if (typeof rawFeat.gridPickerEnabled === "boolean") {
      features.gridPickerEnabled = rawFeat.gridPickerEnabled;
    }
    if (typeof rawFeat.inAppCustomizationEnabled === "boolean") {
      features.inAppCustomizationEnabled = rawFeat.inAppCustomizationEnabled;
    }
  }

  return {
    valid: true,
    theme: {
      name,
      version: 1,
      palette,
      font,
      backgrounds,
      features,
    },
  };
}

export function getResetDefaults(
  mode: BuildMode,
  bakedTheme: AppTheme,
  bakedFeatures: FeatureFlags,
): { theme: AppTheme; features: FeatureFlags } {
  if (mode === "baked") {
    return {
      theme: { ...bakedTheme },
      features: { ...bakedFeatures },
    };
  }

  return {
    theme: { ...DEFAULT_THEME },
    features: {
      ...DEFAULT_FEATURE_FLAGS,
      inAppCustomizationEnabled: mode === "dynamic",
    },
  };
}

export function isThemeExportAllowed(mode: BuildMode): boolean {
  return mode !== "default";
}

export function isThemeImportAllowed(_mode: BuildMode): boolean {
  return true;
}

export function isThemeModifiedFromDefaults(
  mode: BuildMode,
  theme: AppTheme,
  bakedTheme: AppTheme,
  currentFeatures?: Partial<FeatureFlags>,
  bakedFeatures?: FeatureFlags,
): boolean {
  const targetDefault = mode === "baked" ? bakedTheme : DEFAULT_THEME;
  const currentDark = theme.palette?.dark || {};
  const currentLight = theme.palette?.light || {};
  const defaultDark = targetDefault.palette?.dark || {};
  const defaultLight = targetDefault.palette?.light || {};

  if (JSON.stringify(currentDark) !== JSON.stringify(defaultDark)) return true;
  if (JSON.stringify(currentLight) !== JSON.stringify(defaultLight)) return true;

  const currentFont = theme.font?.name || null;
  const defaultFont = targetDefault.font?.name || null;
  if (currentFont !== defaultFont) return true;

  const currentCalBg = theme.backgrounds?.calendar || null;
  const defaultCalBg = targetDefault.backgrounds?.calendar || null;
  if (currentCalBg !== defaultCalBg) return true;

  const currentToDiscussBg = theme.backgrounds?.toDiscuss || null;
  const defaultToDiscussBg = targetDefault.backgrounds?.toDiscuss || null;
  if (currentToDiscussBg !== defaultToDiscussBg) return true;

  const currentSetBg = theme.backgrounds?.settings || null;
  const defaultSetBg = targetDefault.backgrounds?.settings || null;
  if (currentSetBg !== defaultSetBg) return true;

  const targetFeatures: Partial<FeatureFlags> =
    mode === "baked"
      ? (bakedFeatures || bakedTheme.features || DEFAULT_FEATURE_FLAGS)
      : {
          ...DEFAULT_FEATURE_FLAGS,
          inAppCustomizationEnabled: mode === "dynamic",
        };

  const activeFeatures = currentFeatures || theme.features;
  if (activeFeatures) {
    if (
      activeFeatures.bodyCareEnabled !== undefined &&
      activeFeatures.bodyCareEnabled !== targetFeatures.bodyCareEnabled
    ) {
      return true;
    }
    if (
      activeFeatures.moodStarsEnabled !== undefined &&
      activeFeatures.moodStarsEnabled !== targetFeatures.moodStarsEnabled
    ) {
      return true;
    }
    if (
      activeFeatures.commentsEnabled !== undefined &&
      activeFeatures.commentsEnabled !== targetFeatures.commentsEnabled
    ) {
      return true;
    }
    if (
      activeFeatures.todoListEnabled !== undefined &&
      activeFeatures.todoListEnabled !== targetFeatures.todoListEnabled
    ) {
      return true;
    }
    if (
      activeFeatures.toDiscussToggleEnabled !== undefined &&
      activeFeatures.toDiscussToggleEnabled !== targetFeatures.toDiscussToggleEnabled
    ) {
      return true;
    }
    if (
      activeFeatures.toDiscussToggleEnabled === false &&
      activeFeatures.toDiscussDefaultEnabled !== undefined &&
      activeFeatures.toDiscussDefaultEnabled !==
        (targetFeatures.toDiscussDefaultEnabled ?? true)
    ) {
      return true;
    }
    if (
      activeFeatures.gridPickerEnabled !== undefined &&
      activeFeatures.gridPickerEnabled !== targetFeatures.gridPickerEnabled
    ) {
      return true;
    }
    if (
      activeFeatures.colorSchemeToggleEnabled !== undefined &&
      activeFeatures.colorSchemeToggleEnabled !== targetFeatures.colorSchemeToggleEnabled
    ) {
      return true;
    }
  }

  return false;
}

export type FontVariant = "display" | "title" | "bold" | "regular" | "italic";

export function resolveFontFamily(
  variant: FontVariant,
  customFontName?: string | null,
): string {
  if (customFontName && customFontName.trim().length > 0) {
    return customFontName.trim();
  }

  switch (variant) {
    case "display":
      return "Redaction70-Bold";
    case "title":
      return "Redaction50-Bold";
    case "bold":
      return "Redaction35-Bold";
    case "regular":
      return "Redaction35-Regular";
    case "italic":
      return "Redaction35-Italic";
  }
}
