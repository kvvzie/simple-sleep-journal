export function clampPagerIndex(page: number, pageCount: number): number {
  if (pageCount <= 1) return 0;
  return Math.max(0, Math.min(pageCount - 1, Math.round(page)));
}

export function getVisiblePagerIndices(
  centerPage: number,
  pageCount: number,
  radius = 2,
  extraPages: readonly number[] = [],
): number[] {
  if (pageCount <= 0) return [];
  const center = clampPagerIndex(centerPage, pageCount);
  const start = Math.max(0, center - radius);
  const end = Math.min(pageCount - 1, center + radius);
  const visible = new Set<number>();
  for (let i = start; i <= end; i++) {
    visible.add(i);
  }
  for (const raw of extraPages) {
    if (!Number.isFinite(raw)) continue;
    const p = Math.round(raw);
    if (p >= 0 && p < pageCount) {
      visible.add(p);
    }
  }
  return Array.from(visible).sort((a, b) => a - b);
}

export function scrollXToPageScrollEvent(
  scrollX: number,
  pageWidth: number,
  pageCount: number,
): { position: number; offset: number } {
  if (pageCount <= 1 || pageWidth <= 0) {
    return { position: 0, offset: 0 };
  }
  const maxPage = pageCount - 1;
  const pageFloat = Math.max(0, Math.min(maxPage, scrollX / pageWidth));
  const position = Math.min(maxPage, Math.floor(pageFloat));
  const offset = position === maxPage ? 0 : pageFloat - position;
  return { position, offset };
}

export function shouldShiftPagerWindow(
  livePage: number,
  windowCenter: number,
  radius: number,
): boolean {
  return Math.abs(livePage - windowCenter) >= Math.max(1, radius);
}

export function getWindowShiftThreshold(radius: number): number {
  return radius >= 3 ? 2 : Math.max(1, radius);
}

export function isScrollOffsetSettledAtPage(
  scrollX: number,
  pageWidth: number,
  epsilonPx = 1.5,
): boolean {
  if (pageWidth <= 0) return true;
  const nearestX = Math.round(scrollX / pageWidth) * pageWidth;
  return Math.abs(scrollX - nearestX) <= epsilonPx;
}

export function applyHorizontalRubberBand(
  rawTx: number,
  minTx: number,
  maxTx = 0,
  factor = 0.25,
): number {
  if (rawTx > maxTx) return maxTx + (rawTx - maxTx) * factor;
  if (rawTx < minTx) return minTx + (rawTx - minTx) * factor;
  return rawTx;
}

export function clampSpringVelocity(velocityX: number, maxAbs = 3200): number {
  if (!Number.isFinite(velocityX)) return 0;
  return Math.max(-maxAbs, Math.min(maxAbs, velocityX));
}

const SWIPE_SNAP_DISTANCE_FRACTION = 0.35;
const SWIPE_FLICK_VELOCITY_DP_S = 260;
const SWIPE_VELOCITY_PROJECTION_SEC = 0.18;

export function resolveSwipeTargetPage({
  startPage,
  startScrollX,
  currentScrollX,
  pageWidth,
  pageCount,
  velocityX,
}: {
  startPage: number;
  startScrollX: number;
  currentScrollX: number;
  pageWidth: number;
  pageCount: number;
  velocityX: number;
}): number {
  const safeStart = clampPagerIndex(startPage, pageCount);
  if (pageCount <= 1 || pageWidth <= 0) return safeStart;

  const deltaScrollX = currentScrollX - startScrollX;
  const projectedDeltaX =
    deltaScrollX - velocityX * SWIPE_VELOCITY_PROJECTION_SEC;

  if (Math.abs(deltaScrollX) > pageWidth * 0.5) {
    const maxStep = Math.ceil(Math.abs(deltaScrollX) / pageWidth);
    const projectedPage = Math.round(
      (currentScrollX - velocityX * SWIPE_VELOCITY_PROJECTION_SEC) / pageWidth,
    );
    const bounded = Math.max(
      safeStart - maxStep,
      Math.min(safeStart + maxStep, projectedPage),
    );
    return clampPagerIndex(bounded, pageCount);
  }

  const projectedRatio = projectedDeltaX / pageWidth;
  let step = 0;
  if (projectedRatio >= SWIPE_SNAP_DISTANCE_FRACTION) {
    step = 1;
  } else if (projectedRatio <= -SWIPE_SNAP_DISTANCE_FRACTION) {
    step = -1;
  } else if (
    Math.abs(velocityX) >= SWIPE_FLICK_VELOCITY_DP_S &&
    Math.abs(deltaScrollX) >= 12 &&
    Math.sign(-velocityX) === Math.sign(deltaScrollX)
  ) {
    step = -Math.sign(velocityX);
  }

  return clampPagerIndex(safeStart + step, pageCount);
}
