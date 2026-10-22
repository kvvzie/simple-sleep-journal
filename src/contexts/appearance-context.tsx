import { buildConfig } from "@/constants/build-config";
import { DEFAULT_FEATURE_FLAGS, DEFAULT_THEME } from "@/constants/default-theme";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";
import { readTextFileFromUri, saveFileToDevice } from "@/lib/file-saver";
import {
  FontVariant,
  getResetDefaults,
  isThemeExportAllowed,
  isThemeImportAllowed,
  isThemeModifiedFromDefaults,
  parseAndValidateMoodTheme,
  resolveEffectiveColors,
  resolveFontFamily,
  serializeMoodTheme,
} from "@/lib/theme-utils";
import {
  AppBackgrounds,
  AppTheme,
  BuildMode,
  CustomFontConfig,
  FeatureFlags,
  ThemePaletteColors,
} from "@/types/appearance";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as Font from "expo-font";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type AppearanceContextType = {
  mode: BuildMode;
  canExportTheme: boolean;
  canImportTheme: boolean;
  isModified: boolean;
  colors: ThemePaletteColors;
  theme: AppTheme;
  features: FeatureFlags;
  backgrounds: AppBackgrounds;
  customFont: CustomFontConfig | null;
  resolveFont: (variant: FontVariant) => string;
  updateTheme: (partial: Partial<AppTheme>) => void;
  updateFeatures: (partial: Partial<FeatureFlags>) => void;
  updateColorOverride: (
    scheme: "light" | "dark",
    key: keyof ThemePaletteColors,
    color: string,
  ) => void;
  updateBackground: (screen: "calendar" | "settings", uriOrBase64: string | null) => void;
  setCustomFont: (font: CustomFontConfig | null) => Promise<boolean>;
  resetTheme: () => Promise<void>;
  exportTheme: (name?: string) => Promise<{ success: boolean; canceled?: boolean; uri?: string; error?: string }>;
  importThemeData: (raw: unknown) => Promise<{ success: boolean; error?: string }>;
  importThemeFromFile: () => Promise<{ success: boolean; canceled?: boolean; error?: string }>;
};

