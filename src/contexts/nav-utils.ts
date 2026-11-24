export type ScreenKey = "calendar" | "to-discuss" | "settings";

export function getVisibleTabs(toDiscussEnabled: boolean): ScreenKey[] {
  return toDiscussEnabled
    ? ["calendar", "to-discuss", "settings"]
    : ["calendar", "settings"];
}

export function resolveVisibleScreen(
  screen: ScreenKey,
  toDiscussEnabled: boolean,
): ScreenKey {
  if (!toDiscussEnabled && screen === "to-discuss") {
    return "calendar";
  }
  return screen;
}

export function getTabIndex(
  screen: ScreenKey,
  toDiscussEnabled: boolean,
): number {
  const tabs = getVisibleTabs(toDiscussEnabled);
  const idx = tabs.indexOf(resolveVisibleScreen(screen, toDiscussEnabled));
  return idx >= 0 ? idx : 0;
}

export function getNextTabIndexOnSwipe(
  activeIndex: number,
  dx: number,
  tabCount: number,
  threshold = 12,
): number | null {
  if (dx < -threshold && activeIndex < tabCount - 1) {
    return activeIndex + 1;
  }
  if (dx > threshold && activeIndex > 0) {
    return activeIndex - 1;
  }
  return null;
}

export function getNavProgress(screen: ScreenKey): number {
  if (screen === "calendar") return 0;
  if (screen === "to-discuss") return 0.5;
  return 1;
}

export function getNavBarBottomOffset(bottomInset: number): number {
  return Math.max(24, bottomInset + 12);
}

export function getNavBarClearance(bottomInset: number): number {
  return 102 + getNavBarBottomOffset(bottomInset);
}
