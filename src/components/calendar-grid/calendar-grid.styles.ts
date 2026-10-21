import { StyleSheet } from "react-native";
import { NAV_BAR_CLEARANCE } from "../nav-bar/nav-bar.styles";

const HEADER_HEIGHT = 170;
const MIN_ROW_HEIGHT = 46;
const MAX_ROW_HEIGHT = 90;

export function getGridRowHeight(screenHeight: number, rows: number) {
  const available = screenHeight - HEADER_HEIGHT - NAV_BAR_CLEARANCE;
  const raw = available / rows;
  return Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, raw));
}

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: NAV_BAR_CLEARANCE / 3,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  yearPage: { alignItems: "center", justifyContent: "center" },
  year: {
    fontFamily: "Redaction70-Bold",
    fontSize: 72,
    textAlign: "center",
    letterSpacing: 2,
    paddingHorizontal: 6,
  },
  monthPage: { alignItems: "center", justifyContent: "center" },
  month: {
    fontFamily: "Redaction50-Bold",
    fontSize: 52,
    textAlign: "center",
    letterSpacing: 1,
  },
  hint: { opacity: 0.35 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  dayCell: { width: "20%", paddingVertical: 18 },
  dayText: { fontSize: 36, textAlign: "center" },
  pager: { marginTop: 10 },
});

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
