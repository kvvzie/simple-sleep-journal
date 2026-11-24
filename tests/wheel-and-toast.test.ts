import assert from "node:assert";
import test from "node:test";
import {
  createSleepSessionSnapshot,
  formatMovedToWeekToast,
  hasSleepSessionChanges,
  resolveToastHostEntryMode,
  resolveToastTopOffset,
} from "../src/components/top-toast/top-toast.utils.ts";
import {
  clampWheelPage,
  computeRubberBandWheelPage,
  getVisibleWheelIndices,
  projectWheelReleasePage,
} from "../src/components/wheel-picker/wheel-picker.utils.ts";

test("clampWheelPage and computeRubberBandWheelPage keep bounds smooth", () => {
  assert.strictEqual(clampWheelPage(-2, 5), 0);
  assert.strictEqual(clampWheelPage(2, 5), 2);
  assert.strictEqual(clampWheelPage(8, 5), 4);
  assert.strictEqual(clampWheelPage(3, 1), 0);

  assert.strictEqual(computeRubberBandWheelPage(2.5, 5), 2.5);
  assert.strictEqual(computeRubberBandWheelPage(-1, 5), -0.25);
  assert.strictEqual(computeRubberBandWheelPage(5, 5), 4.25);
});

test("projectWheelReleasePage advances smoothly with upward/downward drag and velocity", () => {
  // Small movement stays on current page
  assert.strictEqual(
    projectWheelReleasePage({
      startPage: 2,
      dy: -10,
      vy: 0,
      pageHeight: 70,
      totalPages: 5,
    }),
    2,
  );

  // Dragging UP more than half a page advances to next index (+1)
  assert.strictEqual(
    projectWheelReleasePage({
      startPage: 2,
      dy: -45,
      vy: 0,
      pageHeight: 70,
      totalPages: 5,
    }),
    3,
  );

  // Dragging DOWN moves to previous index (-1)
  assert.strictEqual(
    projectWheelReleasePage({
      startPage: 2,
      dy: 45,
      vy: 0,
      pageHeight: 70,
      totalPages: 5,
    }),
    1,
  );

  // Fast upward flick advances multiple steps cleanly inside 61-hour picker
  const flicked = projectWheelReleasePage({
    startPage: 38,
    dy: -80,
    vy: -1.6,
    pageHeight: 72,
    totalPages: 61,
  });
  assert.ok(flicked >= 40 && flicked <= 42);
});

test("getVisibleWheelIndices returns windowed subset within bounds", () => {
  assert.deepStrictEqual(getVisibleWheelIndices(0, 5, 2), [0, 1, 2]);
  assert.deepStrictEqual(getVisibleWheelIndices(2, 5, 2), [0, 1, 2, 3, 4]);
  assert.deepStrictEqual(getVisibleWheelIndices(38, 61, 2), [36, 37, 38, 39, 40]);
});

test("formatMovedToWeekToast formats target week key into WXX alert", () => {
  assert.strictEqual(formatMovedToWeekToast("2026-W48"), "moved to W48");
  assert.strictEqual(formatMovedToWeekToast("2026-W03"), "moved to W3");
});

test("hasSleepSessionChanges detects real edits and ignores unchanged openings", () => {
  const features = {
    moodStarsEnabled: true,
    bodyCareEnabled: true,
    commentsEnabled: true,
  };

  const initial = createSleepSessionSnapshot({
    hasEntry: true,
    hours: 8,
    mood: 7,
    comment: "slept well",
    bodyCareEnabled: false,
    bodyCareProductId: null,
    bodyCareAmounts: {},
  });

  // Unchanged re-close -> false (no saved toast)
  assert.strictEqual(
    hasSleepSessionChanges({
      initial,
      current: { ...initial },
      features,
      todosModified: false,
    }),
    false,
  );

  // Changed hours -> true
  assert.strictEqual(
    hasSleepSessionChanges({
      initial,
      current: { ...initial, hours: 7 },
      features,
      todosModified: false,
    }),
    true,
  );

  // Changed todo without changing sleep fields -> true
  assert.strictEqual(
    hasSleepSessionChanges({
      initial,
      current: { ...initial },
      features,
      todosModified: true,
    }),
    true,
  );

  // Hidden disabled feature fields must not trigger false save
  assert.strictEqual(
    hasSleepSessionChanges({
      initial,
      current: { ...initial, mood: 3, comment: "edited" },
      features: {
        moodStarsEnabled: false,
        bodyCareEnabled: false,
        commentsEnabled: false,
      },
      todosModified: false,
    }),
    false,
  );
});

test("resolveToastHostEntryMode preserves toast on root after modal close handoff", () => {
  // Hidden / non-topmost host hides cleanly
  assert.strictEqual(
    resolveToastHostEntryMode({
      isCurrentHost: false,
      toastId: 5,
      phase: "visible",
      alreadyEntered: false,
    }),
    "hide",
  );

  // First active host (e.g. closing modal) animates entry
  assert.strictEqual(
    resolveToastHostEntryMode({
      isCurrentHost: true,
      toastId: 5,
      phase: "visible",
      alreadyEntered: false,
    }),
    "animate-in",
  );

  // Subsequent root host taking over the same active toast snaps visible immediately
  assert.strictEqual(
    resolveToastHostEntryMode({
      isCurrentHost: true,
      toastId: 5,
      phase: "visible",
      alreadyEntered: true,
    }),
    "snap-visible",
  );

  // Exiting phase slides out smoothly
  assert.strictEqual(
    resolveToastHostEntryMode({
      isCurrentHost: true,
      toastId: 5,
      phase: "exiting",
      alreadyEntered: true,
    }),
    "animate-out",
  );
});

test("resolveToastTopOffset keeps modal toasts aligned with root safe-area inset", () => {
  // Inside Android translucent Modal where local insets.top is 0, inherit rootTopInset
  assert.strictEqual(resolveToastTopOffset(0, 42), 50);
  // On root host with matching inset, yields the exact same offset
  assert.strictEqual(resolveToastTopOffset(42, 42), 50);
  // Respects a larger local inset if present
  assert.strictEqual(resolveToastTopOffset(54, 42), 62);
  // Falls back to minimum 12dp clearance when no top inset is reported
  assert.strictEqual(resolveToastTopOffset(0, 0), 12);
});
