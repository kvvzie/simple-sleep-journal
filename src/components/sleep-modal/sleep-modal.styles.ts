import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
  },
  bottomFiller: {
    position: "absolute",
    bottom: -150,
    left: 0,
    right: 0,
    height: 150,
  },
  hoursColumn: { alignItems: "center", marginBottom: 20, gap: 0 },
  hoursPlaceholder: { height: 112 },
  dragZone: { alignItems: "center", paddingTop: 16, paddingBottom: 12 },
  dragHandle: {
    width: 70,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#B0B0B0",
  },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  title: { fontSize: 36, textAlign: "center", marginBottom: 24 },
  label: { fontSize: 15, marginBottom: 4, textAlign: "center" },
  hoursWheel: { marginVertical: 0 },
  hoursPager: { width: 140, height: 72 },
  hoursPage: { alignItems: "center", justifyContent: "center" },
  hoursValueCenter: { fontSize: 48 },
  starsRow: {
    flexDirection: "row",
    marginTop: 8,
    marginBottom: 24,
    justifyContent: "center",
    paddingVertical: 8,
  },
  commentSection: {
    width: "100%",
  },
  commentHeaderRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 34,
    marginBottom: 2,
  },
  commentHeaderSideLeft: {
    alignItems: "flex-start",
  },
  commentHeaderSideRight: {
    alignItems: "flex-end",
  },
  commentHeaderAction: {
    minWidth: 40,
    minHeight: 34,
    justifyContent: "center",
  },
  commentHeaderLabel: {
    flex: 1,
    paddingBottom: 4,
    marginBottom: 0,
    textAlign: "center",
  },
  commentBox: {
    width: "100%",
    minHeight: 120,
    borderRadius: 12,
    marginTop: 2,
    position: "relative",
  },
  commentInput: {
    flex: 1,
    padding: 14,
    fontSize: 18,
    lineHeight: 24,
    textAlignVertical: "top",
  },
  commentReadScroll: {
    width: "100%",
    flex: 1,
  },
  commentReadScrollContent: {
    flexGrow: 1,
  },
  commentReadPressable: {
    flex: 1,
    padding: 14,
  },
  commentReadText: {
    fontSize: 18,
    lineHeight: 24,
  },
  deleteButton: {
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    width: "100%",
    zIndex: 1,
  },
  deleteButtonText: { fontSize: 16, fontFamily: "Redaction20-Bold" },
  confirmBox: {
    width: "100%",
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    alignItems: "center",
  },
  confirmText: { fontSize: 17, textAlign: "center", marginBottom: 16 },
  confirmRow: { flexDirection: "row", gap: 12, width: "100%" },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmButtonText: { fontSize: 16, fontFamily: "Redaction20-Bold" },
  historyFooter: { marginTop: 12, alignItems: "center" },
  historyFooterText: { fontSize: 13 },
  historyList: { marginTop: 8, alignItems: "flex-start", width: "100%" },
  historyItem: { fontSize: 12, marginBottom: 4 },

  bodyCareSection: {
    width: "100%",
    marginBottom: 24,
  },

  bodyCareMenu: {
    width: "100%",
    paddingTop: 12,
    paddingBottom: 16,
  },

  bodyCareLabel: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 8,
  },

  bodyCareHeader: {
    width: "100%",
  },

  bodyCareRadioInput: {
    width: 31,
    height: 35,
    alignItems: "center",
    justifyContent: "center",
  },

  bodyCareControls: {
    width: "100%",
    height: 35,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },

  bodyCareHeaderSide: {
    position: "absolute",
    height: 35,
    justifyContent: "center",
  },

  bodyCareHeaderLeft: {
    right: "50%",
    marginRight: 43,
  },

  bodyCareHeaderCenter: {
    height: 35,
    alignItems: "center",
    justifyContent: "center",
  },

  bodyCareHeaderRight: {
    left: "50%",
    marginLeft: 43,
  },

  bodyCareArrowButton: {
    width: 31,
    height: 35,
    alignItems: "center",
    justifyContent: "center",
  },

  bodyCareRadioText: {
    fontSize: 18,
  },

  bodyCareProductToggle: {
    width: "100%",
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  bodyCareProductToggleText: {
    fontSize: 16,
  },

  bodyCareHint: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 2,
    marginBottom: 38,
  },

  bodyCareImageFrame: {
    width: "100%",
    maxWidth: 320,
    alignSelf: "center",
    position: "relative",
    marginBottom: 16,
    overflow: "visible",
  },

  bodyCareImage: {
    width: "100%",
    height: "100%",
  },

  bodyCareImageOverlay: {
    position: "absolute",
    width: "100%",
    height: "100%",
    zIndex: 1,
  },

  bodyCareZone: {
    position: "absolute",
    width: "50%",
    height: "50%",
    zIndex: 2,
  },

  bodyCareTopLeft: {
    top: 0,
    left: 0,
  },

  bodyCareTopRight: {
    top: 0,
    right: 0,
  },

  bodyCareBottomLeft: {
    bottom: 0,
    left: 0,
  },

  bodyCareBottomRight: {
    bottom: 0,
    right: 0,
  },

  bodyCareAmountInput: {
    position: "absolute",
    zIndex: 3,
    width: 56,
    height: 38,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 0,
    fontSize: 16,
    lineHeight: 21,
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: false,
  },

  bodyCareAmountTop: {
    top: -30,
  },

  bodyCareAmountBottom: {
    bottom: -30,
  },

  bodyCareAmountLeft: {
    left: 8,
  },

  bodyCareAmountRight: {
    right: 8,
  },
  bodyCareImageLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },

  bodyCareInputAnimationLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 3,
  },

  bodyCareProductOptions: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 6,
    marginBottom: 2,
  },

  bodyCareProductOption: {
    minHeight: 46,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  bodyCareProductOptionText: {
    fontSize: 15,
  },
  bodyCareAnimatedContent: {
    width: "100%",
    overflow: "visible",
  },
  todoSection: {
    width: "100%",
    marginTop: 24,
    alignItems: "center",
  },
  todoListContainer: {
    width: "100%",
    marginTop: 10,
    alignItems: "center",
    gap: 12,
  },
  todoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    maxWidth: "100%",
    gap: 8,
  },
  todoIconButton: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  todoTitleBox: {
    flexShrink: 1,
    minWidth: 0,
  },
  todoTitleText: {
    fontSize: 18,
    lineHeight: 24,
    textAlign: "left",
  },
  todoTimestampCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  todoTimestampText: {
    fontSize: 16,
    lineHeight: 22,
  },
  todoInlineInput: {
    fontSize: 18,
    lineHeight: 24,
    minWidth: 100,
    borderBottomWidth: 1,
    paddingVertical: 1,
    paddingHorizontal: 2,
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  todoAddRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    maxWidth: "100%",
    gap: 8,
    paddingVertical: 2,
  },
  todoAddText: {
    fontSize: 18,
    lineHeight: 24,
  },
});
