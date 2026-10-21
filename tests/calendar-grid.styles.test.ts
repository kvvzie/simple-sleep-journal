import assert from "node:assert";
import test from "node:test";
import {
  getDayCellWidth,
  getDayColor,
  getDayFont,
  getDayFontSize,
  getGridRowHeight,
} from "../src/components/calendar-grid/calendar-grid.utils.ts";

test("getGridRowHeight clamps to minimum 46 and maximum 90", () => {
  // Very small screen height -> should clamp to min 46
  const minRow = getGridRowHeight(400, 8);
  assert.strictEqual(minRow, 46);

  // Very large screen height -> should clamp to max 90
  const maxRow = getGridRowHeight(2000, 4);
  assert.strictEqual(maxRow, 90);

  // Typical screen (e.g. 800px with 5 rows)
  // available = 800 - 170 - 130 = 500; raw = 500 / 5 = 100 -> clamped to 90
  const normalRow = getGridRowHeight(800, 6);
  // available = 500; raw = 500 / 6 = 83.33 -> within [46, 90]
  assert.ok(normalRow >= 46 && normalRow <= 90);
  assert.strictEqual(Math.round(normalRow), 83);
});

test("getDayFontSize scales with number of columns", () => {
  assert.strictEqual(getDayFontSize(4), 36);
  assert.strictEqual(getDayFontSize(5), 36);
  assert.strictEqual(getDayFontSize(6), 30);
  assert.strictEqual(getDayFontSize(7), 26);
  assert.strictEqual(getDayFontSize(8), 22);
});

test("getDayCellWidth calculates floored width correctly", () => {
  assert.strictEqual(getDayCellWidth(350, 7), 50);
  assert.strictEqual(getDayCellWidth(355, 7), 50);
  assert.strictEqual(getDayCellWidth(320, 5), 64);
});

test("getDayColor returns correct color for each day type", () => {
  const mockColors = {
    calendarToday: "#TODAY",
    calendarDayLogged: "#LOGGED",
    calendarDayFuture: "#FUTURE",
    calendarDayOtherMonth: "#OTHER",
    calendarDayUnlogged: "#UNLOGGED",
  };

  assert.strictEqual(getDayColor("today", mockColors), "#TODAY");
  assert.strictEqual(getDayColor("logged", mockColors), "#LOGGED");
  assert.strictEqual(getDayColor("future", mockColors), "#FUTURE");
  assert.strictEqual(getDayColor("otherMonth", mockColors), "#OTHER");
  assert.strictEqual(getDayColor("unlogged", mockColors), "#UNLOGGED");
  assert.strictEqual(getDayColor("unknown", mockColors), "#UNLOGGED");
});

test("getDayFont returns appropriate Redaction font weights", () => {
  assert.strictEqual(getDayFont("today"), "Redaction35-Bold");
  assert.strictEqual(getDayFont("logged"), "Redaction35-Regular");
  assert.strictEqual(getDayFont("unlogged"), "Redaction35-Italic");
  assert.strictEqual(getDayFont("future"), "Redaction35-Italic");
  assert.strictEqual(getDayFont("otherMonth"), "Redaction35-Italic");
});
