import { useSettings } from "@/contexts/settings-context";
import { useColorScheme } from "react-native";

export function useAppColorScheme(): "light" | "dark" {
  const system = useColorScheme();
  const { colorSchemePref } = useSettings();
  if (colorSchemePref === "automatic")
    return system === "dark" ? "dark" : "light";
  return colorSchemePref;
}
