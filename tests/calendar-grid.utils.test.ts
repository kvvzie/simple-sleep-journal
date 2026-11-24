import assert from "node:assert";
import test from "node:test";
import {
  computeWidthScale,
  evaluatePageSelected,
  getCalendarDays,
  getDragPreviewPage,
  getMonthKey,
  getScaledMeasuredWidth,
  getSwipeTargetPage,
  groupDatesByMonth,
  isScrollSettled,
  MONTH_NAMES,
  resolveCanceledSwipePage,
  SWIPE_RETURN_THRESHOLD,
  SWIPE_TRIGGER_THRESHOLD,
} from "../src/components/calendar-grid/calendar-grid.utils.ts";

test("MONTH_NAMES contains all 12 lowercase months", () => {
  assert.strictEqual(MONTH_NAMES.length, 12);
  assert.strictEqual(MONTH_NAMES[0], "january");
  assert.strictEqual(MONTH_NAMES[11], "december");
});

test("getCalendarDays returns correct number of days for February in leap and non-leap years", () => {
  const leapDays = getCalendarDays(2024, 1, new Set(), 35);
  const feb2024MonthDays = leapDays.filter((d) => d.type !== "otherMonth");
  assert.strictEqual(feb2024MonthDays.length, 29);

  const nonLeapDays = getCalendarDays(2025, 1, new Set(), 35);
  const feb2025MonthDays = nonLeapDays.filter((d) => d.type !== "otherMonth");
  assert.strictEqual(feb2025MonthDays.length, 28);
});

test("getCalendarDays pads with otherMonth days up to totalCells", () => {
  const totalCells = 42;
  const days = getCalendarDays(2026, 3, new Set(), totalCells); // April (30 days)
  assert.strictEqual(days.length, totalCells);

  const monthDays = days.filter((d) => d.type !== "otherMonth");
  const otherMonthDays = days.filter((d) => d.type === "otherMonth");

  assert.strictEqual(monthDays.length, 30);
  assert.strictEqual(otherMonthDays.length, 12);
  assert.strictEqual(otherMonthDays[0].day, 1);
  assert.strictEqual(otherMonthDays[11].day, 12);
});

test("getCalendarDays marks logged dates correctly", () => {
  const loggedSet = new Set(["2020-01-05", "2020-01-10"]);
  const days = getCalendarDays(2020, 0, loggedSet, 35);

  const day5 = days.find((d) => d.dateStr === "2020-01-05");
  const day6 = days.find((d) => d.dateStr === "2020-01-06");
  const day10 = days.find((d) => d.dateStr === "2020-01-10");

  assert.ok(day5);
  assert.strictEqual(day5.type, "logged");

  assert.ok(day6);
  assert.strictEqual(day6.type, "unlogged");

  assert.ok(day10);
  assert.strictEqual(day10.type, "logged");
});

test("getCalendarDays formats date strings with two-digit zero padding", () => {
  const days = getCalendarDays(2026, 0, new Set(), 35); // Jan 2026
  const day1 = days.find((d) => d.day === 1 && d.type !== "otherMonth");
  assert.ok(day1);
  assert.strictEqual(day1.dateStr, "2026-01-01");

  const day9 = days.find((d) => d.day === 9 && d.type !== "otherMonth");
  assert.ok(day9);
  assert.strictEqual(day9.dateStr, "2026-01-09");
});

test("getMonthKey formats zero-indexed months as YYYY-MM", () => {
  assert.strictEqual(getMonthKey(2026, 0), "2026-01");
  assert.strictEqual(getMonthKey(2026, 9), "2026-10");
  assert.strictEqual(getMonthKey(2026, 11), "2026-12");
});

test("groupDatesByMonth partitions dates into month sets and skips malformed entries", () => {
  const grouped = groupDatesByMonth([
    "2026-10-01",
    "2026-10-15",
    "2026-11-02",
    "2025-11-02",
    "bad",
  ]);
  assert.deepStrictEqual([...(grouped.get("2026-10") ?? [])], [
    "2026-10-01",
    "2026-10-15",
  ]);
  assert.deepStrictEqual([...(grouped.get("2026-11") ?? [])], ["2026-11-02"]);
  assert.deepStrictEqual([...(grouped.get("2025-11") ?? [])], ["2025-11-02"]);
  assert.strictEqual(grouped.size, 3);
});

