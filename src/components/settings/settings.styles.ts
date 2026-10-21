import { StyleSheet } from "react-native";
import { NAV_BAR_CLEARANCE } from "../nav-bar/nav-bar.styles";

export const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: NAV_BAR_CLEARANCE,
  },
  title: { fontSize: 48, marginBottom: 24, marginTop: 16 },

  gridRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    marginBottom: 12,
  },
  gridColumn: { alignItems: "center" },
  gridLabel: { fontSize: 16, marginBottom: 4 },
  gridArrow: { height: 22, justifyContent: "center", alignItems: "center" },
  gridPager: { width: 130, height: 68 },
  gridPage: { alignItems: "center", justifyContent: "center" },
  gridValue: { fontSize: 48 },
  xSign: { fontSize: 22, marginTop: 20 },

  sectionLabel: { fontSize: 16, marginBottom: 12 },
  switchTrack: {
    flexDirection: "row",
    width: 220,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    padding: 4,
    marginBottom: 28,
    borderStyle: "dashed",
  },
  switchIndicator: {
    position: "absolute",
    borderRadius: 999,
  },
  switchOption: { flex: 1, alignItems: "center", justifyContent: "center" },

  creditsLabel: { fontSize: 16, marginBottom: 6 },
  creditRole: { fontSize: 13, marginTop: 8 },
  creditName: { fontSize: 20, marginTop: 1 },
  redactionBlock: { alignItems: "center", marginTop: 1 },
  redactionLink: { fontSize: 16, marginTop: 5 },

  madeByLabel: { fontSize: 15, marginTop: 22, marginBottom: 3 },
  madeByName: { fontSize: 24 },

  dataLabel: { fontSize: 16, marginTop: 18, marginBottom: 10 },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    width: 220,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  actionButtonText: { fontSize: 16, fontFamily: "Redaction20-Bold" },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  box: { width: "100%", borderRadius: 20, padding: 24, alignItems: "center" },
  message: { fontSize: 20, textAlign: "center", marginBottom: 24 },
  dialogButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogButtonText: { fontSize: 16, fontFamily: "Redaction20-Bold" },
  dialogActionsColumn: { width: "100%", gap: 12 },
  inputLabel: {
    fontSize: 14,
    alignSelf: "flex-start",
    marginTop: 8,
    marginBottom: 2,
  },
  inputField: {
    width: "100%",
    borderBottomWidth: 1.5,
    fontSize: 16,
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginBottom: 10,
  },
});
