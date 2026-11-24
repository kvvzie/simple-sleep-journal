import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluatePinchZoomStep,
  formatCompactWeekDateRange,
  formatFullWeekDateRange,
  formatWeekHeaderParts,
  formatWeekTopicSummary,
  getHalfYearWeekCells,
  getIsoMonthForIsoWeek,
  getIsoQuarterForIsoWeek,
  getIsoWeekFromIsoDateStr,
  getIsoWeekFromYmd,
  getIsoWeeksInYear,
  getMonthQuincunxLayout,
  getMonthWeekCells,
  getMoveTargetForTopic,
  getQuarterForIsoWeek,
  getQuarterMonthColumns,
  getQuarterStarLayout,
  getQuarterWeekCells,
  getWeekCellColor,
  getWeekCellFont,
  getWeekDateRange,
  HALF_YEAR_TOTAL_CELLS,
  isRecapPageNear,
  pageToYearHalf,
  pageToYearMonthIndex,
  pageToYearQuarter,
  sanitizeImportedDiscussionTopics,
  shouldApplyPinchCooldown,
  stepWeekKey,
  yearHalfToPage,
  yearMonthIndexToPage,
  yearQuarterToPage,
} from "../src/components/to-discuss/to-discuss.utils.ts";

test("ISO-8601 week math identifies 2026-W16 as April 13-19 and 53 weeks in 2026", () => {
  assert.equal(getIsoWeeksInYear(2025), 52);
  assert.equal(getIsoWeeksInYear(2026), 53);
  assert.equal(getIsoWeeksInYear(2027), 52);

  assert.equal(getIsoWeekFromIsoDateStr("2026-04-13")?.weekKey, "2026-W16");
  assert.equal(getIsoWeekFromIsoDateStr("2026-04-19")?.weekKey, "2026-W16");
  assert.deepEqual(formatWeekHeaderParts(2026, 16), {
    weekLabel: "W16",
    dateRangeLabel: "13 - 19 april",
  });
  assert.deepEqual(formatWeekHeaderParts(2026, 49), {
    weekLabel: "W49",
    dateRangeLabel: "30 november - 6 december",
  });

  // Jan 1 2027 (Friday) still belongs to 2026-W53 in ISO-8601
  assert.equal(getIsoWeekFromYmd(2027, 0, 1).weekKey, "2026-W53");
  // Dec 28 2025 is 2025-W52, Dec 29 2025 is 2026-W01
  assert.equal(getIsoWeekFromIsoDateStr("2025-12-28")?.weekKey, "2025-W52");
  assert.equal(getIsoWeekFromIsoDateStr("2025-12-29")?.weekKey, "2026-W01");
});

test("getWeekDateRange spans Monday through Sunday across month and year transitions", () => {
  const w1 = getWeekDateRange(2026, 1);
  assert.equal(w1.startDateStr, "2025-12-29");
  assert.equal(w1.endDateStr, "2026-01-04");
  assert.deepEqual(formatWeekHeaderParts(2026, 1), {
    weekLabel: "W1",
    dateRangeLabel: "29 december - 4 january",
  });

  const w53 = getWeekDateRange(2026, 53);
  assert.equal(w53.startDateStr, "2026-12-28");
  assert.equal(w53.endDateStr, "2027-01-03");
});

