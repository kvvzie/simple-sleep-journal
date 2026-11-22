import { useAppearance } from "@/contexts/appearance-context";
import { memo } from "react";
import { ScrollView, Text, View } from "react-native";
import { styles } from "../settings/settings.styles";

function ToDiscuss() {
  const { colors, resolveFont } = useAppearance();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text
            style={[
              styles.title,
              { color: colors.text, fontFamily: resolveFont("bold") },
            ]}
          >
            to discuss
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

export default memo(ToDiscuss);
