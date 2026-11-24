import {
  computeDynamicBoxHeight,
  getExpandedBoxBounds,
  isDoubleTap,
} from "@/lib/editor-utils";
import { FontVariant } from "@/lib/theme-utils";
import { ThemePaletteColors } from "@/types/appearance";
import { Feather, Ionicons } from "@expo/vector-icons";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TextInputInstance,
  View,
} from "react-native";
import AnimatedDottedBorder from "../animated-dotted-border";
import { styles } from "./sleep-modal.styles";

const BASE_MIN_HEIGHT = 116;
const BASE_MAX_HEIGHT = 240;
const EXPANDED_BOUNDS = getExpandedBoxBounds(
  BASE_MIN_HEIGHT,
  BASE_MAX_HEIGHT,
  true,
);
const READ_VERTICAL_PADDING = 28;

export type SleepModalCommentHandle = {
  isEditing: () => boolean;
  exitEditMode: (dismissKeyboard?: boolean) => void;
};

type Props = {
  initialComment: string;
  resetKey: number;
  colors: ThemePaletteColors;
  resolveFont: (variant: FontVariant) => string;
  onCommentChange: (nextComment: string) => void;
  onTouchInside?: () => void;
};

const SleepModalCommentSection = forwardRef<SleepModalCommentHandle, Props>(
  function SleepModalCommentSection(
    {
      initialComment,
      resetKey,
      colors,
      resolveFont,
      onCommentChange,
      onTouchInside,
    },
    ref,
  ) {
    const [draft, setDraft] = useState(initialComment);
    const [isEditing, setIsEditing] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const isEditingRef = useRef(false);
    const isExpandedRef = useRef(false);
    const userDirtyRef = useRef(false);
    const inputRef = useRef<TextInputInstance>(null);
    const lastTapRef = useRef<number | null>(null);
    const contentHeightRef = useRef(0);
    const hasMeasuredRef = useRef(false);
    const lastTargetHeightRef = useRef(BASE_MIN_HEIGHT);
    const boxHeightAnim = useRef(new Animated.Value(BASE_MIN_HEIGHT)).current;

    const syncBoxHeight = useCallback(
      (animate: boolean, duration = 200) => {
        const targetHeight = computeDynamicBoxHeight({
          contentHeight: contentHeightRef.current,
          baseMinHeight: BASE_MIN_HEIGHT,
          baseMaxHeight: BASE_MAX_HEIGHT,
          expandedMaxHeight: EXPANDED_BOUNDS.maxHeight,
          expanded: isExpandedRef.current,
        });
        if (Math.abs(targetHeight - lastTargetHeightRef.current) < 1) {
          return;
        }
        lastTargetHeightRef.current = targetHeight;
        boxHeightAnim.stopAnimation();
        if (!animate) {
          boxHeightAnim.setValue(targetHeight);
          return;
        }
        Animated.timing(boxHeightAnim, {
          toValue: targetHeight,
          duration,
          easing:
            duration >= 180
              ? Easing.out(Easing.cubic)
              : Easing.out(Easing.quad),
          useNativeDriver: false,
        }).start();
      },
      [boxHeightAnim],
    );

    const handleContentHeight = useCallback(
      (nextHeight: number) => {
        if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;
        if (Math.abs(nextHeight - contentHeightRef.current) < 1) return;
        contentHeightRef.current = nextHeight;
        if (!hasMeasuredRef.current) {
          hasMeasuredRef.current = true;
          syncBoxHeight(false);
          return;
        }
        syncBoxHeight(true, 110);
      },
      [syncBoxHeight],
    );

    const enterEditMode = useCallback(() => {
      lastTapRef.current = null;
      isEditingRef.current = true;
      setIsEditing(true);
    }, []);

    const exitEditMode = useCallback((dismissKeyboard = false) => {
      if (!isEditingRef.current) return;
      isEditingRef.current = false;
      inputRef.current?.blur();
      setIsEditing(false);
      if (dismissKeyboard) {
        Keyboard.dismiss();
      }
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        isEditing: () => isEditingRef.current,
        exitEditMode,
      }),
      [exitEditMode],
    );

    useEffect(() => {
      isEditingRef.current = false;
      isExpandedRef.current = false;
      userDirtyRef.current = false;
      lastTapRef.current = null;
      contentHeightRef.current = 0;
      hasMeasuredRef.current = false;
      lastTargetHeightRef.current = BASE_MIN_HEIGHT;
      setIsEditing(false);
      setIsExpanded(false);
      boxHeightAnim.stopAnimation();
      boxHeightAnim.setValue(BASE_MIN_HEIGHT);
    }, [resetKey, boxHeightAnim]);

    useEffect(() => {
      if (!userDirtyRef.current) {
        setDraft(initialComment);
      }
    }, [initialComment]);

    useEffect(() => {
      const sub = Keyboard.addListener("keyboardDidHide", () => {
        if (isEditingRef.current) {
          isEditingRef.current = false;
          setIsEditing(false);
        }
      });
      return () => sub.remove();
    }, []);

    const handleChangeText = (nextText: string) => {
      userDirtyRef.current = true;
      setDraft(nextText);
      onCommentChange(nextText);
    };

    const handleReadBoxPress = () => {
      const now = Date.now();
      if (isDoubleTap(lastTapRef.current, now)) {
        enterEditMode();
        return;
      }
      lastTapRef.current = now;
    };

    const toggleExpanded = () => {
      const next = !isExpandedRef.current;
      isExpandedRef.current = next;
      setIsExpanded(next);
      syncBoxHeight(true, 200);
    };

    return (
      <View style={styles.commentSection} onTouchStartCapture={onTouchInside}>
        <View style={styles.commentHeaderRow}>
          <Pressable
            unstable_pressDelay={0}
            onPress={toggleExpanded}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={({ pressed }) => [
              styles.commentHeaderAction,
              styles.commentHeaderSideLeft,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Feather
              name={isExpanded ? "minimize" : "maximize"}
              size={18}
              color={colors.text}
            />
          </Pressable>

          <Text
            style={[
              styles.label,
              styles.commentHeaderLabel,
              {
                color: colors.textSecondary,
                fontFamily: resolveFont("italic"),
              },
            ]}
          >
            comment
          </Text>

          <Pressable
            unstable_pressDelay={0}
            onPress={isEditing ? () => exitEditMode(true) : enterEditMode}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={({ pressed }) => [
              styles.commentHeaderAction,
              styles.commentHeaderSideRight,
              pressed && { opacity: 0.7 },
            ]}
          >
            {isEditing ? (
              <Ionicons name="checkmark" size={21} color={colors.text} />
            ) : (
              <Feather name="edit-2" size={19} color={colors.text} />
            )}
          </Pressable>
        </View>

        <AnimatedDottedBorder
          active={isEditing}
          idleColor={colors.textSecondary}
          highlightColor={colors.text}
          innerBorderColor={colors.modalBackground}
          style={styles.commentBox}
        >
          <Animated.View
            style={{
              width: "100%",
              height: boxHeightAnim,
            }}
          >
            {isEditing ? (
              <TextInput
                ref={inputRef}
                value={draft}
                autoFocus
                onBlur={() => exitEditMode(false)}
                onChangeText={handleChangeText}
                onContentSizeChange={(e) =>
                  handleContentHeight(e.nativeEvent.contentSize.height)
                }
                multiline
                scrollEnabled
                placeholder="text will be here"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.commentInput,
                  {
                    color: colors.text,
                    fontFamily: resolveFont(
                      draft.length > 0 ? "regular" : "italic",
                    ),
                  },
                ]}
              />
            ) : (
              <ScrollView
                style={styles.commentReadScroll}
                contentContainerStyle={styles.commentReadScrollContent}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                <Pressable
                  onPress={handleReadBoxPress}
                  style={styles.commentReadPressable}
                >
                  <Text
                    onLayout={(e) =>
                      handleContentHeight(
                        e.nativeEvent.layout.height + READ_VERTICAL_PADDING,
                      )
                    }
                    style={[
                      styles.commentReadText,
                      {
                        color:
                          draft.length > 0 ? colors.text : colors.textSecondary,
                        fontFamily: resolveFont(
                          draft.length > 0 ? "regular" : "italic",
                        ),
                      },
                    ]}
                  >
                    {draft.length > 0 ? draft : "text will be here"}
                  </Text>
                </Pressable>
              </ScrollView>
            )}
          </Animated.View>
        </AnimatedDottedBorder>
      </View>
    );
  },
);

export default memo(SleepModalCommentSection);
