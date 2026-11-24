export const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

export type DayType = "today" | "logged" | "future" | "unlogged" | "otherMonth";
export type CalendarDay = { day: number; type: DayType; dateStr?: string };

export const HEADER_HEIGHT = 170;
export const NAV_BAR_CLEARANCE = 130;
export const MIN_ROW_HEIGHT = 46;
export const MAX_ROW_HEIGHT = 90;

export function getGridRowHeight(
  screenHeight: number,
  rows: number,
  bottomInset = 0,
) {
  const extraBottom = Math.max(0, bottomInset - 16);
  const available = screenHeight - HEADER_HEIGHT - NAV_BAR_CLEARANCE - extraBottom;
  const raw = available / rows;
  return Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, raw));
}

export function getDayColor(type: string, colors: any) {
  switch (type) {
    case "today":
      return colors.calendarToday || colors.text;
    case "logged":
      return colors.calendarDayLogged || colors.text;
    case "future":
      return colors.calendarDayFuture || colors.textSecondary;
    case "otherMonth":
      return colors.calendarDayOtherMonth || colors.textSecondary;
    default:
      return colors.calendarDayUnlogged || colors.textSecondary;
  }
}

export function getDayFont(type: string) {
  switch (type) {
    case "today":
      return "Redaction35-Bold";
    case "logged":
      return "Redaction35-Regular";
    default:
      return "Redaction35-Italic";
  }
}

export function getDayFontSize(columns: number) {
  if (columns <= 5) return 36;
  if (columns === 6) return 30;
  if (columns === 7) return 26;
  return 22;
}

export function getDayCellWidth(containerWidth: number, columns: number) {
  return Math.floor(containerWidth / columns);
}

export function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function groupDatesByMonth(dates: string[]): Map<string, Set<string>> {
  const byMonth = new Map<string, Set<string>>();
  for (const dateStr of dates) {
    if (dateStr.length < 7) continue;
    const key = dateStr.slice(0, 7);
    let set = byMonth.get(key);
    if (!set) {
      set = new Set<string>();
      byMonth.set(key, set);
    }
    set.add(dateStr);
  }
  return byMonth;
}

export function computeWidthScale(
  widths: Record<number, number> | undefined,
  maxWidth: number,
  minScale: number,
): number {
  if (!widths || maxWidth <= 0) return 1;
  let widest = 0;
  for (const w of Object.values(widths)) {
    if (w > widest) widest = w;
  }
  if (widest <= maxWidth) return 1;
  return Math.max(minScale, maxWidth / widest);
}

export function getScaledMeasuredWidth(
  widths: Record<number, number> | undefined,
  key: number,
  scale: number,
  maxWidth: number,
): number | undefined {
  const raw = widths?.[key];
  if (raw === undefined) return undefined;
  return Math.min(maxWidth, raw * scale);
}

export function getSwipeTargetPage(
  scrollPos: number,
  anchorPage: number,
  threshold: number,
  minPage: number,
  maxPage: number,
): number | null {
  const delta = scrollPos - anchorPage;
  if (delta <= -threshold) {
    return Math.max(minPage, anchorPage - 1);
  }
  if (delta >= threshold) {
    return Math.min(maxPage, anchorPage + 1);
  }
  return null;
}

export const SWIPE_TRIGGER_THRESHOLD = 0.18;
export const SWIPE_RETURN_THRESHOLD = 0.12;

export function getDragPreviewPage(options: {
  scrollPos: number;
  anchorPage: number;
  committedDir: -1 | 0 | 1;
  isDragging: boolean;
  triggerThreshold: number;
  returnThreshold?: number;
  minPage: number;
  maxPage: number;
}): { targetPage: number; nextDir: -1 | 0 | 1 } | null {
  const {
    scrollPos,
    anchorPage,
    committedDir,
    isDragging,
    triggerThreshold,
    returnThreshold = triggerThreshold * 0.5,
    minPage,
    maxPage,
  } = options;

  const delta = scrollPos - anchorPage;

  if (delta <= -triggerThreshold) {
    const targetPage = Math.max(minPage, anchorPage - 1);
    if (targetPage === anchorPage) return null;
    if (committedDir === 0 || (isDragging && committedDir !== -1)) {
      return { targetPage, nextDir: -1 };
    }
    return null;
  }

  if (delta >= triggerThreshold) {
    const targetPage = Math.min(maxPage, anchorPage + 1);
    if (targetPage === anchorPage) return null;
    if (committedDir === 0 || (isDragging && committedDir !== 1)) {
      return { targetPage, nextDir: 1 };
    }
    return null;
  }

  if (isDragging && committedDir !== 0 && Math.abs(delta) <= returnThreshold) {
    return { targetPage: anchorPage, nextDir: 0 };
  }

  return null;
}

export type PageSelectedDecision =
  | "ignore"
  | "acknowledge-programmatic"
  | "reconcile";

export function evaluatePageSelected(options: {
  pos: number;
  expectedProgrammaticPage: number | undefined;
  activeManualSource: string | null;
  isDragging: boolean;
  lastScrollPos: number | undefined;
  currentPage: number;
}): PageSelectedDecision {
  const {
    pos,
    expectedProgrammaticPage,
    activeManualSource,
    isDragging,
    lastScrollPos,
    currentPage,
  } = options;

  if (expectedProgrammaticPage !== undefined) {
    return pos === expectedProgrammaticPage
      ? "acknowledge-programmatic"
      : "ignore";
  }

  if (activeManualSource !== null || isDragging) {
    return "ignore";
  }

  if (pos === currentPage) {
    return "ignore";
  }

  if (lastScrollPos !== undefined && Math.abs(lastScrollPos - pos) > 0.15) {
    return "ignore";
  }

  return "reconcile";
}

export function isScrollSettled(offset: number): boolean {
  return Math.abs(offset) < 0.005;
}

export function resolveCanceledSwipePage(options: {
  scrollPos: number;
  offset: number;
  dragAnchor: number | null;
  hadMovedInGesture: boolean;
  currentTarget: number;
  isDragging: boolean;
}): number | null {
  const {
    scrollPos,
    offset,
    dragAnchor,
    hadMovedInGesture,
    currentTarget,
    isDragging,
  } = options;
  if (
    isDragging ||
    !hadMovedInGesture ||
    dragAnchor === null ||
    !isScrollSettled(offset)
  ) {
    return null;
  }
  const settledPos = Math.round(scrollPos);
  if (settledPos === dragAnchor && settledPos !== currentTarget) {
    return settledPos;
  }
  return null;
}

export function getCalendarDays(
  year: number,
  month: number,
  loggedDates: Set<string>,
  totalCells: number,
): CalendarDay[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: CalendarDay[] = [];
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();
  const monthKey = getMonthKey(year, month);
  const isCurrentMonth = year === todayYear && month === todayMonth;
  const isFutureMonth =
    year > todayYear || (year === todayYear && month > todayMonth);

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${monthKey}-${String(d).padStart(2, "0")}`;
    const isToday = isCurrentMonth && d === todayDay;
    const isFuture = isFutureMonth || (isCurrentMonth && d > todayDay);
    const isLogged = loggedDates.has(dateStr);

    let type: DayType = "unlogged";
    if (isToday) type = "today";
    else if (isFuture) type = "future";
    else if (isLogged) type = "logged";

    days.push({ day: d, type, dateStr });
  }

  let nextDay = 1;
  while (days.length < totalCells) {
    days.push({ day: nextDay, type: "otherMonth" });
    nextDay++;
  }

  return days.slice(0, totalCells);
}