test("computeWidthScale and getScaledMeasuredWidth fit wide labels within bounds", () => {
  const widths = { 4: 110, 8: 350 };
  assert.strictEqual(computeWidthScale(widths, 400, 0.65), 1);
  const scale = computeWidthScale(widths, 280, 0.65);
  assert.strictEqual(scale, 280 / 350);
  assert.strictEqual(getScaledMeasuredWidth(widths, 8, scale, 280), 280);
  assert.strictEqual(getScaledMeasuredWidth(widths, 4, scale, 280), 88);
  assert.strictEqual(computeWidthScale({ 8: 600 }, 280, 0.65), 0.65);
});

test("getSwipeTargetPage triggers immediately past threshold and clamps bounds", () => {
  assert.strictEqual(getSwipeTargetPage(60.0, 60, 0.06, 0, 120), null);
  assert.strictEqual(getSwipeTargetPage(59.95, 60, 0.06, 0, 120), null);
  assert.strictEqual(getSwipeTargetPage(60.05, 60, 0.06, 0, 120), null);
  assert.strictEqual(getSwipeTargetPage(59.94, 60, 0.06, 0, 120), 59);
  assert.strictEqual(getSwipeTargetPage(60.06, 60, 0.06, 0, 120), 61);
  assert.strictEqual(getSwipeTargetPage(-0.1, 0, 0.06, 0, 120), 0);
  assert.strictEqual(getSwipeTargetPage(120.1, 120, 0.06, 0, 120), 120);
});

test("evaluatePageSelected ignores stale double-swipe and peer events while accepting valid reconciliations", () => {
  assert.strictEqual(
    evaluatePageSelected({
      pos: 57,
      expectedProgrammaticPage: 58,
      activeManualSource: "grid",
      isDragging: false,
      lastScrollPos: 57.4,
      currentPage: 58,
    }),
    "ignore",
  );
  assert.strictEqual(
    evaluatePageSelected({
      pos: 58,
      expectedProgrammaticPage: 58,
      activeManualSource: null,
      isDragging: false,
      lastScrollPos: 58,
      currentPage: 58,
    }),
    "acknowledge-programmatic",
  );
  assert.strictEqual(
    evaluatePageSelected({
      pos: 57,
      expectedProgrammaticPage: undefined,
      activeManualSource: "grid",
      isDragging: true,
      lastScrollPos: 57.2,
      currentPage: 58,
    }),
    "ignore",
  );
  assert.strictEqual(
    evaluatePageSelected({
      pos: 57,
      expectedProgrammaticPage: undefined,
      activeManualSource: null,
      isDragging: false,
      lastScrollPos: 57.6,
      currentPage: 58,
    }),
    "ignore",
  );
  assert.strictEqual(
    evaluatePageSelected({
      pos: 56,
      expectedProgrammaticPage: undefined,
      activeManualSource: null,
      isDragging: false,
      lastScrollPos: 56.02,
      currentPage: 57,
    }),
    "reconcile",
  );
});

test("isScrollSettled and resolveCanceledSwipePage avoid premature idle reversion while restoring canceled swipes at zero offset", () => {
  assert.strictEqual(isScrollSettled(0), true);
  assert.strictEqual(isScrollSettled(0.002), true);
  assert.strictEqual(isScrollSettled(0.2), false);

  // Premature idle at offset = 0.2 must NOT revert 59 -> 58
  assert.strictEqual(
    resolveCanceledSwipePage({
      scrollPos: 58.2,
      offset: 0.2,
      dragAnchor: 58,
      hadMovedInGesture: true,
      currentTarget: 59,
      isDragging: false,
    }),
    null,
  );

  // Normal completion on 59 at offset = 0 performs no reversion
  assert.strictEqual(
    resolveCanceledSwipePage({
      scrollPos: 59,
      offset: 0,
      dragAnchor: 58,
      hadMovedInGesture: true,
      currentTarget: 59,
      isDragging: false,
    }),
    null,
  );

  // Genuine snap-back to dragAnchor 58 at offset = 0 reconciles back to 58
  assert.strictEqual(
    resolveCanceledSwipePage({
      scrollPos: 58,
      offset: 0,
      dragAnchor: 58,
      hadMovedInGesture: true,
      currentTarget: 59,
      isDragging: false,
    }),
    58,
  );
});

test("getCalendarDays classifies past, today, and future days accurately", () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  const pastDays = getCalendarDays(y - 1, m, new Set(), 35).filter(
    (item) => item.type !== "otherMonth",
  );
  assert.ok(pastDays.every((item) => item.type === "unlogged"));

  const futureDays = getCalendarDays(y + 1, m, new Set(), 35).filter(
    (item) => item.type !== "otherMonth",
  );
  assert.ok(futureDays.every((item) => item.type === "future"));

  const currentDays = getCalendarDays(y, m, new Set(), 35);
  const todayCell = currentDays.find(
    (item) => item.day === d && item.type !== "otherMonth",
  );
  assert.ok(todayCell);
  assert.strictEqual(todayCell.type, "today");
});