test("getHalfYearWeekCells starts H1 at 1..28 and H2 at 28..end + next-year 1,2 with futureLogged italic", () => {
  const logged = new Set(["2026-W10", "2026-W20", "2026-W53", "2027-W01"]);
  const colors = { text: "#fff", textSecondary: "#888" };

  const h1_2026 = getHalfYearWeekCells(2026, 1, logged, "2026-W16");
  assert.equal(h1_2026.length, HALF_YEAR_TOTAL_CELLS);
  assert.equal(h1_2026[0].week, 1);
  assert.equal(h1_2026[0].weekYear, 2026);
  assert.equal(h1_2026[0].monthShortLabel, "jan");
  assert.equal(h1_2026[1].monthShortLabel, "jan");
  assert.equal(h1_2026[15].monthShortLabel, "apr");
  assert.equal(h1_2026[0].isOutsideHalf, false);
  assert.equal(h1_2026[9].type, "logged");
  assert.equal(getWeekCellFont("logged"), "Redaction35-Regular");
  assert.equal(h1_2026[15].weekKey, "2026-W16");
  assert.equal(h1_2026[15].type, "current");
  assert.equal(getWeekCellFont("current"), "Redaction35-Bold");
  assert.equal(h1_2026[19].type, "futureLogged");
  assert.equal(getWeekCellFont("futureLogged"), "Redaction35-Italic");
  assert.equal(getWeekCellColor("futureLogged", colors), "#fff");
  assert.equal(h1_2026[27].week, 28);
  assert.equal(h1_2026[27].weekYear, 2026);
  assert.equal(h1_2026[27].monthShortLabel, "jul");
  assert.equal(h1_2026[27].isOutsideHalf, true);

  const h2_2026 = getHalfYearWeekCells(2026, 2, logged, "2026-W16");
  assert.equal(h2_2026.length, HALF_YEAR_TOTAL_CELLS);
  assert.equal(h2_2026[0].week, 28);
  assert.equal(h2_2026[0].weekYear, 2026);
  assert.equal(h2_2026[0].monthShortLabel, "jul");
  assert.equal(h2_2026[1].monthShortLabel, "jul");
  assert.equal(h2_2026[0].isOutsideHalf, false);
  assert.equal(h2_2026[25].week, 53);
  assert.equal(h2_2026[25].type, "futureLogged");
  assert.equal(h2_2026[25].monthShortLabel, "dec");
  assert.equal(h2_2026[25].isOutsideHalf, false);
  assert.equal(h2_2026[26].week, 1);
  assert.equal(h2_2026[26].weekYear, 2027);
  assert.equal(h2_2026[26].type, "futureLogged");
  assert.equal(h2_2026[26].isOutsideHalf, true);
  assert.equal(h2_2026[26].monthShortLabel, "jan");
  assert.equal(
    getWeekCellColor(h2_2026[26].type, { ...colors, calendarDayUnlogged: "#666", calendarDayOtherMonth: "#333" }, true),
    "#666",
  );
  assert.equal(h2_2026[27].week, 2);
  assert.equal(h2_2026[27].weekYear, 2027);
  assert.equal(h2_2026[27].type, "future");
  assert.equal(h2_2026[27].isOutsideHalf, true);
  assert.equal(
    getWeekCellColor(h2_2026[27].type, { ...colors, calendarDayUnlogged: "#666", calendarDayOtherMonth: "#333" }, true),
    "#333",
  );

  const h2_2025 = getHalfYearWeekCells(2025, 2, logged, "2026-W16");
  assert.equal(h2_2025.length, HALF_YEAR_TOTAL_CELLS);
  assert.equal(h2_2025[0].week, 28);
  assert.equal(h2_2025[24].week, 52);
  assert.equal(h2_2025[25].week, 1);
  assert.equal(h2_2025[25].weekYear, 2026);
  assert.equal(h2_2025[27].week, 3);
  assert.equal(h2_2025[27].weekYear, 2026);
});

test("stepWeekKey and getMoveTargetForTopic handle past, current, future, and 53-week boundaries", () => {
  assert.equal(stepWeekKey("2026-W52", 1), "2026-W53");
  assert.equal(stepWeekKey("2026-W53", 1), "2027-W01");
  assert.equal(stepWeekKey("2025-W52", 1), "2026-W01");

  // Past week moves straight to current week without popup
  assert.deepEqual(getMoveTargetForTopic("2026-W10", "2026-W47"), {
    targetWeekKey: "2026-W47",
    requiresConfirm: false,
  });

  // Current week moves to next week with confirmation popup
  assert.deepEqual(getMoveTargetForTopic("2026-W47", "2026-W47"), {
    targetWeekKey: "2026-W48",
    requiresConfirm: true,
  });

  // Future week moves to following week with confirmation popup
  assert.deepEqual(getMoveTargetForTopic("2026-W53", "2026-W47"), {
    targetWeekKey: "2027-W01",
    requiresConfirm: true,
  });
});