const AppearanceContext = createContext<AppearanceContextType | null>(null);
const STORAGE_KEY = `sleepinapp.appearance_${buildConfig.mode}_v4`;

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const scheme = useAppColorScheme();
  const [theme, setTheme] = useState<AppTheme>(() => {
    if (buildConfig.mode === "baked") {
      return buildConfig.bakedTheme;
    }
    return DEFAULT_THEME;
  });

  const [features, setFeatures] = useState<FeatureFlags>(() => buildConfig.features);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const validation = parseAndValidateMoodTheme(parsed.theme);
          if (validation.valid) {
            if (buildConfig.mode === "baked" && !parsed.isCustomImported) {
              setTheme(buildConfig.bakedTheme);
            } else {
              setTheme(validation.theme);
            }
            if (validation.theme.font?.name && validation.theme.font?.dataUriOrPath) {
              Font.loadAsync({
                [validation.theme.font.name]: validation.theme.font.dataUriOrPath,
              }).catch(() => {});
            }
          }
          if (parsed.features && typeof parsed.features === "object") {
            setFeatures((prev) => ({
              ...prev,
              ...parsed.features,
              inAppCustomizationEnabled: buildConfig.mode === "dynamic",
            }));
          }
        } catch {}
      } else {
        if (buildConfig.mode === "baked") {
          setTheme(buildConfig.bakedTheme);
          setFeatures(buildConfig.features);
        } else {
          setTheme(DEFAULT_THEME);
          setFeatures(buildConfig.features);
        }
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.getItem(STORAGE_KEY).then((existing) => {
      let isCustomImported = false;
      if (existing) {
        try {
          const p = JSON.parse(existing);
          isCustomImported = Boolean(p.isCustomImported);
        } catch {}
      }
      AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          theme,
          features,
          isCustomImported,
        }),
      ).catch(() => {});
    });
  }, [theme, features, loaded]);

  const effectiveFeatures: FeatureFlags = useMemo(() => {
    return {
      ...features,
      ...(theme.features || {}),
      inAppCustomizationEnabled: buildConfig.mode === "dynamic",
    };
  }, [features, theme.features]);

  const colors = useMemo(() => {
    return resolveEffectiveColors(scheme, theme.palette);
  }, [scheme, theme.palette]);

  const isModified = useMemo(() => {
    return isThemeModifiedFromDefaults(
      buildConfig.mode,
      theme,
      buildConfig.bakedTheme,
      effectiveFeatures,
      buildConfig.features,
    );
  }, [theme, effectiveFeatures]);

  const resolveFont = useCallback(
    (variant: FontVariant) => {
      return resolveFontFamily(variant, theme.font?.name);
    },
    [theme.font?.name],
  );

  const updateTheme = useCallback((partial: Partial<AppTheme>) => {
    setTheme((prev) => ({
      ...prev,
      ...partial,
    }));
  }, []);

  const updateFeatures = useCallback((partial: Partial<FeatureFlags>) => {
    setFeatures((prev) => ({
      ...prev,
      ...partial,
      inAppCustomizationEnabled: buildConfig.mode === "dynamic",
    }));
  }, []);

  const updateColorOverride = useCallback(
    (targetScheme: "light" | "dark", key: keyof ThemePaletteColors, color: string) => {
      setTheme((prev) => {
        const currentSchemePalette = prev.palette[targetScheme] || {};
        return {
          ...prev,
          palette: {
            ...prev.palette,
            [targetScheme]: {
              ...currentSchemePalette,
              [key]: color,
            },
          },
        };
      });
    },
    [],
  );

  const updateBackground = useCallback(
    (screen: "calendar" | "settings", uriOrBase64: string | null) => {
      setTheme((prev) => ({
        ...prev,
        backgrounds: {
          ...prev.backgrounds,
          [screen]: uriOrBase64,
        },
      }));
    },
    [],
  );

  const setCustomFont = useCallback(async (font: CustomFontConfig | null) => {
    if (!font) {
      setTheme((prev) => ({ ...prev, font: null }));
      return true;
    }

    if (font.name && font.dataUriOrPath) {
      try {
        await Font.loadAsync({ [font.name]: font.dataUriOrPath });
      } catch {
        return false;
      }
    }

    setTheme((prev) => ({ ...prev, font }));
    return true;
  }, []);

  const resetTheme = useCallback(async () => {
    const defaults = getResetDefaults(
      buildConfig.mode,
      buildConfig.bakedTheme,
      buildConfig.features,
    );
    setTheme(defaults.theme);
    setFeatures(defaults.features);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const exportTheme = useCallback(
    async (customName?: string) => {
      if (!isThemeExportAllowed(buildConfig.mode)) {
        return {
          success: false,
          error: "Theme export is disabled in Default build mode.",
        };
      }

      let cal = theme.backgrounds.calendar;
      if (cal && !cal.startsWith("data:")) {
        try {
          const { readAsStringAsync, EncodingType } = require("expo-file-system/legacy");
          const b64 = await readAsStringAsync(cal, { encoding: EncodingType.Base64 });
          cal = `data:image/jpeg;base64,${b64}`;
        } catch {}
      }

      let sett = theme.backgrounds.settings;
      if (sett && !sett.startsWith("data:")) {
        try {
          const { readAsStringAsync, EncodingType } = require("expo-file-system/legacy");
          const b64 = await readAsStringAsync(sett, { encoding: EncodingType.Base64 });
          sett = `data:image/jpeg;base64,${b64}`;
        } catch {}
      }

      const activeTheme: AppTheme = {
        ...theme,
        name: customName || theme.name || "Custom Look",
        backgrounds: {
          calendar: cal,
          settings: sett,
        },
        features: effectiveFeatures,
      };

      const fileData = serializeMoodTheme(activeTheme);
      const content = JSON.stringify(fileData, null, 2);
      const safeFileName = `${activeTheme.name.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}.moodtheme`;

      return await saveFileToDevice({
        fileName: safeFileName,
        content,
        mimeType: "application/json",
      });
    },
    [theme, effectiveFeatures],
  );

  const importThemeData = useCallback(async (raw: unknown) => {
    const res = parseAndValidateMoodTheme(raw);
    if (!res.valid) {
      return { success: false, error: res.error };
    }

    const importedTheme = res.theme;
    if (importedTheme.font?.name && importedTheme.font?.dataUriOrPath) {
      try {
        await Font.loadAsync({
          [importedTheme.font.name]: importedTheme.font.dataUriOrPath,
        });
      } catch {}
    }

    const safeTheme: AppTheme = {
      ...importedTheme,
      features: importedTheme.features
        ? {
            ...importedTheme.features,
            inAppCustomizationEnabled: buildConfig.mode === "dynamic",
          }
        : undefined,
    };

    setTheme(safeTheme);
    if (safeTheme.features) {
      setFeatures((prev) => ({
        ...prev,
        ...safeTheme.features,
        inAppCustomizationEnabled: buildConfig.mode === "dynamic",
      }));
    }

    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        theme: safeTheme,
        features: safeTheme.features || features,
        isCustomImported: true,
      }),
    ).catch(() => {});

    return { success: true };
  }, [features]);

  const importThemeFromFile = useCallback(async () => {
    try {
      const pickerRes = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/*", "*/*"],
        copyToCacheDirectory: true,
      });

      if (pickerRes.canceled || !pickerRes.assets || pickerRes.assets.length === 0) {
        return { success: false, canceled: true };
      }

      const fileUri = pickerRes.assets[0].uri;
      const text = await readTextFileFromUri(fileUri);
      const parsed = JSON.parse(text);

      return await importThemeData(parsed);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to read theme file";
      return { success: false, error: message };
    }
  }, [importThemeData]);

  const value = useMemo(
    () => ({
      mode: buildConfig.mode,
      canExportTheme: isThemeExportAllowed(buildConfig.mode),
      canImportTheme: isThemeImportAllowed(buildConfig.mode),
      isModified,
      colors,
      theme,
      features: effectiveFeatures,
      backgrounds: theme.backgrounds,
      customFont: theme.font,
      resolveFont,
      updateTheme,
      updateFeatures,
      updateColorOverride,
      updateBackground,
      setCustomFont,
      resetTheme,
      exportTheme,
      importThemeData,
      importThemeFromFile,
    }),
    [
      isModified,
      colors,
      theme,
      effectiveFeatures,
      resolveFont,
      updateTheme,
      updateFeatures,
      updateColorOverride,
      updateBackground,
      setCustomFont,
      resetTheme,
      exportTheme,
      importThemeData,
      importThemeFromFile,
    ],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error("useAppearance must be used within AppearanceProvider");
  }
  return ctx;
}
