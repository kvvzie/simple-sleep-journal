import { useSettings } from "@/contexts/settings-context";
import { useCallback, useSyncExternalStore } from "react";
import { Appearance } from "react-native";
import { resolveColorScheme } from "./color-scheme.utils";

const noopSubscribe = () => () => {};

function subscribeSystemAppearance(onStoreChange: () => void) {
  const subscription = Appearance.addChangeListener(onStoreChange);
  return () => subscription.remove();
}

export function useAppColorScheme(): "light" | "dark" {
  const { colorSchemePref } = useSettings();
  const isAutomatic = colorSchemePref === "automatic";

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      isAutomatic ? subscribeSystemAppearance(onStoreChange) : noopSubscribe(),
    [isAutomatic],
  );

  const getSnapshot = useCallback(
    () => (isAutomatic ? Appearance.getColorScheme() : colorSchemePref),
    [isAutomatic, colorSchemePref],
  );

  const schemeSnapshot = useSyncExternalStore(subscribe, getSnapshot);

  return resolveColorScheme(
    colorSchemePref,
    schemeSnapshot === "dark" || schemeSnapshot === "light"
      ? schemeSnapshot
      : null,
  );
}
