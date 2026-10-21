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

export function getGridRowHeight(screenHeight: number, rows: number) {
  const available = screenHeight - HEADER_HEIGHT - NAV_BAR_CLEARANCE;
  const raw = available / rows;
  return Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, raw));
}

export function getDayColor(type: string, colors: any) {
  switch (type) {
    case "today":
      return colors.calendarToday;
    case "logged":
      return colors.calendarDayLogged;
    case "future":
      return colors.calendarDayFuture;
    case "otherMonth":
      return colors.calendarDayOtherMonth;
    default:
      return colors.calendarDayUnlogged;
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

export function getCalendarDays(
  year: number,
  month: number,
  loggedDates: Set<string>,
  totalCells: number,
): CalendarDay[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: CalendarDay[] = [];
  const today = new Date();

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isToday =
      d === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear();
    const isFuture = new Date(year, month, d) > today && !isToday;
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
