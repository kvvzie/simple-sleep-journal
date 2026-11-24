export const DISCUSS_MONTH_NAMES = [
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
] as const;

export const SHORT_MONTH_NAMES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

export const HALF_YEAR_COLUMNS = 4;
export const HALF_YEAR_ROWS = 7;
export const HALF_YEAR_TOTAL_CELLS = HALF_YEAR_COLUMNS * HALF_YEAR_ROWS;

export const QUARTER_COLUMNS = 4;
export const QUARTER_ROWS = 4;

export const MONTH_ZOOM_COLUMNS = 2;
export const MONTH_ZOOM_ROWS = 3;

export type RecapZoomLevel = "half" | "quarter" | "month";
export type WeekHalf = 1 | 2;
export type WeekQuarter = 1 | 2 | 3 | 4;

export type WeekTopicSummary = {
  totalCount: number;
  openCount: number;
  doneCount: number;
  firstOpenTitle: string | null;
  firstTitle: string | null;
};

export type QuarterMonthColumn = {
  monthIndex: number;
  monthName: string;
  shortMonthName: string;
  cells: WeekGridCell[];
};

export type PositionedCellSlot = {
  xRatio: number;
  yRatio: number;
};

const STAR_13_SLOTS: PositionedCellSlot[] = [
  { xRatio: 0.5, yRatio: 0.08 },
  { xRatio: 0.12, yRatio: 0.24 },
  { xRatio: 0.36, yRatio: 0.24 },
  { xRatio: 0.64, yRatio: 0.24 },
  { xRatio: 0.88, yRatio: 0.24 },
  { xRatio: 0.37, yRatio: 0.39 },
  { xRatio: 0.63, yRatio: 0.39 },
  { xRatio: 0.5, yRatio: 0.53 },
  { xRatio: 0.29, yRatio: 0.67 },
  { xRatio: 0.71, yRatio: 0.67 },
  { xRatio: 0.5, yRatio: 0.78 },
  { xRatio: 0.24, yRatio: 0.91 },
  { xRatio: 0.76, yRatio: 0.91 },
];

const STAR_14_SLOTS: PositionedCellSlot[] = [
  { xRatio: 0.5, yRatio: 0.08 },
  { xRatio: 0.12, yRatio: 0.24 },
  { xRatio: 0.36, yRatio: 0.24 },
  { xRatio: 0.64, yRatio: 0.24 },
  { xRatio: 0.88, yRatio: 0.24 },
  { xRatio: 0.37, yRatio: 0.39 },
  { xRatio: 0.63, yRatio: 0.39 },
  { xRatio: 0.39, yRatio: 0.53 },
  { xRatio: 0.61, yRatio: 0.53 },
  { xRatio: 0.29, yRatio: 0.67 },
  { xRatio: 0.71, yRatio: 0.67 },
  { xRatio: 0.5, yRatio: 0.78 },
  { xRatio: 0.24, yRatio: 0.91 },
  { xRatio: 0.76, yRatio: 0.91 },
];

const MONTH_4_SLOTS: PositionedCellSlot[] = [
  { xRatio: 0.26, yRatio: 0.26 },
  { xRatio: 0.74, yRatio: 0.26 },
  { xRatio: 0.26, yRatio: 0.72 },
  { xRatio: 0.74, yRatio: 0.72 },
];

const MONTH_5_SLOTS: PositionedCellSlot[] = [
  { xRatio: 0.24, yRatio: 0.18 },
  { xRatio: 0.76, yRatio: 0.18 },
  { xRatio: 0.5, yRatio: 0.5 },
  { xRatio: 0.24, yRatio: 0.82 },
  { xRatio: 0.76, yRatio: 0.82 },
];

/**
 * Returns 13- or 14-point 5-pointed star coordinates (top-to-bottom, left-to-right),
 * splitting the center point into two horizontal neighbors when Q4 has 14 weeks.
 */
