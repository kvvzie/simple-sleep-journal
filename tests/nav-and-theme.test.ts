import assert from "node:assert";
import test from "node:test";
import {
  getNavProgress,
  getNextTabIndexOnSwipe,
  getTabIndex,
  getVisibleTabs,
  resolveVisibleScreen,
} from "../src/contexts/nav-utils.ts";
import {
  getNativeAppearanceOverride,
  resolveColorScheme,
} from "../src/hooks/color-scheme.utils.ts";

test("resolveColorScheme ignores system scheme changes when theme is locked", () => {
  assert.strictEqual(resolveColorScheme("dark", "light"), "dark");
  assert.strictEqual(resolveColorScheme("dark", "dark"), "dark");
  assert.strictEqual(resolveColorScheme("light", "dark"), "light");
  assert.strictEqual(resolveColorScheme("light", "light"), "light");
  assert.strictEqual(resolveColorScheme("automatic", "dark"), "dark");
  assert.strictEqual(resolveColorScheme("automatic", "light"), "light");
  assert.strictEqual(resolveColorScheme("automatic", null), "light");
});

test("getNativeAppearanceOverride maps automatic to auto and locked modes directly", () => {
  assert.strictEqual(getNativeAppearanceOverride("automatic"), "auto");
  assert.strictEqual(getNativeAppearanceOverride("dark"), "dark");
  assert.strictEqual(getNativeAppearanceOverride("light"), "light");
});

test("getVisibleTabs and getTabIndex handle 2-tab and 3-tab layouts cleanly", () => {
  assert.deepStrictEqual(getVisibleTabs(true), [
    "calendar",
    "to-discuss",
    "settings",
  ]);
  assert.deepStrictEqual(getVisibleTabs(false), ["calendar", "settings"]);

  // Settings index shifts cleanly from 2 to 1 when middle tab is toggled off
  assert.strictEqual(getTabIndex("settings", true), 2);
  assert.strictEqual(getTabIndex("settings", false), 1);

  assert.strictEqual(getTabIndex("to-discuss", true), 1);
  assert.strictEqual(resolveVisibleScreen("to-discuss", false), "calendar");
  assert.strictEqual(getTabIndex("to-discuss", false), 0);
});

test("getNextTabIndexOnSwipe steps cleanly within bounds", () => {
  assert.strictEqual(getNextTabIndexOnSwipe(0, -20, 3), 1);
  assert.strictEqual(getNextTabIndexOnSwipe(1, -20, 3), 2);
  assert.strictEqual(getNextTabIndexOnSwipe(2, -20, 3), null);
  assert.strictEqual(getNextTabIndexOnSwipe(2, 20, 3), 1);
  assert.strictEqual(getNextTabIndexOnSwipe(0, 20, 3), null);
  assert.strictEqual(getNextTabIndexOnSwipe(0, -20, 2), 1);
  assert.strictEqual(getNextTabIndexOnSwipe(1, 20, 2), 0);
});

test("getNavProgress keeps settings pinned at 1 and calendar at 0 regardless of tab count", () => {
  assert.strictEqual(getNavProgress("calendar"), 0);
  assert.strictEqual(getNavProgress("to-discuss"), 0.5);
  assert.strictEqual(getNavProgress("settings"), 1);
});
