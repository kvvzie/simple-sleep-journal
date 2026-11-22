import { StyleSheet } from "react-native";

export const NAV_PADDING = 10;
export const NAV_GAP = 2;
export const BUTTON_WIDTH = 52;
export const BUTTON_HEIGHT = 44;
export const OUTER_BUTTON_WIDTH = 44;
export const MIDDLE_BUTTON_WIDTH = 38;

export const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 28,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 999,
    paddingVertical: NAV_PADDING,
    paddingHorizontal: NAV_PADDING + 2,
    gap: NAV_GAP,
  },
  button: {
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_HEIGHT / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  hintWrap: {
    position: "absolute",
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  hintLeft: { right: "100%", marginRight: 2 },
  hintRight: { left: "100%", marginLeft: 2 },
});
export const NAV_BAR_CLEARANCE = 130;
