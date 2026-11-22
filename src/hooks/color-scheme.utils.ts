export type AppColorSchemePref = "light" | "automatic" | "dark";
export type ResolvedColorScheme = "light" | "dark";

export function resolveColorScheme(
  pref: AppColorSchemePref,
  systemScheme: "light" | "dark" | null | undefined,
): ResolvedColorScheme {
  if (pref === "automatic") {
    return systemScheme === "dark" ? "dark" : "light";
  }
  return pref;
}

export function getNativeAppearanceOverride(
  pref: AppColorSchemePref,
): "light" | "dark" | "auto" {
  return pref === "automatic" ? "auto" : pref;
}
