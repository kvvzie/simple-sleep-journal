import { Colors } from "@/constants/theme";
import { Modal, Pressable, Text, View } from "react-native";
import { styles } from "./confirm-dialog.styles";

import { useAppColorScheme } from "@/hooks/use-app-color-scheme";

type Props = {
  visible: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  visible,
  message,
  onConfirm,
  onCancel,
}: Props) {
  const scheme = useAppColorScheme();
  const colors = Colors[scheme];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}>
        <View style={[styles.box, { backgroundColor: colors.modalBackground }]}>
          <Text
            style={[
              styles.message,
              { color: colors.text, fontFamily: "Redaction20-Regular" },
            ]}
          >
            {message}
          </Text>
          <View style={styles.row}>
            <Pressable
              style={[
                styles.button,
                { backgroundColor: colors.backgroundElement },
              ]}
              onPress={onCancel}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>
                no
              </Text>
            </Pressable>
            <Pressable
              style={[styles.button, { backgroundColor: colors.text }]}
              onPress={onConfirm}
            >
              <Text style={[styles.buttonText, { color: colors.background }]}>
                yes
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