test("pageToYearHalf and yearHalfToPage are exact inverses across years", () => {
  const baseYear = 2026;
  const baseHalf = 2 as const;
  const center = 60;
  for (let p = 50; p <= 70; p++) {
    const { year, half } = pageToYearHalf(p, baseYear, baseHalf, center);
    assert.equal(yearHalfToPage(year, half, baseYear, baseHalf, center), p);
  }
});

test("sanitizeImportedDiscussionTopics safely validates payloads and handles legacy missing data", () => {
  assert.deepEqual(sanitizeImportedDiscussionTopics(undefined, "2026-11-22T20:00:00.000Z"), []);

  const sanitized = sanitizeImportedDiscussionTopics(
    [
      {
        id: "t1",
        week_key: "2026-W47",
        title: "sleep anxiety",
        description: "ask about bedtime routine",
        completed: true,
        created_date: "2026-11-20",
        created_at: "2026-11-20T10:00:00.000Z",
        updated_at: "2026-11-21T11:00:00.000Z",
      },
      { title: "invalid week", week_key: "bad" },
      { title: "   ", week_key: "2026-W47" },
    ],
    "2026-11-22T20:00:00.000Z",
  );

  assert.equal(sanitized.length, 1);
  assert.equal(sanitized[0].completed, true);
  assert.equal(sanitized[0].completed_at, "2026-11-21T11:00:00.000Z");
  assert.equal(sanitized[0].created_date, "2026-11-20");
});

test("quarter helpers split ISO years cleanly including 53-week years", () => {
  assert.equal(getQuarterForIsoWeek(1), 1);
  assert.equal(getQuarterForIsoWeek(13), 1);
  assert.equal(getQuarterForIsoWeek(14), 2);
  assert.equal(getQuarterForIsoWeek(27), 3);
  assert.equal(getQuarterForIsoWeek(40), 4);
  assert.equal(getQuarterForIsoWeek(53), 4);

  const q4_2025 = getQuarterWeekCells(2025, 4, new Set(), "2026-W47");
  assert.equal(q4_2025.length, 13);
  assert.equal(q4_2025[0].week, 40);
  assert.equal(q4_2025[12].week, 52);

  const q4_2026 = getQuarterWeekCells(2026, 4, new Set(["2026-W53"]), "2026-W47");
  assert.equal(q4_2026.length, 14);
  assert.equal(q4_2026[13].week, 53);
  assert.equal(q4_2026[13].type, "futureLogged");

  for (let p = 0; p < 44; p++) {
    const { year, quarter } = pageToYearQuarter(p, 2021, 1, 0);
    assert.equal(yearQuarterToPage(year, quarter, 2021, 1, 0), p);
  }
});

test("month helpers use Thursday rule: 4 or 5 distinct weeks per month and zero duplicates across full year", () => {
  const seen2026 = new Set<string>();
  for (let m = 0; m < 12; m++) {
    const cells = getMonthWeekCells(2026, m, new Set(), "2026-W47");
    assert.ok(cells.length === 4 || cells.length === 5);
    for (const c of cells) {
      assert.equal(seen2026.has(c.weekKey), false);
      seen2026.add(c.weekKey);
      const assigned = getIsoMonthForIsoWeek(c.weekYear, c.week);
      assert.equal(assigned.year, 2026);
      assert.equal(assigned.month, m);
    }
  }
  // 2026 has 53 ISO weeks, all partitioned cleanly across Jan..Dec
  assert.equal(seen2026.size, 53);

  assert.equal(formatCompactWeekDateRange(2026, 49), "30 nov - 6 dec");
  assert.equal(formatCompactWeekDateRange(2026, 16), "13 - 19 apr");

  for (let p = 0; p < 132; p++) {
    const { year, month } = pageToYearMonthIndex(p, 2021, 0, 0);
    assert.equal(yearMonthIndexToPage(year, month, 2021, 0, 0), p);
  }
});

