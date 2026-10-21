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

  if (raw.format !== THEME_FORMAT_IDENTIFIER) {
    if (!raw.palette && !raw.backgrounds && !raw.font) {
      return {
        valid: false,
        error: "Unrecognized theme format: missing required theme structure",
      };
    }
  }

  const name = typeof raw.name === "string" && raw.name.trim().length > 0 ? raw.name : "Imported Theme";
  const palette: ThemePalette = {};

  if (raw.palette && typeof raw.palette === "object") {
    const rawPalette = raw.palette as Record<string, unknown>;
    if (rawPalette.light && typeof rawPalette.light === "object") {
      palette.light = rawPalette.light as Partial<ThemePaletteColors>;
    }
    if (rawPalette.dark && typeof rawPalette.dark === "object") {
      palette.dark = rawPalette.dark as Partial<ThemePaletteColors>;
    }
  }

  let font: AppTheme["font"] = null;
  if (raw.font && typeof raw.font === "object") {
    const rawFont = raw.font as Record<string, unknown>;
    if (typeof rawFont.name === "string" && rawFont.name.trim().length > 0) {
      font = {
        name: rawFont.name.trim(),
        dataUriOrPath: typeof rawFont.dataUriOrPath === "string" ? rawFont.dataUriOrPath : null,
      };
    }
  }

  const backgrounds: AppTheme["backgrounds"] = {
    calendar: null,
    settings: null,
  };

  if (raw.backgrounds && typeof raw.backgrounds === "object") {
    const rawBg = raw.backgrounds as Record<string, unknown>;
    if (typeof rawBg.calendarBase64 === "string") {
      backgrounds.calendar = rawBg.calendarBase64;
    } else if (typeof rawBg.calendar === "string") {
      backgrounds.calendar = rawBg.calendar;
    }

    if (typeof rawBg.settingsBase64 === "string") {
      backgrounds.settings = rawBg.settingsBase64;
    } else if (typeof rawBg.settings === "string") {
      backgrounds.settings = rawBg.settings;
    }
  }

  const features: Partial<FeatureFlags> = {};
  if (raw.features && typeof raw.features === "object") {
    const rawFeat = raw.features as Record<string, unknown>;
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
