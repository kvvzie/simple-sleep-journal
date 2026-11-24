import { useAppearance } from "@/contexts/appearance-context";
import { useToast } from "@/contexts/toast-context";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";
import {
  addDiscussionTopic,
  deleteDiscussionTopic,
  deleteWeekDiscussionTopics,
  getTopicsForWeek,
  getWeekLastEdited,
  moveDiscussionTopic,
  toggleDiscussionTopicCompleted,
  updateDiscussionTopic,
} from "@/lib/db";
import {
  computeDynamicBoxHeight,
  getExpandedBoxBounds,
  isDoubleTap,
  isTapMovementWithinThreshold,
} from "@/lib/editor-utils";
import { Feather, Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  ScrollViewInstance,
  Text,
  TextInput,
  TextInputInstance,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedDottedBorder from "../animated-dotted-border";
import AnimatedRadioDot from "../animated-radio-dot";
import ConfirmDialog from "../confirm-dialog";
import { getLocalTodayIsoDate } from "../sleep-modal/todo.utils";
import { ToastHost } from "../top-toast";
import { formatMovedToWeekToast } from "../top-toast/top-toast.utils";
import { styles } from "./to-discuss.styles";
import {
  type DiscussionTopic,
  formatWeekHeaderParts,
  getMoveTargetForTopic,
  parseWeekKey,
} from "./to-discuss.utils";

type Props = {
  visible: boolean;
  weekKey: string | null;
  currentWeekKey: string;
  onClose: () => void;
  onSaved: () => void;
};

const SCREEN_HEIGHT = Dimensions.get("window").height;
const CLOSE_THRESHOLD = 90;
const BASE_DESC_MIN_HEIGHT = 57;
const BASE_DESC_MAX_HEIGHT = 129;
const DESC_READ_VERTICAL_PADDING = 16;
const EXPANDED_DESC_BOUNDS = getExpandedBoxBounds(
  BASE_DESC_MIN_HEIGHT,
  BASE_DESC_MAX_HEIGHT,
  true,
  3.2,
);

function ExpandableDescriptionBox({
  expanded,
  contentHeight,
  active,
  idleColor,
  highlightColor,
  innerBorderColor,
  children,
}: {
  expanded: boolean;
  contentHeight: number;
  active: boolean;
  idleColor: string;
  highlightColor: string;
  innerBorderColor: string;
  children: ReactNode;
}) {
  const initialHeight = computeDynamicBoxHeight({
    contentHeight,
    baseMinHeight: BASE_DESC_MIN_HEIGHT,
    baseMaxHeight: BASE_DESC_MAX_HEIGHT,
    expandedMaxHeight: EXPANDED_DESC_BOUNDS.maxHeight,
    expanded,
  });
  const boxHeightAnim = useRef(new Animated.Value(initialHeight)).current;
  const hasMeasuredRef = useRef(contentHeight > 0);
  const prevExpandedRef = useRef(expanded);
  const lastTargetHeightRef = useRef(initialHeight);

  useEffect(() => {
    const targetHeight = computeDynamicBoxHeight({
      contentHeight,
      baseMinHeight: BASE_DESC_MIN_HEIGHT,
      baseMaxHeight: BASE_DESC_MAX_HEIGHT,
      expandedMaxHeight: EXPANDED_DESC_BOUNDS.maxHeight,
      expanded,
    });
    const expandedChanged = prevExpandedRef.current !== expanded;
    prevExpandedRef.current = expanded;

    if (!hasMeasuredRef.current && contentHeight > 0) {
      hasMeasuredRef.current = true;
      lastTargetHeightRef.current = targetHeight;
      boxHeightAnim.stopAnimation();
      boxHeightAnim.setValue(targetHeight);
      return;
    }

    if (Math.abs(targetHeight - lastTargetHeightRef.current) < 1) {
      return;
    }
    lastTargetHeightRef.current = targetHeight;
    boxHeightAnim.stopAnimation();
    Animated.timing(boxHeightAnim, {
      toValue: targetHeight,
      duration: expandedChanged ? 200 : 110,
      easing: expandedChanged
        ? Easing.out(Easing.cubic)
        : Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [expanded, contentHeight, boxHeightAnim]);

  return (
    <AnimatedDottedBorder
      active={active}
      idleColor={idleColor}
      highlightColor={highlightColor}
      innerBorderColor={innerBorderColor}
      style={styles.descriptionBoxWrap}
    >
      <Animated.View
        style={{
          width: "100%",
          height: boxHeightAnim,
        }}
      >
        {children}
      </Animated.View>
    </AnimatedDottedBorder>
  );
}

function DynamicTitleInput({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor,
  textColor,
  underlineColor,
  fontFamily,
  onSubmitEditing,
  autoFocus = false,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  textColor: string;
  underlineColor: string;
  fontFamily: string;
  onSubmitEditing: () => void;
  autoFocus?: boolean;
}) {
  const [boxWidth, setBoxWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);

  const underlineWidth =
    boxWidth > 0
      ? Math.min(boxWidth, Math.max(48, textWidth + 8))
      : Math.max(48, textWidth + 8);

  return (
    <View
      onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}
      style={styles.titleInputWrap}
    >
      <View pointerEvents="none" style={styles.titleMeasureOverlay}>
        <Text
          numberOfLines={1}
          onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
          style={[styles.titleMeasureText, { fontFamily }]}
        >
          {value || placeholder || " "}
        </Text>
      </View>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        autoFocus={autoFocus}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        returnKeyType="next"
        onSubmitEditing={onSubmitEditing}
        style={[styles.titleInput, { color: textColor, fontFamily }]}
      />

      <View
        style={[
          styles.titleUnderline,
          { width: underlineWidth, backgroundColor: underlineColor },
        ]}
      />
    </View>
  );
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export default function WeekDiscussModal({
  visible,
  weekKey,
  currentWeekKey,
  onClose,
  onSaved,
}: Props) {
  const scheme = useAppColorScheme();
  const insets = useSafeAreaInsets();
  const { colors, resolveFont, theme } = useAppearance();
  const { showToast } = useToast();

  const [topics, setTopics] = useState<DiscussionTopic[]>([]);
  const [lastEdited, setLastEdited] = useState<string | null>(null);
  const modalSnapKey = weekKey ?? "closed";

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFocusTarget, setEditFocusTarget] = useState<
    "title" | "description"
  >("title");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const editingIdRef = useRef<string | null>(null);
  const editTitleRef = useRef("");
  const editDescriptionRef = useRef("");
  const editHandledRef = useRef(false);
  const editDescInputRef = useRef<TextInputInstance>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const isAddingRef = useRef(false);
  const newTitleRef = useRef("");
  const newDescriptionRef = useRef("");
  const addHandledRef = useRef(false);
  const newDescInputRef = useRef<TextInputInstance>(null);

  const [expandedTopicIds, setExpandedTopicIds] = useState<
    Record<string, boolean>
  >({});
  const [topicContentHeights, setTopicContentHeights] = useState<
    Record<string, number>
  >({});
  const [newTopicExpanded, setNewTopicExpanded] = useState(false);
  const [newTopicContentHeight, setNewTopicContentHeight] = useState(0);
  const lastDescTapRef = useRef<{ topicId: string; atMs: number } | null>(null);
  const touchedInsideActiveCardRef = useRef(false);
  const outsideTapStartRef = useRef<{
    x: number;
    y: number;
    activeKey: string;
  } | null>(null);

  const [topicPendingDelete, setTopicPendingDelete] =
    useState<DiscussionTopic | null>(null);
  const [topicPendingMove, setTopicPendingMove] = useState<{
    topic: DiscussionTopic;
    targetWeekKey: string;
  } | null>(null);
  const [confirmClearWeekVisible, setConfirmClearWeekVisible] = useState(false);

  const scrollViewRef = useRef<ScrollViewInstance>(null);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const closedRef = useRef(false);
  const hasPendingSaveToastRef = useRef(false);
  const clearedWeekRef = useRef(false);

  const headerParts = useMemo(() => {
    if (!weekKey) return { weekLabel: "", dateRangeLabel: "" };
    const parsed = parseWeekKey(weekKey);
    if (!parsed) return { weekLabel: weekKey, dateRangeLabel: "" };
    return formatWeekHeaderParts(parsed.weekYear, parsed.week);
  }, [weekKey]);

  const dateRangeFont = theme.font?.name
    ? resolveFont("italic")
    : "Redaction20-Italic";

  const resetComposerStates = () => {
    editingIdRef.current = null;
    editTitleRef.current = "";
    editDescriptionRef.current = "";
    editHandledRef.current = false;
    setEditingId(null);
    setEditFocusTarget("title");
    setEditTitle("");
    setEditDescription("");

    isAddingRef.current = false;
    newTitleRef.current = "";
    newDescriptionRef.current = "";
    addHandledRef.current = false;
    setIsAdding(false);
    setNewTitle("");
    setNewDescription("");

    setExpandedTopicIds({});
    setTopicContentHeights({});
    setNewTopicExpanded(false);
    setNewTopicContentHeight(0);
    lastDescTapRef.current = null;
    touchedInsideActiveCardRef.current = false;
    outsideTapStartRef.current = null;
  };

  const refreshWeekData = async (targetWeekKey = weekKey) => {
    if (!targetWeekKey) return;
    const [loadedTopics, updated] = await Promise.all([
      getTopicsForWeek(targetWeekKey),
      getWeekLastEdited(targetWeekKey),
    ]);
    setTopics(loadedTopics);
    setLastEdited(updated);
  };

  useEffect(() => {
    let active = true;
    if (visible && weekKey) {
      closedRef.current = false;
      hasPendingSaveToastRef.current = false;
      clearedWeekRef.current = false;
      resetComposerStates();
      setTopicPendingDelete(null);
      setTopicPendingMove(null);
      setConfirmClearWeekVisible(false);
      setTopics([]);
      setLastEdited(null);
      translateY.setValue(SCREEN_HEIGHT);
      void (async () => {
        const [loadedTopics, updated] = await Promise.all([
          getTopicsForWeek(weekKey),
          getWeekLastEdited(weekKey),
        ]);
        if (!active) return;
        setTopics(loadedTopics);
        setLastEdited(updated);
      })();
      Animated.timing(translateY, {
        toValue: 0,
        duration: 185,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (!visible) {
      resetComposerStates();
      setTopics([]);
      setLastEdited(null);
      setTopicPendingDelete(null);
      setTopicPendingMove(null);
      setConfirmClearWeekVisible(false);
    }
    return () => {
      active = false;
    };
  }, [visible, weekKey]);

  useEffect(() => {
    if (visible) {
      StatusBar.setStyle("light");
    } else {
      StatusBar.setStyle(scheme === "dark" ? "light" : "dark");
    }
  }, [visible, scheme]);

  const hasDraftToSave = () => {
    if (editingIdRef.current !== null) {
      const target = topics.find((t) => t.id === editingIdRef.current);
      const trimmedTitle = editTitleRef.current.trim();
      const nextDesc = editDescriptionRef.current;
      return Boolean(
        target &&
          trimmedTitle.length > 0 &&
          (trimmedTitle !== target.title || nextDesc !== target.description),
      );
    }
    if (isAddingRef.current) {
      return newTitleRef.current.trim().length > 0;
    }
    return false;
  };

  const commitEdit = async (dismissKeyboard = true) => {
    const activeId = editingIdRef.current;
    if (editHandledRef.current || !activeId) return;
    editHandledRef.current = true;
    const target = topics.find((t) => t.id === activeId);
    const trimmedTitle = editTitleRef.current.trim();
    const nextDesc = editDescriptionRef.current;

    editingIdRef.current = null;
    editTitleRef.current = "";
    editDescriptionRef.current = "";
    setEditingId(null);
    setEditFocusTarget("title");
    setEditTitle("");
    setEditDescription("");
    if (dismissKeyboard) {
      Keyboard.dismiss();
    } else {
      requestAnimationFrame(() => {
        if (editingIdRef.current === null && !isAddingRef.current) {
          Keyboard.dismiss();
        }
      });
    }

    if (
      target &&
      trimmedTitle.length > 0 &&
      (trimmedTitle !== target.title || nextDesc !== target.description)
    ) {
      hasPendingSaveToastRef.current = true;
      await updateDiscussionTopic(target.id, trimmedTitle, nextDesc);
      await refreshWeekData();
      onSaved();
    }
  };

  const commitAdd = async (dismissKeyboard = true) => {
    if (addHandledRef.current || !isAddingRef.current) return;
    addHandledRef.current = true;
    const trimmedTitle = newTitleRef.current.trim();
    const desc = newDescriptionRef.current;

    isAddingRef.current = false;
    newTitleRef.current = "";
    newDescriptionRef.current = "";
    setIsAdding(false);
    setNewTitle("");
    setNewDescription("");
    setNewTopicExpanded(false);
    if (dismissKeyboard) {
      Keyboard.dismiss();
    } else {
      requestAnimationFrame(() => {
        if (editingIdRef.current === null && !isAddingRef.current) {
          Keyboard.dismiss();
        }
      });
    }

    if (weekKey && trimmedTitle.length > 0) {
      hasPendingSaveToastRef.current = true;
      await addDiscussionTopic(
        weekKey,
        trimmedTitle,
        desc,
        getLocalTodayIsoDate(),
      );
      await refreshWeekData();
      onSaved();
    }
  };

  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () => {
      if (editingIdRef.current !== null) {
        void commitEdit();
      } else if (isAddingRef.current) {
        void commitAdd();
      }
    });
    return () => sub.remove();
  }, [topics, weekKey]);

  const closeAnimated = (onAfterClose?: () => void) => {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      onClose();
      if (onAfterClose) {
        requestAnimationFrame(() => {
          onAfterClose();
        });
      }
    });
  };

  const dismissSheet = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    const willCommitDraft = hasDraftToSave();
    if (editingIdRef.current !== null) {
      void commitEdit();
    } else if (isAddingRef.current) {
      void commitAdd();
    } else {
      Keyboard.dismiss();
    }
    const postCloseToast = clearedWeekRef.current
      ? { message: "week deleted", icon: "trash-outline" as const }
      : willCommitDraft || hasPendingSaveToastRef.current
        ? { message: "saved", icon: "checkmark-outline" as const }
        : null;
    closeAnimated(
      postCloseToast ? () => showToast(postCloseToast) : undefined,
    );
  };

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      dismissSheet();
      return true;
    });
    return () => sub.remove();
  }, [visible, topics, weekKey]);

  const sheetPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > CLOSE_THRESHOLD || g.vy > 0.6) {
          dismissSheet();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 200,
          }).start();
        }
      },
      onPanResponderTerminate: (_, g) => {
        if (g.dy > CLOSE_THRESHOLD) {
          dismissSheet();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 200,
          }).start();
        }
      },
    }),
  ).current;

  const startEditing = (
    topic: DiscussionTopic,
    focusTarget: "title" | "description" = "title",
  ) => {
    outsideTapStartRef.current = null;
    if (editingIdRef.current !== null && editingIdRef.current !== topic.id) {
      void commitEdit(false);
    } else if (isAddingRef.current) {
      void commitAdd(false);
    }
    editHandledRef.current = false;
    editingIdRef.current = topic.id;
    editTitleRef.current = topic.title;
    editDescriptionRef.current = topic.description;
    setEditFocusTarget(focusTarget);
    setEditingId(topic.id);
    setEditTitle(topic.title);
    setEditDescription(topic.description);
  };

  const handleDescriptionDoubleTap = (topic: DiscussionTopic) => {
    const now = Date.now();
    if (
      lastDescTapRef.current?.topicId === topic.id &&
      isDoubleTap(lastDescTapRef.current.atMs, now)
    ) {
      lastDescTapRef.current = null;
      startEditing(topic, "description");
      return;
    }
    lastDescTapRef.current = { topicId: topic.id, atMs: now };
  };

  const toggleTopicExpanded = (topicId: string) => {
    setExpandedTopicIds((prev) => ({
      ...prev,
      [topicId]: !prev[topicId],
    }));
  };

  const updateTopicContentHeight = (topicId: string, height: number) => {
    if (!Number.isFinite(height) || height <= 0) return;
    setTopicContentHeights((prev) => {
      const current = prev[topicId] ?? 0;
      if (Math.abs(current - height) < 1) return prev;
      return { ...prev, [topicId]: height };
    });
  };

  const updateNewTopicContentHeight = (height: number) => {
    if (!Number.isFinite(height) || height <= 0) return;
    setNewTopicContentHeight((prev) =>
      Math.abs(prev - height) < 1 ? prev : height,
    );
  };

  const startAdding = () => {
    outsideTapStartRef.current = null;
    if (editingIdRef.current !== null) {
      void commitEdit(false);
    }
    addHandledRef.current = false;
    isAddingRef.current = true;
    newTitleRef.current = "";
    newDescriptionRef.current = "";
    setNewTitle("");
    setNewDescription("");
    setNewTopicExpanded(false);
    setNewTopicContentHeight(0);
    setIsAdding(true);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 120);
  };

  const handleToggleCompleted = async (topic: DiscussionTopic) => {
    if (editingIdRef.current === topic.id) return;
    hasPendingSaveToastRef.current = true;
    await toggleDiscussionTopicCompleted(topic.id);
    await refreshWeekData();
    onSaved();
  };

  const handleRequestMove = async (topic: DiscussionTopic) => {
    if (!weekKey || topic.completed) return;
    const { targetWeekKey, requiresConfirm } = getMoveTargetForTopic(
      weekKey,
      currentWeekKey,
    );
    if (!requiresConfirm) {
      await moveDiscussionTopic(topic.id, targetWeekKey);
      showToast({
        message: formatMovedToWeekToast(targetWeekKey),
        icon: "arrow-forward-outline",
      });
      await refreshWeekData();
      onSaved();
      return;
    }
    setTopicPendingMove({ topic, targetWeekKey });
  };

  const handleConfirmMove = async () => {
    const pending = topicPendingMove;
    setTopicPendingMove(null);
    if (!pending) return;
    await moveDiscussionTopic(pending.topic.id, pending.targetWeekKey);
    showToast({
      message: formatMovedToWeekToast(pending.targetWeekKey),
      icon: "arrow-forward-outline",
    });
    await refreshWeekData();
    onSaved();
  };

  const handleConfirmDeleteTopic = async () => {
    const target = topicPendingDelete;
    setTopicPendingDelete(null);
    if (!target) return;
    await deleteDiscussionTopic(target.id);
    showToast({ message: "topic deleted", icon: "trash-outline" });
    await refreshWeekData();
    onSaved();
  };

  const handleConfirmClearWeek = async () => {
    setConfirmClearWeekVisible(false);
    if (!weekKey || clearedWeekRef.current || closedRef.current) return;
    clearedWeekRef.current = true;
    await deleteWeekDiscussionTopics(weekKey);
    await refreshWeekData();
    onSaved();
    dismissSheet();
  };

  const deleteIconColor = scheme === "dark" ? "#E07A7A" : "#D96666";

  const moveTargetLabel = useMemo(() => {
    if (!topicPendingMove) return "";
    const parsed = parseWeekKey(topicPendingMove.targetWeekKey);
    return parsed ? `W${parsed.week}` : topicPendingMove.targetWeekKey;
  }, [topicPendingMove]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismissSheet}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]}
      >
        <Pressable
          style={styles.backdropDismiss}
          onPress={dismissSheet}
        />

        <Animated.View
          onTouchStart={(e) => {
            const activeKey =
              editingIdRef.current ?? (isAddingRef.current ? "__adding__" : null);
            if (!touchedInsideActiveCardRef.current && activeKey !== null) {
              outsideTapStartRef.current = {
                x: e.nativeEvent.pageX,
                y: e.nativeEvent.pageY,
                activeKey,
              };
            } else {
              outsideTapStartRef.current = null;
            }
            touchedInsideActiveCardRef.current = false;
          }}
          onTouchEnd={(e) => {
            const start = outsideTapStartRef.current;
            outsideTapStartRef.current = null;
            if (!start) return;
            if (
              !isTapMovementWithinThreshold(
                e.nativeEvent.pageX - start.x,
                e.nativeEvent.pageY - start.y,
              )
            ) {
              return;
            }
            if (start.activeKey === "__adding__" && isAddingRef.current) {
              void commitAdd(false);
            } else if (editingIdRef.current === start.activeKey) {
              void commitEdit(false);
            }
          }}
          onTouchCancel={() => {
            outsideTapStartRef.current = null;
          }}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.modalBackground,
              transform: [{ translateY }],
            },
          ]}
        >
          <View
            style={styles.handleArea}
            {...sheetPan.panHandlers}
            hitSlop={{ top: 20, bottom: 20, left: 60, right: 60 }}
          >
            <View style={styles.handle} />
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.keyboardWrap}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(28, insets.bottom + 18) },
            ]}
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalHeaderBlock}>
              <Text
                style={[
                  styles.modalWeekTitle,
                  { color: colors.text, fontFamily: resolveFont("bold") },
                ]}
              >
                {headerParts.weekLabel}
              </Text>
              {headerParts.dateRangeLabel.length > 0 && (
                <Text
                  style={[
                    styles.modalDateRange,
                    { color: colors.textSecondary, fontFamily: dateRangeFont },
                  ]}
                >
                  {headerParts.dateRangeLabel}
                </Text>
              )}
            </View>

            <View style={styles.topicsContainer}>
              {topics.map((topic) => {
                const isEditing = editingId === topic.id;
                const isCompleted = topic.completed;
                const isExpanded = Boolean(expandedTopicIds[topic.id]);

                return (
                  <View
                    key={topic.id}
                    style={styles.topicCard}
                    onTouchStartCapture={
                      isEditing
                        ? () => {
                            touchedInsideActiveCardRef.current = true;
                          }
                        : undefined
                    }
                  >
                    <View style={styles.topicRow}>
                      <Pressable
                        unstable_pressDelay={0}
                        onPress={() => void handleToggleCompleted(topic)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 6 }}
                        style={({ pressed }) => [
                          styles.iconButton,
                          pressed && { opacity: 0.75 },
                        ]}
                      >
                        <AnimatedRadioDot
                          checked={isCompleted}
                          size={22}
                          color={colors.text}
                          snapKey={modalSnapKey}
                        />
                      </Pressable>

                      <View style={styles.titleBox}>
                        {isEditing ? (
                          <DynamicTitleInput
                            value={editTitle}
                            onChangeText={(text) => {
                              editTitleRef.current = text;
                              setEditTitle(text);
                            }}
                            autoFocus={editFocusTarget === "title"}
                            textColor={colors.text}
                            underlineColor={colors.textSecondary}
                            fontFamily={resolveFont("regular")}
                            onSubmitEditing={() =>
                              editDescInputRef.current?.focus()
                            }
                          />
                        ) : (
                          <Text
                            key={`${topic.id}-${isCompleted ? "done" : "open"}`}
                            style={[
                              styles.titleText,
                              {
                                color: isCompleted
                                  ? colors.textSecondary
                                  : colors.text,
                                fontFamily: resolveFont("regular"),
                                textDecorationLine: isCompleted
                                  ? "line-through"
                                  : "none",
                                textDecorationStyle: "solid",
                                textDecorationColor: isCompleted
                                  ? colors.textSecondary
                                  : undefined,
                              },
                            ]}
                          >
                            {topic.title}
                          </Text>
                        )}
                      </View>

                      {isEditing ? (
                        <>
                          <Pressable
                            unstable_pressDelay={0}
                            onPress={() => toggleTopicExpanded(topic.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                            style={({ pressed }) => [
                              styles.iconButton,
                              pressed && { opacity: 0.75 },
                            ]}
                          >
                            <Feather
                              name={isExpanded ? "minimize" : "maximize"}
                              size={18}
                              color={colors.text}
                            />
                          </Pressable>

                          <Pressable
                            unstable_pressDelay={0}
                            onPress={() => void commitEdit(true)}
                            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                            style={({ pressed }) => [
                              styles.iconButton,
                              pressed && { opacity: 0.75 },
                            ]}
                          >
                            <Ionicons
                              name="checkmark"
                              size={21}
                              color={colors.text}
                            />
                          </Pressable>
                        </>
                      ) : (
                        <>
                          <Pressable
                            unstable_pressDelay={0}
                            disabled={isCompleted}
                            onPress={() => void handleRequestMove(topic)}
                            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                            style={({ pressed }) => [
                              styles.iconButton,
                              isCompleted && { opacity: 0.35 },
                              !isCompleted && pressed && { opacity: 0.75 },
                            ]}
                          >
                            <Ionicons
                              name="swap-horizontal"
                              size={20}
                              color={
                                isCompleted ? colors.textSecondary : colors.text
                              }
                            />
                          </Pressable>

                          <Pressable
                            unstable_pressDelay={0}
                            onPress={() => toggleTopicExpanded(topic.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                            style={({ pressed }) => [
                              styles.iconButton,
                              pressed && { opacity: 0.75 },
                            ]}
                          >
                            <Feather
                              name={isExpanded ? "minimize" : "maximize"}
                              size={18}
                              color={colors.text}
                            />
                          </Pressable>

                          <Pressable
                            unstable_pressDelay={0}
                            onPress={() => startEditing(topic, "title")}
                            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                            style={({ pressed }) => [
                              styles.iconButton,
                              pressed && { opacity: 0.75 },
                            ]}
                          >
                            <Feather
                              name="edit-2"
                              size={19}
                              color={colors.text}
                            />
                          </Pressable>
                        </>
                      )}

                      <Pressable
                        unstable_pressDelay={0}
                        onPress={() => {
                          if (editingIdRef.current === topic.id) {
                            editHandledRef.current = true;
                            editingIdRef.current = null;
                            setEditingId(null);
                          }
                          Keyboard.dismiss();
                          setTopicPendingDelete(topic);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
                        style={({ pressed }) => [
                          styles.iconButton,
                          pressed && { opacity: 0.75 },
                        ]}
                      >
                        <Ionicons
                          name="trash"
                          size={20}
                          color={deleteIconColor}
                        />
                      </Pressable>
                    </View>

                    <ExpandableDescriptionBox
                      expanded={isExpanded}
                      contentHeight={topicContentHeights[topic.id] ?? 0}
                      active={isEditing}
                      idleColor={colors.textSecondary}
                      highlightColor={colors.text}
                      innerBorderColor={colors.modalBackground}
                    >
                      {isEditing ? (
                        <TextInput
                          ref={editDescInputRef}
                          value={editDescription}
                          autoFocus={editFocusTarget === "description"}
                          onChangeText={(text) => {
                            editDescriptionRef.current = text;
                            setEditDescription(text);
                          }}
                          onContentSizeChange={(e) =>
                            updateTopicContentHeight(
                              topic.id,
                              e.nativeEvent.contentSize.height,
                            )
                          }
                          multiline
                          scrollEnabled
                          placeholder="text will be here"
                          placeholderTextColor={colors.textSecondary}
                          style={[
                            styles.descriptionInput,
                            {
                              color: colors.text,
                              fontFamily: resolveFont(
                                editDescription ? "regular" : "italic",
                              ),
                            },
                          ]}
                        />
                      ) : (
                        <ScrollView
                          style={styles.descriptionScroll}
                          contentContainerStyle={styles.descriptionScrollContent}
                          nestedScrollEnabled
                          showsVerticalScrollIndicator={false}
                        >
                          <Pressable
                            onPress={() => handleDescriptionDoubleTap(topic)}
                            style={styles.descriptionReadPressable}
                          >
                            <Text
                              onLayout={(e) =>
                                updateTopicContentHeight(
                                  topic.id,
                                  e.nativeEvent.layout.height +
                                    DESC_READ_VERTICAL_PADDING,
                                )
                              }
                              style={[
                                styles.descriptionText,
                                {
                                  color: topic.description
                                    ? isCompleted
                                      ? colors.textSecondary
                                      : colors.text
                                    : colors.textSecondary,
                                  fontFamily: resolveFont(
                                    topic.description ? "regular" : "italic",
                                  ),
                                },
                              ]}
                            >
                              {topic.description || "text will be here"}
                            </Text>
                          </Pressable>
                        </ScrollView>
                      )}
                    </ExpandableDescriptionBox>

                    <View
                      style={[
                        styles.divider,
                        { backgroundColor: colors.textSecondary },
                      ]}
                    />
                  </View>
                );
              })}

              {isAdding ? (
                <View
                  style={styles.topicCard}
                  onTouchStartCapture={() => {
                    touchedInsideActiveCardRef.current = true;
                  }}
                >
                  <View style={styles.topicRow}>
                    <View style={styles.iconButton}>
                      <Ionicons
                        name="add"
                        size={22}
                        color={colors.textSecondary}
                      />
                    </View>

                    <View style={styles.titleBox}>
                      <DynamicTitleInput
                        value={newTitle}
                        onChangeText={(text) => {
                          newTitleRef.current = text;
                          setNewTitle(text);
                        }}
                        autoFocus
                        placeholder="new topic"
                        placeholderTextColor={colors.textSecondary}
                        textColor={colors.text}
                        underlineColor={colors.textSecondary}
                        fontFamily={resolveFont("regular")}
                        onSubmitEditing={() =>
                          newDescInputRef.current?.focus()
                        }
                      />
                    </View>

                    <Pressable
                      unstable_pressDelay={0}
                      onPress={() => setNewTopicExpanded((v) => !v)}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                      style={({ pressed }) => [
                        styles.iconButton,
                        pressed && { opacity: 0.75 },
                      ]}
                    >
                      <Feather
                        name={newTopicExpanded ? "minimize" : "maximize"}
                        size={18}
                        color={colors.text}
                      />
                    </Pressable>

                    <Pressable
                      unstable_pressDelay={0}
                      onPress={() => void commitAdd(true)}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
                      style={({ pressed }) => [
                        styles.iconButton,
                        pressed && { opacity: 0.75 },
                      ]}
                    >
                      <Ionicons
                        name="checkmark"
                        size={21}
                        color={colors.text}
                      />
                    </Pressable>
                  </View>

                  <ExpandableDescriptionBox
                    expanded={newTopicExpanded}
                    contentHeight={newTopicContentHeight}
                    active
                    idleColor={colors.textSecondary}
                    highlightColor={colors.text}
                    innerBorderColor={colors.modalBackground}
                  >
                    <TextInput
                      ref={newDescInputRef}
                      value={newDescription}
                      onChangeText={(text) => {
                        newDescriptionRef.current = text;
                        setNewDescription(text);
                      }}
                      onContentSizeChange={(e) =>
                        updateNewTopicContentHeight(
                          e.nativeEvent.contentSize.height,
                        )
                      }
                      multiline
                      scrollEnabled
                      placeholder="text will be here"
                      placeholderTextColor={colors.textSecondary}
                      style={[
                        styles.descriptionInput,
                        {
                          color: colors.text,
                          fontFamily: resolveFont(
                            newDescription ? "regular" : "italic",
                          ),
                        },
                      ]}
                    />
                  </ExpandableDescriptionBox>
                </View>
              ) : (
                <View style={styles.topicCard}>
                  <Pressable
                    unstable_pressDelay={0}
                    onPress={startAdding}
                    hitSlop={{ top: 8, bottom: 6, left: 6, right: 12 }}
                    style={({ pressed }) => [
                      styles.topicRow,
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <View style={styles.iconButton}>
                      <Ionicons
                        name="add"
                        size={22}
                        color={colors.textSecondary}
                      />
                    </View>
                    <View style={styles.titleBox}>
                      <Text
                        style={[
                          styles.addTriggerText,
                          {
                            color: colors.textSecondary,
                            fontFamily: resolveFont("regular"),
                          },
                        ]}
                      >
                        new topic
                      </Text>
                    </View>
                  </Pressable>

                  <Pressable
                    unstable_pressDelay={0}
                    onPress={startAdding}
                    style={({ pressed }) => pressed && { opacity: 0.8 }}
                  >
                    <AnimatedDottedBorder
                      active={false}
                      idleColor={colors.textSecondary}
                      highlightColor={colors.text}
                      innerBorderColor={colors.modalBackground}
                      style={styles.previewDescriptionBoxWrap}
                    >
                      <View style={styles.previewDescriptionInner}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.descriptionText,
                            {
                              color: colors.textSecondary,
                              fontFamily: resolveFont("italic"),
                            },
                          ]}
                        >
                          text will be here
                        </Text>
                      </View>
                    </AnimatedDottedBorder>
                  </Pressable>
                </View>
              )}
            </View>

            {topics.length > 0 && lastEdited && (
              <Text
                style={[
                  styles.lastEditedText,
                  {
                    color: colors.textSecondary,
                    fontFamily: resolveFont("italic"),
                  },
                ]}
              >
                last edited: {formatTimestamp(lastEdited)}
              </Text>
            )}

            {topics.length > 0 && (
              <Pressable
                unstable_pressDelay={0}
                onPress={() => setConfirmClearWeekVisible(true)}
                style={({ pressed }) => [
                  styles.deleteButton,
                  { backgroundColor: colors.text },
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text
                  style={[
                    styles.deleteText,
                    {
                      color: colors.background,
                      fontFamily: resolveFont("bold"),
                    },
                  ]}
                >
                  delete
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </Animated.View>

        <ConfirmDialog
          visible={topicPendingDelete !== null}
          message={`Are you sure you want to delete "${topicPendingDelete?.title ?? ""}"?`}
          onConfirm={() => void handleConfirmDeleteTopic()}
          onCancel={() => setTopicPendingDelete(null)}
        />

        <ConfirmDialog
          visible={topicPendingMove !== null}
          message={`Move "${topicPendingMove?.topic.title ?? ""}" to ${moveTargetLabel}?`}
          onConfirm={() => void handleConfirmMove()}
          onCancel={() => setTopicPendingMove(null)}
        />

        <ConfirmDialog
          visible={confirmClearWeekVisible}
          message={`Are you sure you want to delete all topics for ${weekKey ?? ""}?`}
          onConfirm={() => void handleConfirmClearWeek()}
          onCancel={() => setConfirmClearWeekVisible(false)}
        />
        {visible && <ToastHost hostId="week-modal" />}
      </KeyboardAvoidingView>
    </Modal>
  );
}
