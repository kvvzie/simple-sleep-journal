export const DOUBLE_TAP_DELAY_MS = 320;
export const TAP_OUTSIDE_MAX_DISTANCE = 12;

export function isDoubleTap(
  lastTapAtMs: number | null,
  nowMs: number,
  maxDelayMs = DOUBLE_TAP_DELAY_MS,
): boolean {
  if (lastTapAtMs === null) return false;
  const elapsed = nowMs - lastTapAtMs;
  return elapsed >= 0 && elapsed <= maxDelayMs;
}

export function isTapMovementWithinThreshold(
  dx: number,
  dy: number,
  maxDistance = TAP_OUTSIDE_MAX_DISTANCE,
): boolean {
  return Math.hypot(dx, dy) <= maxDistance;
}

export function getExpandedBoxBounds(
  baseMinHeight: number,
  baseMaxHeight: number,
  expanded: boolean,
  multiplier = 2,
): { minHeight: number; maxHeight: number } {
  const scale = expanded ? multiplier : 1;
  return {
    minHeight: Math.round(baseMinHeight * scale),
    maxHeight: Math.round(baseMaxHeight * scale),
  };
}

export function computeDynamicBoxHeight({
  contentHeight,
  baseMinHeight,
  baseMaxHeight,
  expandedMaxHeight,
  expanded,
}: {
  contentHeight: number;
  baseMinHeight: number;
  baseMaxHeight: number;
  expandedMaxHeight: number;
  expanded: boolean;
}): number {
  const cap = expanded ? expandedMaxHeight : baseMaxHeight;
  const safeContent = Number.isFinite(contentHeight) ? contentHeight : 0;
  return Math.max(baseMinHeight, Math.min(cap, Math.ceil(safeContent)));
}
