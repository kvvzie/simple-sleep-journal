import { StyleSheet } from "react-native";
import {
  getDayCellWidth,
  getDayColor,
  getDayFont,
  getDayFontSize,
  getGridRowHeight,
  NAV_BAR_CLEARANCE,
} from "./calendar-grid.utils";

export {
  getDayCellWidth,
  getDayColor,
  getDayFont,
  getDayFontSize,
  getGridRowHeight,
};

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
  measureOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    opacity: 0,
  },
});