export function getQuarterStarLayout(weekCount: number): PositionedCellSlot[] {
  if (weekCount >= 14) return STAR_14_SLOTS.slice(0, weekCount);
  return STAR_13_SLOTS.slice(0, weekCount);
}

/**
 * Returns a 2x2 grid for 4-week months, or a 2x2 + 1 centered quincunx for 5-week months.
 */
export function getMonthQuincunxLayout(weekCount: number): PositionedCellSlot[] {
  if (weekCount >= 5) return MONTH_5_SLOTS.slice(0, weekCount);
  return MONTH_4_SLOTS.slice(0, weekCount);
}

export function formatWeekTopicSummary(
  summary: WeekTopicSummary | undefined,
): { statusLabel: string; previewTitle: string | null } {
  if (!summary || summary.totalCount === 0) {
    return { statusLabel: "no notes", previewTitle: null };
  }
  if (summary.openCount > 0 && summary.doneCount > 0) {
    return {
      statusLabel: `${summary.openCount} open · ${summary.doneCount} done`,
      previewTitle: summary.firstOpenTitle ?? summary.firstTitle,
    };
  }
  if (summary.openCount > 0) {
    return {
      statusLabel: `${summary.openCount} open`,
      previewTitle: summary.firstOpenTitle ?? summary.firstTitle,
    };
  }
  return {
    statusLabel: `${summary.doneCount} done`,
    previewTitle: summary.firstTitle,
  };
}

export type WeekCellType =
  | "current"
  | "logged"
  | "futureLogged"
  | "future"
  | "unlogged";

export type WeekGridCell = {
  weekYear: number;
  week: number;
  weekKey: string;
  type: WeekCellType;
  compactRangeLabel: string;
  isOutsideHalf?: boolean;
  monthShortLabel?: string | null;
};

export type DiscussionTopic = {
  id: string;
  week_key: string;
  title: string;
  description: string;
  completed: boolean;
  completed_at: string | null;
  created_date: string;
  created_at: string;
  updated_at: string;
};

export function generateDiscussionTopicId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `topic_${Date.now()}_${rand}`;
}

export function formatWeekKey(weekYear: number, week: number): string {
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

export function parseWeekKey(
  weekKey: string,
): { weekYear: number; week: number } | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!match) return null;
  const weekYear = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isInteger(weekYear) || week < 1 || week > 53) return null;
  return { weekYear, week };
}

export function formatUtcIsoDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Computes ISO-8601 week year, week number (1..53), and canonical YYYY-Www key
 * for a local calendar Y/M/D using UTC math to avoid DST edge cases.
 */
export function getIsoWeekFromYmd(
  year: number,
  monthIndex: number,
  day: number,
): { weekYear: number; week: number; weekKey: string } {
  const d = new Date(Date.UTC(year, monthIndex, day));
  const isoDay = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - isoDay);
  const weekYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { weekYear, week, weekKey: formatWeekKey(weekYear, week) };
}

