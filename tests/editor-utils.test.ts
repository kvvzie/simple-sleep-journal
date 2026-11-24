import assert from "node:assert/strict";
import test from "node:test";
import {
  computeDynamicBoxHeight,
  DOUBLE_TAP_DELAY_MS,
  getExpandedBoxBounds,
  isDoubleTap,
  isTapMovementWithinThreshold,
  TAP_OUTSIDE_MAX_DISTANCE,
} from "../src/lib/editor-utils.ts";

test("isDoubleTap detects rapid consecutive taps within the delay window", () => {
  assert.equal(isDoubleTap(null, 1000), false);
  assert.equal(isDoubleTap(1000, 1000), true);
  assert.equal(isDoubleTap(1000, 1000 + DOUBLE_TAP_DELAY_MS), true);
  assert.equal(isDoubleTap(1000, 1000 + DOUBLE_TAP_DELAY_MS + 1), false);
  assert.equal(isDoubleTap(1500, 1400), false);
});

test("isTapMovementWithinThreshold distinguishes taps from scroll drags", () => {
  assert.equal(isTapMovementWithinThreshold(0, 0), true);
  assert.equal(isTapMovementWithinThreshold(6, 8), true);
  assert.equal(
    isTapMovementWithinThreshold(TAP_OUTSIDE_MAX_DISTANCE, 0),
    true,
  );
  assert.equal(
    isTapMovementWithinThreshold(TAP_OUTSIDE_MAX_DISTANCE + 1, 0),
    false,
  );
  assert.equal(isTapMovementWithinThreshold(10, 10), false);
});

test("getExpandedBoxBounds doubles both minHeight and maxHeight when expanded", () => {
  assert.deepEqual(getExpandedBoxBounds(116, 240, false), {
    minHeight: 116,
    maxHeight: 240,
  });
  assert.deepEqual(getExpandedBoxBounds(116, 240, true), {
    minHeight: 232,
    maxHeight: 480,
  });
  assert.deepEqual(getExpandedBoxBounds(57, 129, true), {
    minHeight: 114,
    maxHeight: 258,
  });
  assert.deepEqual(getExpandedBoxBounds(57, 129, true, 3.2), {
    minHeight: 182,
    maxHeight: 413,
  });
});

test("computeDynamicBoxHeight avoids inflating short/empty notes and grows dynamically up to active cap", () => {
  // Empty or short content stays compact even when expanded is active
  assert.equal(
    computeDynamicBoxHeight({
      contentHeight: 52,
      baseMinHeight: 116,
      baseMaxHeight: 240,
      expandedMaxHeight: 480,
      expanded: false,
    }),
    116,
  );
  assert.equal(
    computeDynamicBoxHeight({
      contentHeight: 52,
      baseMinHeight: 116,
      baseMaxHeight: 240,
      expandedMaxHeight: 480,
      expanded: true,
    }),
    116,
  );
  assert.equal(
    computeDynamicBoxHeight({
      contentHeight: 160,
      baseMinHeight: 116,
      baseMaxHeight: 240,
      expandedMaxHeight: 480,
      expanded: true,
    }),
    160,
  );

  // Longer content respects collapsed cap (240) and fits naturally up to expanded cap (480)
  assert.equal(
    computeDynamicBoxHeight({
      contentHeight: 340,
      baseMinHeight: 116,
      baseMaxHeight: 240,
      expandedMaxHeight: 480,
      expanded: false,
    }),
    240,
  );
  assert.equal(
    computeDynamicBoxHeight({
      contentHeight: 340,
      baseMinHeight: 116,
      baseMaxHeight: 240,
      expandedMaxHeight: 480,
      expanded: true,
    }),
    340,
  );
  assert.equal(
    computeDynamicBoxHeight({
      contentHeight: 900,
      baseMinHeight: 116,
      baseMaxHeight: 240,
      expandedMaxHeight: 480,
      expanded: true,
    }),
    480,
  );

  // Weekly Recaps limits (57..129 collapsed, up to 413 expanded)
  assert.equal(
    computeDynamicBoxHeight({
      contentHeight: 38,
      baseMinHeight: 57,
      baseMaxHeight: 129,
      expandedMaxHeight: 413,
      expanded: true,
    }),
    57,
  );
  assert.equal(
    computeDynamicBoxHeight({
      contentHeight: 260,
      baseMinHeight: 57,
      baseMaxHeight: 129,
      expandedMaxHeight: 413,
      expanded: true,
    }),
    260,
  );
  assert.equal(
    computeDynamicBoxHeight({
      contentHeight: 700,
      baseMinHeight: 57,
      baseMaxHeight: 129,
      expandedMaxHeight: 413,
      expanded: true,
    }),
    413,
  );
});
