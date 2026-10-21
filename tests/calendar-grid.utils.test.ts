import assert from "node:assert";
import test from "node:test";
import {
  getCalendarDays,
  MONTH_NAMES,
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
