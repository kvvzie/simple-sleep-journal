import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  box: { width: "100%", borderRadius: 20, padding: 24, alignItems: "center" },
  message: { fontSize: 20, textAlign: "center", marginBottom: 24 },
  row: { flexDirection: "row", gap: 12, width: "100%" },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { fontSize: 16, fontFamily: "Redaction20-Bold" },
});