test("geometric star and month quincunx layouts return symmetric non-overlapping positions", () => {
  const star13 = getQuarterStarLayout(13);
  assert.equal(star13.length, 13);
  assert.equal(star13[0].xRatio, 0.5);
  assert.equal(star13[7].xRatio, 0.5);
  assert.equal(star13[10].xRatio, 0.5);

  const star14 = getQuarterStarLayout(14);
  assert.equal(star14.length, 14);
  // Center heart splits symmetrically for 14-week quarters
  assert.ok(star14[7].xRatio < 0.5 && star14[8].xRatio > 0.5);
  assert.equal(star14[7].yRatio, star14[8].yRatio);

  const month4 = getMonthQuincunxLayout(4);
  assert.equal(month4.length, 4);
  assert.equal(month4[0].yRatio, month4[1].yRatio);
  assert.equal(month4[2].yRatio, month4[3].yRatio);

  const month5 = getMonthQuincunxLayout(5);
  assert.equal(month5.length, 5);
  assert.equal(month5[2].xRatio, 0.5);
  assert.equal(month5[2].yRatio, 0.5);
});

test("getQuarterMonthColumns groups all weeks cleanly by the 3 calendar months per quarter", () => {
  const seen = new Set<string>();
  for (const q of [1, 2, 3, 4] as const) {
    const cols = getQuarterMonthColumns(2026, q, new Set(["2026-W53"]), "2026-W47");
    assert.equal(cols.length, 3);
    for (const col of cols) {
      assert.ok(col.cells.length === 4 || col.cells.length === 5);
      for (const c of col.cells) {
        assert.equal(seen.has(c.weekKey), false);
        seen.add(c.weekKey);
        assert.deepEqual(getIsoQuarterForIsoWeek(c.weekYear, c.week), {
          year: 2026,
          quarter: q,
        });
      }
    }
  }
  assert.equal(seen.size, 53);
});

test("formatFullWeekDateRange and formatWeekTopicSummary format rich month metadata cleanly", () => {
  assert.equal(formatFullWeekDateRange(2026, 16), "13 - 19 april");
  assert.equal(formatFullWeekDateRange(2026, 49), "30 nov - 6 dec");

  assert.deepEqual(formatWeekTopicSummary(undefined), {
    statusLabel: "no notes",
    previewTitle: null,
  });
  assert.deepEqual(
    formatWeekTopicSummary({
      totalCount: 3,
      openCount: 2,
      doneCount: 1,
      firstOpenTitle: "sleep hygiene",
      firstTitle: "meds check",
    }),
    {
      statusLabel: "2 open · 1 done",
      previewTitle: "sleep hygiene",
    },
  );
  assert.deepEqual(
    formatWeekTopicSummary({
      totalCount: 2,
      openCount: 0,
      doneCount: 2,
      firstOpenTitle: null,
      firstTitle: "journal setup",
    }),
    {
      statusLabel: "2 done",
      previewTitle: "journal setup",
    },
  );
});

test("isRecapPageNear isolates single page during zoom transition and opens generous buffer once settled", () => {
  assert.equal(
    isRecapPageNear({
      p: 18,
      page: 19,
      preloadedPage: 19,
      zoomLevel: "quarter",
      zoomBufferReady: false,
      transitionActive: true,
    }),
    false,
  );
  assert.equal(
    isRecapPageNear({
      p: 19,
      page: 19,
      preloadedPage: 19,
      zoomLevel: "quarter",
      zoomBufferReady: false,
      transitionActive: true,
    }),
    true,
  );
  // Quarter keeps +-10 quarters warm when settled
  assert.equal(
    isRecapPageNear({
      p: 29,
      page: 19,
      preloadedPage: 19,
      zoomLevel: "quarter",
      zoomBufferReady: true,
      transitionActive: false,
    }),
    true,
  );
  // Month keeps +-8 months + +-1/+-2 years warm
  assert.equal(
    isRecapPageNear({
      p: 58 + 24,
      page: 58,
      preloadedPage: 58,
      zoomLevel: "month",
      zoomBufferReady: true,
      transitionActive: false,
    }),
    true,
  );
  // Half warms all 22 pages when settled
  assert.equal(
    isRecapPageNear({
      p: 0,
      page: 21,
      preloadedPage: 21,
      zoomLevel: "half",
      zoomBufferReady: true,
      transitionActive: false,
    }),
    true,
  );
});

