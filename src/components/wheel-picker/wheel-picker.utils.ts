export function clampWheelPage(page: number, totalPages: number): number {
  if (totalPages <= 1) return 0;
  return Math.max(0, Math.min(totalPages - 1, page));
}

export function computeRubberBandWheelPage(
  rawPage: number,
  totalPages: number,
): number {
  const maxPage = Math.max(0, totalPages - 1);
  if (rawPage < 0) return rawPage * 0.25;
  if (rawPage > maxPage) return maxPage + (rawPage - maxPage) * 0.25;
  return rawPage;
}

export function projectWheelReleasePage(options: {
  startPage: number;
  dy: number;
  vy: number;
  pageHeight: number;
  totalPages: number;
  maxFlickSteps?: number;
}): number {
  const {
    startPage,
    dy,
    vy,
    pageHeight,
    totalPages,
    maxFlickSteps = Math.min(4, Math.max(1, Math.floor(totalPages / 3))),
  } = options;
  if (totalPages <= 1 || pageHeight <= 0) return 0;

  const draggedPage = startPage - dy / pageHeight;
  const clampedStart = clampWheelPage(startPage, totalPages);

  const absVy = Math.abs(vy);
  const velocityPages = absVy >= 0.22 ? (-vy * 110) / pageHeight : 0;
  const projected = draggedPage + velocityPages;

  const rounded = Math.round(projected);
  const capped = Math.max(
    clampedStart - maxFlickSteps,
    Math.min(clampedStart + maxFlickSteps, rounded),
  );
  return clampWheelPage(capped, totalPages);
}

export function getVisibleWheelIndices(
  centerPage: number,
  totalPages: number,
  radius = 2,
): number[] {
  if (totalPages <= 0) return [];
  const safeCenter = clampWheelPage(Math.round(centerPage), totalPages);
  const start = Math.max(0, safeCenter - radius);
  const end = Math.min(totalPages - 1, safeCenter + radius);
  const indices: number[] = [];
  for (let i = start; i <= end; i++) {
    indices.push(i);
  }
  return indices;
}
