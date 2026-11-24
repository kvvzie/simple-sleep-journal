import { FontVariant } from "@/lib/theme-utils";
import { ThemePaletteColors } from "@/types/appearance";
import { memo, useEffect, useState } from "react";
import { Text, TextInput } from "react-native";
import AnimatedDottedBorder from "../animated-dotted-border";
import { styles } from "./sleep-modal.styles";

type Props = {
  initialComment: string;
  resetKey: number;
  colors: ThemePaletteColors;
  resolveFont: (variant: FontVariant) => string;
  onCommentChange: (nextComment: string) => void;
};

function SleepModalCommentSection({
  initialComment,
  resetKey,
  colors,
  resolveFont,
  onCommentChange,
}: Props) {
  const [draft, setDraft] = useState(initialComment);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    setFocused(false);
    setDraft(initialComment);
  }, [resetKey, initialComment]);

  const handleChangeText = (nextText: string) => {
    setDraft(nextText);
    onCommentChange(nextText);
  };

  return (
    <>
      <Text
        style={[
          styles.label,
          {
            color: colors.textSecondary,
            fontFamily: resolveFont("italic"),
          },
        ]}
      >
        comment
      </Text>

      <AnimatedDottedBorder
        active={focused}
        idleColor={colors.textSecondary}
        highlightColor={colors.text}
        innerBorderColor={colors.modalBackground}
        style={styles.commentBox}
      >
        <TextInput
          value={draft}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChangeText={handleChangeText}
          multiline
          scrollEnabled
          placeholder="text will be here"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.commentInput,
            {
              color: colors.text,
              fontFamily: resolveFont(draft.length > 0 ? "regular" : "italic"),
            },
          ]}
        />
      </AnimatedDottedBorder>
    </>
  );
}

export default memo(SleepModalCommentSection);
