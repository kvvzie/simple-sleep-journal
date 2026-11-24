import assert from "node:assert/strict";
import test from "node:test";
import {
  applyHorizontalRubberBand,
  clampPagerIndex,
  clampSpringVelocity,
  getVisiblePagerIndices,
  getWindowShiftThreshold,
  isScrollOffsetSettledAtPage,
  resolveSwipeTargetPage,
  scrollXToPageScrollEvent,
  shouldShiftPagerWindow,
} from "../src/components/smooth-pager/smooth-horizontal-pager.utils.ts";

test("clampPagerIndex and getVisiblePagerIndices keep window tight and in bounds", () => {
  assert.equal(clampPagerIndex(-3, 10), 0);
  assert.equal(clampPagerIndex(4, 10), 4);
  assert.equal(clampPagerIndex(99, 10), 9);
  assert.equal(clampPagerIndex(5, 1), 0);

  assert.deepEqual(getVisiblePagerIndices(0, 121, 2), [0, 1, 2]);
  assert.deepEqual(getVisiblePagerIndices(60, 121, 2), [58, 59, 60, 61, 62]);
  assert.deepEqual(getVisiblePagerIndices(120, 121, 1), [119, 120]);
  assert.deepEqual(getVisiblePagerIndices(0, 0, 2), []);

  // Extra year-stride offsets merge cleanly without duplicates or out-of-range indices
  assert.deepEqual(getVisiblePagerIndices(60, 121, 3, [48, 72, 60]), [
    48,
    57,
    58,
    59,
    60,
    61,
    62,
    63,
    72,
  ]);
  assert.deepEqual(getVisiblePagerIndices(2, 121, 2, [-10, 14, 999]), [
    0,
    1,
    2,
    3,
    4,
    14,
  ]);
  assert.equal(getWindowShiftThreshold(1), 1);
  assert.equal(getWindowShiftThreshold(2), 2);
  assert.equal(getWindowShiftThreshold(3), 2);
});

test("scrollXToPageScrollEvent matches ViewPager position + offset contract", () => {
  const width = 360;

  assert.deepEqual(scrollXToPageScrollEvent(60 * width, width, 121), {
    position: 60,
    offset: 0,
  });

  const forward = scrollXToPageScrollEvent(60 * width + 90, width, 121);
  assert.equal(forward.position, 60);
  assert.ok(Math.abs(forward.offset - 0.25) < 1e-6);

  const backward = scrollXToPageScrollEvent(60 * width - 90, width, 121);
  assert.equal(backward.position, 59);
  assert.ok(Math.abs(backward.offset - 0.75) < 1e-6);

  assert.deepEqual(scrollXToPageScrollEvent(-40, width, 121), {
    position: 0,
    offset: 0,
  });

  assert.deepEqual(scrollXToPageScrollEvent(120 * width + 50, width, 121), {
    position: 120,
    offset: 0,
  });

  assert.deepEqual(scrollXToPageScrollEvent(100, 0, 10), {
    position: 0,
    offset: 0,
  });
});

test("shouldShiftPagerWindow leaves window stable on 1-page drags and shifts >= radius", () => {
  assert.equal(shouldShiftPagerWindow(60, 60, 2), false);
  assert.equal(shouldShiftPagerWindow(61, 60, 2), false);
  assert.equal(shouldShiftPagerWindow(59, 60, 2), false);
  assert.equal(shouldShiftPagerWindow(62, 60, 2), true);
  assert.equal(shouldShiftPagerWindow(58, 60, 2), true);

  assert.equal(shouldShiftPagerWindow(61, 60, 1), true);
  assert.equal(shouldShiftPagerWindow(61, 60, 0), true);
});

test("isScrollOffsetSettledAtPage detects integer page alignment within tolerance", () => {
  assert.equal(isScrollOffsetSettledAtPage(60 * 360, 360), true);
  assert.equal(isScrollOffsetSettledAtPage(60 * 360 + 1.2, 360), true);
  assert.equal(isScrollOffsetSettledAtPage(60 * 360 - 1.2, 360), true);
  assert.equal(isScrollOffsetSettledAtPage(60 * 360 + 8, 360), false);
  assert.equal(isScrollOffsetSettledAtPage(10, 0), true);
});

test("applyHorizontalRubberBand damps past min/max bounds and clampSpringVelocity stays safe", () => {
  const minTx = -1000;
  assert.equal(applyHorizontalRubberBand(-500, minTx), -500);
  assert.equal(applyHorizontalRubberBand(100, minTx), 25);
  assert.equal(applyHorizontalRubberBand(-1200, minTx), -1050);

  assert.equal(clampSpringVelocity(Number.NaN), 0);
  assert.equal(clampSpringVelocity(9000), 3200);
  assert.equal(clampSpringVelocity(-9000), -3200);
  assert.equal(clampSpringVelocity(-420), -420);
});

test("resolveSwipeTargetPage blends distance and release velocity cleanly", () => {
  const width = 360;
  const startScrollX = 60 * width;

  // Gentle release below snap distance returns to start page
  assert.equal(
    resolveSwipeTargetPage({
      startPage: 60,
      startScrollX,
      currentScrollX: startScrollX + 80,
      pageWidth: width,
      pageCount: 121,
      velocityX: 0,
    }),
    60,
  );

  // Drag past 35% snaps to next page even at zero velocity
  assert.equal(
    resolveSwipeTargetPage({
      startPage: 60,
      startScrollX,
      currentScrollX: startScrollX + 135,
      pageWidth: width,
      pageCount: 121,
      velocityX: 0,
    }),
    61,
  );

  // Short fast leftward flick advances 1 page (never skips 2 pages)
  assert.equal(
    resolveSwipeTargetPage({
      startPage: 60,
      startScrollX,
      currentScrollX: startScrollX + 32,
      pageWidth: width,
      pageCount: 121,
      velocityX: -2400,
    }),
    61,
  );

  // Fast rightward flick goes back 1 page
  assert.equal(
    resolveSwipeTargetPage({
      startPage: 60,
      startScrollX,
      currentScrollX: startScrollX - 24,
      pageWidth: width,
      pageCount: 121,
      velocityX: 480,
    }),
    59,
  );

  // Dragged forward then flicked back toward origin cancels back to startPage
  assert.equal(
    resolveSwipeTargetPage({
      startPage: 60,
      startScrollX,
      currentScrollX: startScrollX + 140,
      pageWidth: width,
      pageCount: 121,
      velocityX: 600,
    }),
    60,
  );

  // Edge clamping at first/last page
  assert.equal(
    resolveSwipeTargetPage({
      startPage: 0,
      startScrollX: 0,
      currentScrollX: -120,
      pageWidth: width,
      pageCount: 121,
      velocityX: 900,
    }),
    0,
  );
  assert.equal(
    resolveSwipeTargetPage({
      startPage: 120,
      startScrollX: 120 * width,
      currentScrollX: 120 * width + 140,
      pageWidth: width,
      pageCount: 121,
      velocityX: -900,
    }),
    120,
  );
});