test("shouldApplyPinchCooldown only guards aborted pinches, never completed zooms", () => {
  assert.equal(shouldApplyPinchCooldown(true, false), true);
  assert.equal(shouldApplyPinchCooldown(true, true), false);
  assert.equal(shouldApplyPinchCooldown(false, true), false);
  assert.equal(shouldApplyPinchCooldown(false, false), false);
});

test("evaluatePinchZoomStep requires a deliberate large continuation for Stage-2 skips", () => {
  // Subtle drift (200 -> 236px, 1.18x, +36px) must NOT prematurely jump zoom levels
  assert.equal(
    evaluatePinchZoomStep({
      currentZoomLevel: "half",
      anchorDist: 200,
      currentDist: 236,
      stage: 0,
      allowedDirection: null,
    }),
    null,
  );

  // Stage 0 (deliberate pinch from half): 200 -> 252px (+52px, 1.26x) triggers quarter
  assert.deepEqual(
    evaluatePinchZoomStep({
      currentZoomLevel: "half",
      anchorDist: 200,
      currentDist: 252,
      stage: 0,
      allowedDirection: null,
    }),
    { nextLevel: "quarter", direction: "in" },
  );

  // Stage 1 (continuing same pinch on quarter): small/moderate extra drift (+75px, 1.31x) must NOT skip quarter
  assert.equal(
    evaluatePinchZoomStep({
      currentZoomLevel: "quarter",
      anchorDist: 244,
      currentDist: 319,
      stage: 1,
      allowedDirection: "in",
    }),
    null,
  );

  // Stage 1 with deliberate wide spread (+96px AND 1.39x) cleanly continues to month
  assert.deepEqual(
    evaluatePinchZoomStep({
      currentZoomLevel: "quarter",
      anchorDist: 244,
      currentDist: 340,
      stage: 1,
      allowedDirection: "in",
    }),
    { nextLevel: "month", direction: "in" },
  );

  // Stage 1 zoom-out: small extra pinch (-60px, 0.85x) ignored, deliberate pinch (-140px, 0.65x) goes quarter -> half
  assert.equal(
    evaluatePinchZoomStep({
      currentZoomLevel: "quarter",
      anchorDist: 400,
      currentDist: 340,
      stage: 1,
      allowedDirection: "out",
    }),
    null,
  );
  // Boundary check: -90px & 0.65x (>= 85px and <= 0.66x) on narrower squeeze also triggers
  assert.deepEqual(
    evaluatePinchZoomStep({
      currentZoomLevel: "quarter",
      anchorDist: 260,
      currentDist: 170,
      stage: 1,
      allowedDirection: "out",
    }),
    { nextLevel: "half", direction: "out" },
  );
  assert.deepEqual(
    evaluatePinchZoomStep({
      currentZoomLevel: "quarter",
      anchorDist: 400,
      currentDist: 260,
      stage: 1,
      allowedDirection: "out",
    }),
    { nextLevel: "half", direction: "out" },
  );

  // Reversing direction mid-Stage-1 does not trigger
  assert.equal(
    evaluatePinchZoomStep({
      currentZoomLevel: "quarter",
      anchorDist: 400,
      currentDist: 620,
      stage: 1,
      allowedDirection: "out",
    }),
    null,
  );
});
