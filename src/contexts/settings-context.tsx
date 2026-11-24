import { GridSize, GRID_STEPS } from "@/constants/grid";
import { getNativeAppearanceOverride } from "@/hooks/color-scheme.utils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, AppState, Platform, useWindowDimensions } from "react-native";

export type ColorSchemePref = "light" | "automatic" | "dark";
export { GridSize, GRID_STEPS };

type SettingsState = {
  stepIndex: number;
  rows: number;
  columns: number;
  colorSchemePref: ColorSchemePref;
  toDiscussEnabled: boolean;
  loaded: boolean;
  setStepIndex: (index: number) => void;
  setColorSchemePref: (pref: ColorSchemePref) => void;
  setToDiscussEnabled: (enabled: boolean) => void;
};

const SettingsContext = createContext<SettingsState | null>(null);
const STORAGE_KEY = "sleepinapp.settings";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isWideScreen = width > 500;

  const [stepIndexNarrow, setStepIndexNarrow] = useState(3);
  const [stepIndexWide, setStepIndexWide] = useState(1);
  const [colorSchemePref, setColorSchemePrefState] =
    useState<ColorSchemePref>("automatic");
  const [toDiscussEnabled, setToDiscussEnabledState] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed.stepIndexNarrow === "number")
            setStepIndexNarrow(parsed.stepIndexNarrow);
          if (typeof parsed.stepIndexWide === "number")
            setStepIndexWide(parsed.stepIndexWide);
          if (
            typeof parsed.stepIndex === "number" &&
            typeof parsed.stepIndexNarrow !== "number"
          ) {
            setStepIndexNarrow(parsed.stepIndex);
            setStepIndexWide(parsed.stepIndex);
          }
          if (parsed.colorSchemePref)
            setColorSchemePrefState(parsed.colorSchemePref);
          if (typeof parsed.toDiscussEnabled === "boolean")
            setToDiscussEnabledState(parsed.toDiscussEnabled);
        } catch {}
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stepIndexNarrow,
        stepIndexWide,
        colorSchemePref,
        toDiscussEnabled,
      }),
    );
  }, [stepIndexNarrow, stepIndexWide, colorSchemePref, toDiscussEnabled, loaded]);

  useEffect(() => {
    if (!loaded || Platform.OS === "web") return;
    const applyNativeOverride = () => {
      try {
        Appearance.setColorScheme(getNativeAppearanceOverride(colorSchemePref));
      } catch {}
    };
    applyNativeOverride();

    if (colorSchemePref === "automatic") return;

    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") applyNativeOverride();
    });
    const appearanceSub = Appearance.addChangeListener(applyNativeOverride);
    return () => {
      appStateSub.remove();
      appearanceSub.remove();
    };
  }, [colorSchemePref, loaded]);

  const stepIndex = isWideScreen ? stepIndexWide : stepIndexNarrow;

  const setStepIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(GRID_STEPS.length - 1, index));
      if (isWideScreen) {
        setStepIndexWide(clamped);
      } else {
        setStepIndexNarrow(clamped);
      }
    },
    [isWideScreen],
  );

  const current = GRID_STEPS[stepIndex];

  const value = useMemo<SettingsState>(
    () => ({
      stepIndex,
      rows: current.rows,
      columns: current.columns,
      colorSchemePref,
      toDiscussEnabled,
      loaded,
      setStepIndex,
      setColorSchemePref: setColorSchemePrefState,
      setToDiscussEnabled: setToDiscussEnabledState,
    }),
    [
      stepIndex,
      current.rows,
      current.columns,
      colorSchemePref,
      toDiscussEnabled,
      loaded,
      setStepIndex,
    ],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