export function getIsoWeekFromDate(date: Date): {
  weekYear: number;
  week: number;
  weekKey: string;
} {
  return getIsoWeekFromYmd(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
}

export function getIsoWeekFromIsoDateStr(isoDate: string): {
  weekYear: number;
  week: number;
  weekKey: string;
} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  return getIsoWeekFromYmd(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
}

/**
 * Dec 28 always falls inside the final ISO week of its own ISO week-year (52 or 53).
 */
export function getIsoWeeksInYear(weekYear: number): number {
  return getIsoWeekFromYmd(weekYear, 11, 28).week;
}

export function getWeekDateRange(
  weekYear: number,
  week: number,
): {
  startDateStr: string;
  endDateStr: string;
  startYear: number;
  startMonth: number;
  startDay: number;
  endYear: number;
  endMonth: number;
  endDay: number;
} {
  const jan4 = new Date(Date.UTC(weekYear, 0, 4));
  const jan4IsoDay = jan4.getUTCDay() || 7;
  const week1MondayMs = jan4.getTime() - (jan4IsoDay - 1) * 86400000;
  const startMs = week1MondayMs + (week - 1) * 7 * 86400000;
  const endMs = startMs + 6 * 86400000;

  const start = new Date(startMs);
  const end = new Date(endMs);

  return {
    startDateStr: formatUtcIsoDate(startMs),
    endDateStr: formatUtcIsoDate(endMs),
    startYear: start.getUTCFullYear(),
    startMonth: start.getUTCMonth(),
    startDay: start.getUTCDate(),
    endYear: end.getUTCFullYear(),
    endMonth: end.getUTCMonth(),
    endDay: end.getUTCDate(),
  };
}

export function formatWeekHeaderParts(
  weekYear: number,
  week: number,
): { weekLabel: string; dateRangeLabel: string } {
  const range = getWeekDateRange(weekYear, week);
  const weekLabel = `W${week}`;
  if (range.startMonth === range.endMonth && range.startYear === range.endYear) {
    return {
      weekLabel,
      dateRangeLabel: `${range.startDay} - ${range.endDay} ${DISCUSS_MONTH_NAMES[range.startMonth]}`,
    };
  }
  return {
    weekLabel,
    dateRangeLabel: `${range.startDay} ${DISCUSS_MONTH_NAMES[range.startMonth]} - ${range.endDay} ${DISCUSS_MONTH_NAMES[range.endMonth]}`,
  };
}

export function formatCompactWeekDateRange(
  weekYear: number,
  week: number,
): string {
  const range = getWeekDateRange(weekYear, week);
  if (range.startMonth === range.endMonth && range.startYear === range.endYear) {
    return `${range.startDay} - ${range.endDay} ${SHORT_MONTH_NAMES[range.startMonth]}`;
  }
  return `${range.startDay} ${SHORT_MONTH_NAMES[range.startMonth]} - ${range.endDay} ${SHORT_MONTH_NAMES[range.endMonth]}`;
}

export function formatFullWeekDateRange(
  weekYear: number,
  week: number,
): string {
  const range = getWeekDateRange(weekYear, week);
  if (range.startMonth === range.endMonth && range.startYear === range.endYear) {
    return `${range.startDay} - ${range.endDay} ${DISCUSS_MONTH_NAMES[range.startMonth]}`;
  }
  return `${range.startDay} ${SHORT_MONTH_NAMES[range.startMonth]} - ${range.endDay} ${SHORT_MONTH_NAMES[range.endMonth]}`;
}

export function compareWeekKeys(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function stepWeekKey(weekKey: string, deltaWeeks: number): string {
  const parsed = parseWeekKey(weekKey);
  if (!parsed) return weekKey;
  const { startYear, startMonth, startDay } = getWeekDateRange(
    parsed.weekYear,
    parsed.week,
  );
  const shifted = new Date(Date.UTC(startYear, startMonth, startDay + deltaWeeks * 7));
  return getIsoWeekFromYmd(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  ).weekKey;
}

export function getMoveTargetForTopic(
  viewedWeekKey: string,
  currentWeekKey: string,
): { targetWeekKey: string; requiresConfirm: boolean } {
  if (compareWeekKeys(viewedWeekKey, currentWeekKey) < 0) {
    return { targetWeekKey: currentWeekKey, requiresConfirm: false };
  }
  return {
    targetWeekKey: stepWeekKey(viewedWeekKey, 1),
    requiresConfirm: true,
  };
}

export function pageToYearHalf(
  page: number,
  baseYear: number,
  baseHalf: WeekHalf,
  centerPage: number,
): { year: number; half: WeekHalf } {
  const diff = page - centerPage;
  const total = baseYear * 2 + (baseHalf - 1) + diff;
  const year = Math.floor(total / 2);
  const half = ((((total % 2) + 2) % 2) + 1) as WeekHalf;
  return { year, half };
}

export function yearHalfToPage(
  year: number,
  half: WeekHalf,
  baseYear: number,
  baseHalf: WeekHalf,
  centerPage: number,
): number {
  return centerPage + (year * 2 + (half - 1) - (baseYear * 2 + (baseHalf - 1)));
}

export function getQuarterForIsoWeek(week: number): WeekQuarter {
  if (week <= 13) return 1;
  if (week <= 26) return 2;
  if (week <= 39) return 3;
  return 4;
}

export function pageToYearQuarter(
  page: number,
  baseYear: number,
  baseQuarter: WeekQuarter,
  centerPage: number,
): { year: number; quarter: WeekQuarter } {
  const diff = page - centerPage;
  const total = baseYear * 4 + (baseQuarter - 1) + diff;
  const year = Math.floor(total / 4);
  const quarter = ((((total % 4) + 4) % 4) + 1) as WeekQuarter;
  return { year, quarter };
}

export function yearQuarterToPage(
  year: number,
  quarter: WeekQuarter,
  baseYear: number,
  baseQuarter: WeekQuarter,
  centerPage: number,
): number {
  return (
    centerPage + (year * 4 + (quarter - 1) - (baseYear * 4 + (baseQuarter - 1)))
  );
}

/**
 * Each ISO week belongs to the calendar month that holds its Thursday (>= 4 days in that month).
 * This guarantees every month has strictly 4 or 5 weeks with zero cross-month duplicates.
 */
export function getIsoMonthForIsoWeek(
  weekYear: number,
  week: number,
): { year: number; month: number } {
  const jan4 = new Date(Date.UTC(weekYear, 0, 4));
  const jan4IsoDay = jan4.getUTCDay() || 7;
  const week1MondayMs = jan4.getTime() - (jan4IsoDay - 1) * 86400000;
  const thursdayMs = week1MondayMs + ((week - 1) * 7 + 3) * 86400000;
  const thursday = new Date(thursdayMs);
  return {
    year: thursday.getUTCFullYear(),
    month: thursday.getUTCMonth(),
  };
}

export function getIsoQuarterForIsoWeek(
  weekYear: number,
  week: number,
): { year: number; quarter: WeekQuarter } {
  const { year, month } = getIsoMonthForIsoWeek(weekYear, week);
  return {
    year,
    quarter: (Math.floor(month / 3) + 1) as WeekQuarter,
  };
}

export function pageToYearMonthIndex(
  page: number,
  baseYear: number,
  baseMonth: number,
  centerPage: number,
): { year: number; month: number } {
  const diff = page - centerPage;
  const total = baseYear * 12 + baseMonth + diff;
  const year = Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  return { year, month };
}

export function yearMonthIndexToPage(
  year: number,
  month: number,
  baseYear: number,
  baseMonth: number,
  centerPage: number,
): number {
  return centerPage + (year * 12 + month - (baseYear * 12 + baseMonth));
}

function buildWeekGridCell(
  weekYear: number,
  week: number,
  loggedWeekKeys: Set<string>,
  currentWeekKey: string,
): WeekGridCell {
  const weekKey = formatWeekKey(weekYear, week);
  const isLogged = loggedWeekKeys.has(weekKey);
  const isFuture = compareWeekKeys(weekKey, currentWeekKey) > 0;
  let type: WeekCellType;
  if (weekKey === currentWeekKey) {
    type = "current";
  } else if (isLogged && isFuture) {
    type = "futureLogged";
  } else if (isLogged) {
    type = "logged";
  } else if (isFuture) {
    type = "future";
  } else {
    type = "unlogged";
  }
  return {
    weekYear,
    week,
    weekKey,
    type,
    compactRangeLabel: formatCompactWeekDateRange(weekYear, week),
  };
}

export function getHalfYearWeekCells(
  weekYear: number,
  half: WeekHalf,
  loggedWeekKeys: Set<string>,
  currentWeekKey: string,
): WeekGridCell[] {
  const totalWeeks = getIsoWeeksInYear(weekYear);
  const raw: { weekYear: number; week: number; isOutsideHalf: boolean }[] = [];

  if (half === 1) {
    for (let w = 1; w <= HALF_YEAR_TOTAL_CELLS; w++) {
      raw.push({ weekYear, week: w, isOutsideHalf: w === 28 });
    }
  } else {
    for (let w = 28; w <= totalWeeks; w++) {
      raw.push({ weekYear, week: w, isOutsideHalf: false });
    }
    let nextYearWeek = 1;
    while (raw.length < HALF_YEAR_TOTAL_CELLS) {
      raw.push({
        weekYear: weekYear + 1,
        week: nextYearWeek,
        isOutsideHalf: true,
      });
      nextYearWeek++;
    }
  }

  return raw.slice(0, HALF_YEAR_TOTAL_CELLS).map((item) => {
    const base = buildWeekGridCell(
      item.weekYear,
      item.week,
      loggedWeekKeys,
      currentWeekKey,
    );
    const isoMonth = getIsoMonthForIsoWeek(item.weekYear, item.week);
    return {
      ...base,
      isOutsideHalf: item.isOutsideHalf,
      monthShortLabel: SHORT_MONTH_NAMES[isoMonth.month],
    };
  });
}

export function getQuarterWeekCells(
  weekYear: number,
  quarter: WeekQuarter,
  loggedWeekKeys: Set<string>,
  currentWeekKey: string,
): WeekGridCell[] {
  const totalWeeks = getIsoWeeksInYear(weekYear);
  const startWeek = (quarter - 1) * 13 + 1;
  const endWeek = quarter < 4 ? quarter * 13 : totalWeeks;
  const cells: WeekGridCell[] = [];
  for (let w = startWeek; w <= endWeek; w++) {
    cells.push(buildWeekGridCell(weekYear, w, loggedWeekKeys, currentWeekKey));
  }
  return cells;
}

export function getQuarterMonthColumns(
  calendarYear: number,
  quarter: WeekQuarter,
  loggedWeekKeys: Set<string>,
  currentWeekKey: string,
): QuarterMonthColumn[] {
  const startMonth = (quarter - 1) * 3;
  const cols: QuarterMonthColumn[] = [];
  for (let offset = 0; offset < 3; offset++) {
    const monthIndex = startMonth + offset;
    cols.push({
      monthIndex,
      monthName: DISCUSS_MONTH_NAMES[monthIndex],
      shortMonthName: SHORT_MONTH_NAMES[monthIndex],
      cells: getMonthWeekCells(
        calendarYear,
        monthIndex,
        loggedWeekKeys,
        currentWeekKey,
      ),
    });
  }
  return cols;
}

export function getMonthWeekCells(
  calendarYear: number,
  monthIndex: number,
  loggedWeekKeys: Set<string>,
  currentWeekKey: string,
): WeekGridCell[] {
  const daysInMonth = new Date(Date.UTC(calendarYear, monthIndex + 1, 0)).getUTCDate();
  const cells: WeekGridCell[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayOfWeek = new Date(Date.UTC(calendarYear, monthIndex, d)).getUTCDay();
    if (dayOfWeek === 4) {
      const iso = getIsoWeekFromYmd(calendarYear, monthIndex, d);
      cells.push(
        buildWeekGridCell(iso.weekYear, iso.week, loggedWeekKeys, currentWeekKey),
      );
    }
  }
  return cells;
}

export function getWeekCellColor(
  type: WeekCellType,
  colors: any,
  isOutsideHalf = false,
): string {
  if (isOutsideHalf) {
    if (type === "logged" || type === "futureLogged" || type === "current") {
      return colors.calendarDayUnlogged || colors.textSecondary;
    }
    return colors.calendarDayOtherMonth || colors.textSecondary;
  }
  switch (type) {
    case "current":
      return colors.calendarToday || colors.text;
    case "logged":
    case "futureLogged":
      return colors.calendarDayLogged || colors.text;
    case "future":
      return colors.calendarDayFuture || colors.textSecondary;
    default:
      return colors.calendarDayUnlogged || colors.textSecondary;
  }
}

export function getWeekCellFont(type: WeekCellType): string {
  switch (type) {
    case "current":
      return "Redaction35-Bold";
    case "logged":
      return "Redaction35-Regular";
    default:
      return "Redaction35-Italic";
  }
}

export function sanitizeImportedDiscussionTopics(
  raw: unknown,
  fallbackNow: string,
): DiscussionTopic[] {
  if (!Array.isArray(raw)) return [];
  const fallbackDate = fallbackNow.slice(0, 10);
  const result: DiscussionTopic[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const title = typeof rec.title === "string" ? rec.title.trim() : "";
    const weekKey = typeof rec.week_key === "string" ? rec.week_key : "";
    if (!title || !parseWeekKey(weekKey)) continue;

    const id =
      typeof rec.id === "string" && rec.id.trim()
        ? rec.id.trim()
        : `topic_import_${Date.now()}_${i}`;
    const description =
      typeof rec.description === "string" ? rec.description : "";
    const completed = rec.completed === true || rec.completed === 1;
    const createdAt =
      typeof rec.created_at === "string" && rec.created_at
        ? rec.created_at
        : fallbackNow;
    const updatedAt =
      typeof rec.updated_at === "string" && rec.updated_at
        ? rec.updated_at
        : createdAt;
    const createdDate =
      typeof rec.created_date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(rec.created_date)
        ? rec.created_date
        : createdAt.slice(0, 10) || fallbackDate;
    const completedAt =
      completed && typeof rec.completed_at === "string" && rec.completed_at
        ? rec.completed_at
        : completed
          ? updatedAt
          : null;

    result.push({
      id,
      week_key: weekKey,
      title,
      description,
      completed,
      completed_at: completedAt,
      created_date: createdDate,
      created_at: createdAt,
      updated_at: updatedAt,
    });
  }

  return result;
}

/**
 * Determines whether page `p` should stay mounted inside `ComposePagerView`.
 * During active zoom transitions only the exact target page mounts to keep UI free of hitching;
 * once settled, a generous window prevents blank frames during fast horizontal flicks.
 */
export function isRecapPageNear(params: {
  p: number;
  page: number;
  preloadedPage: number;
  zoomLevel: RecapZoomLevel;
  zoomBufferReady: boolean;
  transitionActive: boolean;
  halfPageCount?: number;
}): boolean {
  const {
    p,
    page,
    preloadedPage,
    zoomLevel,
    zoomBufferReady,
    transitionActive,
    halfPageCount = 22,
  } = params;

  if (transitionActive || !zoomBufferReady) {
    return p === page;
  }

  const dist = Math.abs(p - page);
  const preloadDelta = Math.abs(p - preloadedPage);

  if (zoomLevel === "half") {
    return dist <= 5 || preloadDelta <= halfPageCount;
  }
  if (zoomLevel === "quarter") {
    return (
      dist <= 5 ||
      preloadDelta <= 10 ||
      preloadDelta === 4 ||
      preloadDelta === 8
    );
  }
  return (
    dist <= 4 ||
    preloadDelta <= 8 ||
    preloadDelta === 12 ||
    preloadDelta === 24
  );
}

/**
 * Only apply a short post-pinch swipe cooldown when the user aborted a pinch
 * without changing zoom levels. Completed zoom transitions already mount a
 * fresh pager, so adding cooldown afterwards would swallow valid swipes.
 */
export function shouldApplyPinchCooldown(
  wasActive: boolean,
  wasTriggered: boolean,
): boolean {
  return wasActive && !wasTriggered;
}

export const PINCH_STAGE1_ZOOM_IN_RATIO = 1.24;
export const PINCH_STAGE1_ZOOM_OUT_RATIO = 0.8;
export const PINCH_STAGE1_DELTA_PX = 62;
export const PINCH_STAGE1_MIN_DELTA_PX = 36;

export const PINCH_STAGE2_ZOOM_IN_RATIO = 1.38;
export const PINCH_STAGE2_ZOOM_OUT_RATIO = 0.66;
export const PINCH_STAGE2_ZOOM_IN_DELTA_PX = 95;
export const PINCH_STAGE2_ZOOM_OUT_DELTA_PX = 85;

const ZOOM_LEVEL_ORDER: readonly RecapZoomLevel[] = [
  "half",
  "quarter",
  "month",
];

/**
 * Evaluates whether a continuous two-finger pinch should trigger the next zoom
 * level. Stage 0 (initial pinch) uses a comfortable responsive threshold; Stage
 * 1+ (continuing the same two-finger gesture without lifting, e.g. half ->
 * quarter -> month) requires a deliberately large extra spread/pinch so normal
 * gestures never skip `quarter` accidentally.
 */
export function evaluatePinchZoomStep(params: {
  currentZoomLevel: RecapZoomLevel;
  anchorDist: number;
  currentDist: number;
  stage: number;
  allowedDirection: "in" | "out" | null;
}): { nextLevel: RecapZoomLevel; direction: "in" | "out" } | null {
  const { currentZoomLevel, anchorDist, currentDist, stage, allowedDirection } =
    params;
  if (anchorDist <= 0 || currentDist <= 0) return null;

  const curIdx = ZOOM_LEVEL_ORDER.indexOf(currentZoomLevel);
  if (curIdx < 0) return null;

  const canZoomIn = curIdx < ZOOM_LEVEL_ORDER.length - 1;
  const canZoomOut = curIdx > 0;
  const ratio = currentDist / anchorDist;
  const deltaPx = currentDist - anchorDist;

  if (stage === 0) {
    const shouldZoomIn =
      canZoomIn &&
      deltaPx >= PINCH_STAGE1_MIN_DELTA_PX &&
      (ratio >= PINCH_STAGE1_ZOOM_IN_RATIO ||
        deltaPx >= PINCH_STAGE1_DELTA_PX);
    if (shouldZoomIn) {
      return { nextLevel: ZOOM_LEVEL_ORDER[curIdx + 1], direction: "in" };
    }

    const shouldZoomOut =
      canZoomOut &&
      -deltaPx >= PINCH_STAGE1_MIN_DELTA_PX &&
      (ratio <= PINCH_STAGE1_ZOOM_OUT_RATIO ||
        -deltaPx >= PINCH_STAGE1_DELTA_PX);
    if (shouldZoomOut) {
      return { nextLevel: ZOOM_LEVEL_ORDER[curIdx - 1], direction: "out" };
    }
    return null;
  }

  // Stage 1+: continuous same-pinch continuation must keep going in the same
  // direction AND cross both the large pixel delta and large ratio thresholds.
  if (
    canZoomIn &&
    allowedDirection === "in" &&
    deltaPx >= PINCH_STAGE2_ZOOM_IN_DELTA_PX &&
    ratio >= PINCH_STAGE2_ZOOM_IN_RATIO
  ) {
    return { nextLevel: ZOOM_LEVEL_ORDER[curIdx + 1], direction: "in" };
  }

  if (
    canZoomOut &&
    allowedDirection === "out" &&
    -deltaPx >= PINCH_STAGE2_ZOOM_OUT_DELTA_PX &&
    ratio <= PINCH_STAGE2_ZOOM_OUT_RATIO
  ) {
    return { nextLevel: ZOOM_LEVEL_ORDER[curIdx - 1], direction: "out" };
  }

  return null;
}