test("getDragPreviewPage restores anchorPage when reversing a drag through the center", () => {
  // Starting at november (60), dragging slightly right -> october (59)
  assert.deepStrictEqual(
    getDragPreviewPage({
      scrollPos: 59.93,
      anchorPage: 60,
      committedDir: 0,
      isDragging: true,
      triggerThreshold: 0.06,
      minPage: 0,
      maxPage: 120,
    }),
    { targetPage: 59, nextDir: -1 },
  );

  // Inside hysteresis deadzone (-0.04) stays stably on october
  assert.strictEqual(
    getDragPreviewPage({
      scrollPos: 59.96,
      anchorPage: 60,
      committedDir: -1,
      isDragging: true,
      triggerThreshold: 0.06,
      minPage: 0,
      maxPage: 120,
    }),
    null,
  );

  // Pulling back across center (-0.02) restores november (60) cleanly before crossing to december
  assert.deepStrictEqual(
    getDragPreviewPage({
      scrollPos: 59.98,
      anchorPage: 60,
      committedDir: -1,
      isDragging: true,
      triggerThreshold: 0.06,
      minPage: 0,
      maxPage: 120,
    }),
    { targetPage: 60, nextDir: 0 },
  );

  // Continuing past +0.06 moves smoothly from november -> december (61)
  assert.deepStrictEqual(
    getDragPreviewPage({
      scrollPos: 60.07,
      anchorPage: 60,
      committedDir: 0,
      isDragging: true,
      triggerThreshold: 0.06,
      minPage: 0,
      maxPage: 120,
    }),
    { targetPage: 61, nextDir: 1 },
  );
});

test("getDragPreviewPage uses wider center band with SWIPE_TRIGGER_THRESHOLD and SWIPE_RETURN_THRESHOLD", () => {
  assert.strictEqual(SWIPE_TRIGGER_THRESHOLD, 0.18);
  assert.strictEqual(SWIPE_RETURN_THRESHOLD, 0.12);

  // Small accidental movement stays anchored on november (60)
  assert.strictEqual(
    getDragPreviewPage({
      scrollPos: 59.85,
      anchorPage: 60,
      committedDir: 0,
      isDragging: true,
      triggerThreshold: SWIPE_TRIGGER_THRESHOLD,
      returnThreshold: SWIPE_RETURN_THRESHOLD,
      minPage: 0,
      maxPage: 120,
    }),
    null,
  );

  // Reaching -0.18 switches to october (59)
  assert.deepStrictEqual(
    getDragPreviewPage({
      scrollPos: 59.81,
      anchorPage: 60,
      committedDir: 0,
      isDragging: true,
      triggerThreshold: SWIPE_TRIGGER_THRESHOLD,
      returnThreshold: SWIPE_RETURN_THRESHOLD,
      minPage: 0,
      maxPage: 120,
    }),
    { targetPage: 59, nextDir: -1 },
  );

  // Pulling back across -0.12 restores november (60) generously early
  assert.deepStrictEqual(
    getDragPreviewPage({
      scrollPos: 59.89,
      anchorPage: 60,
      committedDir: -1,
      isDragging: true,
      triggerThreshold: SWIPE_TRIGGER_THRESHOLD,
      returnThreshold: SWIPE_RETURN_THRESHOLD,
      minPage: 0,
      maxPage: 120,
    }),
    { targetPage: 60, nextDir: 0 },
  );

  // Anywhere inside [-0.12, +0.17] stays stably on november (60)
  for (const pos of [59.89, 60.0, 60.09, 60.17]) {
    assert.strictEqual(
      getDragPreviewPage({
        scrollPos: pos,
        anchorPage: 60,
        committedDir: 0,
        isDragging: true,
        triggerThreshold: SWIPE_TRIGGER_THRESHOLD,
        returnThreshold: SWIPE_RETURN_THRESHOLD,
        minPage: 0,
        maxPage: 120,
      }),
      null,
    );
  }

  // Only at +0.18 does november advance to december (61)
  assert.deepStrictEqual(
    getDragPreviewPage({
      scrollPos: 60.19,
      anchorPage: 60,
      committedDir: 0,
      isDragging: true,
      triggerThreshold: SWIPE_TRIGGER_THRESHOLD,
      returnThreshold: SWIPE_RETURN_THRESHOLD,
      minPage: 0,
      maxPage: 120,
    }),
    { targetPage: 61, nextDir: 1 },
  );
});
