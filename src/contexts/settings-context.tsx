import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";
import { useWindowDimensions } from "react-native";

export type ColorSchemePref = "light" | "automatic" | "dark";
export type GridSize = { rows: number; columns: number };

export const GRID_STEPS: GridSize[] = [
  { rows: 4, columns: 8 },
  { rows: 5, columns: 7 },
  { rows: 6, columns: 6 },
  { rows: 7, columns: 5 },
  { rows: 8, columns: 4 },
];

type SettingsState = {
  stepIndex: number;
  rows: number;
  columns: number;
  colorSchemePref: ColorSchemePref;
  loaded: boolean;
  setStepIndex: (index: number) => void;
  setColorSchemePref: (pref: ColorSchemePref) => void;
};

const SettingsContext = createContext<SettingsState | null>(null);
const STORAGE_KEY = "sleepinapp.settings";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isWideScreen = width > 500;

  const [stepIndexNarrow, setStepIndexNarrow] = useState(3); // 7x5 dla małych
  const [stepIndexWide, setStepIndexWide] = useState(1); // 4x8 dla dużych ekranów!
  const [colorSchemePref, setColorSchemePrefState] =
    useState<ColorSchemePref>("automatic");
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
          // Fallback dla starszych zapisów:
          if (
            typeof parsed.stepIndex === "number" &&
            typeof parsed.stepIndexNarrow !== "number"
          ) {
            setStepIndexNarrow(parsed.stepIndex);
            setStepIndexWide(parsed.stepIndex);
          }
          if (parsed.colorSchemePref)
            setColorSchemePrefState(parsed.colorSchemePref);
        } catch {}
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ stepIndexNarrow, stepIndexWide, colorSchemePref }),
    );
  }, [stepIndexNarrow, stepIndexWide, colorSchemePref, loaded]);

  // Wyciągamy to ustawienie, które pasuje do aktualnego ekranu
  const stepIndex = isWideScreen ? stepIndexWide : stepIndexNarrow;

  const setStepIndex = (index: number) => {
    const clamped = Math.max(0, Math.min(GRID_STEPS.length - 1, index));
    if (isWideScreen) {
      setStepIndexWide(clamped);
    } else {
      setStepIndexNarrow(clamped);
    }
  };

  const current = GRID_STEPS[stepIndex];

  return (
    <SettingsContext.Provider
      value={{
        stepIndex,
        rows: current.rows,
        columns: current.columns,
        colorSchemePref,
        loaded,
        setStepIndex,
        setColorSchemePref: setColorSchemePrefState,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
