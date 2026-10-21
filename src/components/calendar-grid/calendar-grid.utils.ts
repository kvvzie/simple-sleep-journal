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
