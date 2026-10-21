import { useAppearance } from "@/contexts/appearance-context";
import { Modal, Pressable, Text, View } from "react-native";
import { styles } from "./confirm-dialog.styles";

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
  const { colors, resolveFont } = useAppearance();

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
              { color: colors.text, fontFamily: resolveFont("regular") },
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
              <Text
                style={[
                  styles.buttonText,
                  { color: colors.text, fontFamily: resolveFont("bold") },
                ]}
              >
                no
              </Text>
            </Pressable>
            <Pressable
              style={[styles.button, { backgroundColor: colors.text }]}
              onPress={onConfirm}
            >
              <Text
                style={[
                  styles.buttonText,
                  { color: colors.background, fontFamily: resolveFont("bold") },
                ]}
              >
                yes
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
