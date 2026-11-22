import { useAppearance } from "@/contexts/appearance-context";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";
import {
  addTodoTask,
  BodyCareAmounts,
  deleteSleepLog,
  deleteTodoTask,
  getBodyCareLog,
  getLastBodyCareProductId,
  getSleepLog,
  getSleepLogEdits,
  getTodosForDate,
  saveBodyCareLog,
  saveSleepLog,
  SleepLogEdit,
  TodoTask,
  toggleTodoCompleted,
  updateTodoTitle,
} from "@/lib/db";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  DeviceEventEmitter,
  Dimensions,
  Easing,
  Image,
  ImageSourcePropType,
  Keyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  ScrollViewInstance,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewInstance,
} from "react-native";
import AnimatedRadioDot from "../animated-radio-dot";
import ConfirmDialog from "../confirm-dialog";
import WheelPicker, { WheelPickerHandle } from "../wheel-picker";
import { styles } from "./sleep-modal.styles";
import TodoListSection from "./todo-list-section";

type Props = {
  visible: boolean;
  date: string | null;
  onClose: () => void;
  onSaved: () => void;
};

const SCREEN_HEIGHT = Dimensions.get("window").height;
const CLOSE_THRESHOLD = 90;
const MAX_HOURS = 24;
const HOURS_CENTER = 30;
const HOURS_TOTAL_PAGES = HOURS_CENTER * 2 + 1;
const STAR_SIZE = 26;
const STAR_GAP = 8;

const BODY_CARE_OPTION_HEIGHT = 46;

type BodyCareZone = "top-left" | "top-right" | "bottom-left" | "bottom-right";

type BodyCareProduct = {
  id: string;
  label: string;
  images: {
    full: ImageSourcePropType;
    "top-left": ImageSourcePropType;
    "top-right": ImageSourcePropType;
    "bottom-left": ImageSourcePropType;
    "bottom-right": ImageSourcePropType;
  };
};

const BODY_CARE_ZONES: BodyCareZone[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

const BODY_CARE_PRODUCTS: BodyCareProduct[] = [
  {
    id: "astra-superior-platinum",
    label: "Astra Superior Platinum",
    images: {
      full: require("../../../assets/images/brands/astra-superior-platinum/full.png"),
      "top-left": require("../../../assets/images/brands/astra-superior-platinum/top-left.png"),
      "top-right": require("../../../assets/images/brands/astra-superior-platinum/top-right.png"),
      "bottom-left": require("../../../assets/images/brands/astra-superior-platinum/bottom-left.png"),
      "bottom-right": require("../../../assets/images/brands/astra-superior-platinum/bottom-right.png"),
    },
  },
  {
    id: "gillette-platinum",
    label: "Gillette Platinum",
    images: {
      full: require("../../../assets/images/brands/gillette-platinum/full.png"),
      "top-left": require("../../../assets/images/brands/gillette-platinum/top-left.png"),
      "top-right": require("../../../assets/images/brands/gillette-platinum/top-right.png"),
      "bottom-left": require("../../../assets/images/brands/gillette-platinum/bottom-left.png"),
      "bottom-right": require("../../../assets/images/brands/gillette-platinum/bottom-right.png"),
    },
  },
  {
    id: "isana-men-classic",
    label: "Isana Men Classic",
    images: {
      full: require("../../../assets/images/brands/isana-men-classic/full.png"),
      "top-left": require("../../../assets/images/brands/isana-men-classic/top-left.png"),
      "top-right": require("../../../assets/images/brands/isana-men-classic/top-right.png"),
      "bottom-left": require("../../../assets/images/brands/isana-men-classic/bottom-left.png"),
      "bottom-right": require("../../../assets/images/brands/isana-men-classic/bottom-right.png"),
    },
  },
];

function pageToHour(page: number) {
  const diff = page - HOURS_CENTER;
  return ((diff % (MAX_HOURS + 1)) + (MAX_HOURS + 1)) % (MAX_HOURS + 1);
}

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  const date = d.toISOString().split("T")[0];
  const time = d.toTimeString().slice(0, 5);
  return `${date} ${time}`;
}

export default function SleepModal({ visible, date, onClose, onSaved }: Props) {
  const scheme = useAppColorScheme();
  const { colors, features, resolveFont } = useAppearance();

  const [hours, setHours] = useState<number | null>(null);
  const [mood, setMood] = useState(0);
  const [comment, setComment] = useState("");
  const [hasEntry, setHasEntry] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [todoPendingDelete, setTodoPendingDelete] = useState<TodoTask | null>(null);
  const [todos, setTodos] = useState<TodoTask[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [scrollLocked, setScrollLocked] = useState(false);
  const scrollViewRef = useRef<ScrollViewInstance>(null);

  const [edits, setEdits] = useState<SleepLogEdit[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const historyOpacity = useRef(new Animated.Value(0)).current;
  const historyTranslate = useRef(new Animated.Value(-6)).current;
  const [loggedAt, setLoggedAt] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [readyHours, setReadyHours] = useState<number | null>(null);
  const [pagerKey, setPagerKey] = useState(0);

  const hoursWheelRef = useRef<WheelPickerHandle>(null);

  const stateRef = useRef({
    hours: 0,
    mood: 0,
    comment: "",
    bodyCareEnabled: false,
    bodyCareProductId: null as string | null,
    bodyCareAmounts: {} as BodyCareAmounts,
    bodyCareSelectedZones: {} as Partial<Record<BodyCareZone, boolean>>,
    date: null as string | null,
    dirty: false,
  });

  const [bodyCareEnabled, setBodyCareEnabled] = useState(false);
  const [bodyCareMenuOpen, setBodyCareMenuOpen] = useState(false);
  const [bodyCareProductPickerOpen, setBodyCareProductPickerOpen] =
    useState(false);

  const bodyCareOverlayOpacity = useRef({
    "top-left": new Animated.Value(0),
    "top-right": new Animated.Value(0),
    "bottom-left": new Animated.Value(0),
    "bottom-right": new Animated.Value(0),
  }).current;

  const bodyCareHeightAnim = useRef(new Animated.Value(0)).current;
  const bodyCareContentOpacity = useRef(new Animated.Value(0)).current;
  const bodyCareContentTranslate = useRef(new Animated.Value(-8)).current;

  const bodyCarePickerProgress = useRef(new Animated.Value(0)).current;

  const [bodyCareContentMounted, setBodyCareContentMounted] = useState(false);
  const [bodyCareSettledOpen, setBodyCareSettledOpen] = useState(false);
  const [bodyCarePickerMounted, setBodyCarePickerMounted] = useState(false);

  const bodyCareContentMountedRef = useRef(false);
  const bodyCareSettledOpenRef = useRef(false);
  const bodyCareDesiredOpenRef = useRef(false);
  const bodyCarePendingMeasureRef = useRef(false);
  const measuredBodyCareHeightRef = useRef(0);
  const pendingBodyCareClearRef = useRef(false);
  const bodyCareEnabledRef = useRef(false);
  const prevArrowPagerKeyRef = useRef(pagerKey);

  const bodyCareArrowOpacity = useRef(new Animated.Value(0)).current;
  const bodyCareArrowScale = useRef(new Animated.Value(0.8)).current;

  const [selectedBodyCareProductId, setSelectedBodyCareProductId] = useState<
    string | null
  >(null);

  const [bodyCareAmounts, setBodyCareAmounts] = useState<BodyCareAmounts>({});

  const [bodyCareSelectedZones, setBodyCareSelectedZones] = useState<
    Partial<Record<BodyCareZone, boolean>>
  >({});

  useEffect(() => {
    stateRef.current.hours = hours ?? 0;
    stateRef.current.mood = mood;
    stateRef.current.comment = comment;
    stateRef.current.bodyCareEnabled = bodyCareEnabled;
    stateRef.current.bodyCareProductId = selectedBodyCareProductId;
    stateRef.current.bodyCareAmounts = bodyCareAmounts;
    stateRef.current.bodyCareSelectedZones = bodyCareSelectedZones;
    stateRef.current.date = date;
  }, [
    hours,
    mood,
    comment,
    bodyCareEnabled,
    selectedBodyCareProductId,
    bodyCareAmounts,
    bodyCareSelectedZones,
    date,
  ]);

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const closedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setNowMs(Date.now());
      loadExisting();
      closedRef.current = false;
      translateY.setValue(SCREEN_HEIGHT);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();
    } else {
      setTodoPendingDelete(null);
      setConfirmVisible(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || todos.length === 0) return;
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);
    return () => clearInterval(interval);
  }, [visible, todos.length]);

  useEffect(() => {
    if (visible) {
      StatusBar.setStyle("light");
    } else {
      StatusBar.setStyle(scheme === "dark" ? "light" : "dark");
    }
  }, [visible, scheme]);

  useEffect(() => {
    if (!visible) return;
    const onBackPress = () => {
      saveAndClose();
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [visible]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      "refreshCalendarGrid",
      () => {
        if (visible) loadExisting();
      },
    );
    return () => {
      subscription.remove();
    };
  }, [visible, date]);

  useEffect(() => {
    if (prevArrowPagerKeyRef.current !== pagerKey) {
      prevArrowPagerKeyRef.current = pagerKey;
      bodyCareArrowOpacity.stopAnimation();
      bodyCareArrowScale.stopAnimation();
      bodyCareArrowOpacity.setValue(bodyCareEnabled ? 1 : 0);
      bodyCareArrowScale.setValue(bodyCareEnabled ? 1 : 0.8);
      return;
    }

    bodyCareArrowOpacity.stopAnimation();
    bodyCareArrowScale.stopAnimation();

    if (!bodyCareEnabled) {
      Animated.parallel([
        Animated.timing(bodyCareArrowOpacity, {
          toValue: 0,
          duration: 130,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bodyCareArrowScale, {
          toValue: 0.8,
          duration: 130,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(bodyCareArrowOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(bodyCareArrowScale, {
        toValue: 1,
        damping: 16,
        stiffness: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [bodyCareEnabled, pagerKey]);

  const loadExisting = async () => {
    if (!date) return;
    stateRef.current.dirty = false;
    setReadyHours(null);
    setTodos([]);
    setHistoryExpanded(false);
    historyOpacity.setValue(0);
    historyTranslate.setValue(-6);

    const [existing, bodyCare, visibleTodos] = await Promise.all([
      getSleepLog(date),
      getBodyCareLog(date),
      getTodosForDate(date),
    ]);
    const [lastProductId, history] = await Promise.all([
      bodyCare ? Promise.resolve(null) : getLastBodyCareProductId(),
      existing ? getSleepLogEdits(date) : Promise.resolve([]),
    ]);

    const h = existing?.hours ?? 0;

    setHours(h);
    setMood(existing?.mood ?? 0);
    setComment(existing?.comment ?? "");

    bodyCareHeightAnim.stopAnimation();
    bodyCareContentOpacity.stopAnimation();
    bodyCareContentTranslate.stopAnimation();
    bodyCareContentMountedRef.current = false;
    bodyCareSettledOpenRef.current = false;
    bodyCareDesiredOpenRef.current = false;
    bodyCarePendingMeasureRef.current = false;
    pendingBodyCareClearRef.current = false;
    bodyCareEnabledRef.current = Boolean(bodyCare);

    setBodyCareMenuOpen(false);
    setBodyCareProductPickerOpen(false);
    setBodyCareContentMounted(false);
    setBodyCareSettledOpen(false);
    setBodyCarePickerMounted(false);
    bodyCareHeightAnim.setValue(0);
    bodyCareContentOpacity.setValue(0);
    bodyCareContentTranslate.setValue(-8);
    bodyCarePickerProgress.setValue(0);

    if (bodyCare) {
      setBodyCareEnabled(true);
      setSelectedBodyCareProductId(bodyCare.product_id);
      setBodyCareAmounts(bodyCare.amounts);

      setBodyCareSelectedZones(
        BODY_CARE_ZONES.reduce(
          (selected, zone) => {
            selected[zone] = bodyCare.amounts[zone] !== undefined;
            return selected;
          },
          {} as Partial<Record<BodyCareZone, boolean>>,
        ),
      );
      BODY_CARE_ZONES.forEach((zone) => {
        bodyCareOverlayOpacity[zone].setValue(
          bodyCare.amounts[zone] !== undefined ? 1 : 0,
        );
      });
    } else {
      setBodyCareEnabled(false);
      setSelectedBodyCareProductId(lastProductId ?? "gillette-platinum");
      setBodyCareAmounts({});
      setBodyCareSelectedZones({});
      BODY_CARE_ZONES.forEach((zone) => {
        bodyCareOverlayOpacity[zone].setValue(0);
      });
    }

    setHasEntry(!!existing);
    setLoggedAt(existing?.logged_at ?? null);
    setUpdatedAt(existing?.updated_at ?? null);
    setEdits(history);
    setTodos(visibleTodos);

    stateRef.current.dirty = false;
    setPagerKey((k) => k + 1);
    setReadyHours(h);
  };

  const closeAnimated = () => {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => onClose());
  };

  const getSelectedBodyCareAmounts = (
    amounts: BodyCareAmounts,
    selectedZones: Partial<Record<BodyCareZone, boolean>>,
  ): BodyCareAmounts => {
    const selectedAmounts: BodyCareAmounts = {};

    BODY_CARE_ZONES.forEach((zone) => {
      if (selectedZones[zone]) {
        selectedAmounts[zone] = amounts[zone] ?? "";
      }
    });

    return selectedAmounts;
  };

  const saveAndClose = () => {
    if (closedRef.current) return;

    closedRef.current = true;
    Keyboard.dismiss();
    const s = stateRef.current;
    closeAnimated();

    if (!s.date || !s.dirty) return;

    const hasNormalLogData =
      s.hours > 0 ||
      (features.moodStarsEnabled && s.mood > 0) ||
      (features.commentsEnabled && s.comment.trim().length > 0);

    const hasBodyCareData =
      features.bodyCareEnabled && s.bodyCareEnabled && s.bodyCareProductId !== null;

    if (hasNormalLogData || hasBodyCareData) {
      saveSleepLog(
        s.date,
        s.hours,
        features.moodStarsEnabled ? s.mood : 0,
        features.commentsEnabled ? s.comment : "",
      );
    }

    if (features.bodyCareEnabled) {
      saveBodyCareLog(
        s.date,
        s.bodyCareEnabled,
        s.bodyCareProductId,
        getSelectedBodyCareAmounts(s.bodyCareAmounts, s.bodyCareSelectedZones),
      );
    }
  };

  const onHoursSelected = (page: number) => {
    setHours(pageToHour(page));
    stateRef.current.dirty = true;
  };

  const onHoursScrollStateChanged = (
    state: "idle" | "dragging" | "settling",
  ) => {
    setScrollLocked(state !== "idle");
  };

  const moodFromLocationX = (locationX: number) => {
    const step = STAR_SIZE + STAR_GAP;
    const idx = Math.floor(locationX / step);
    return Math.max(1, Math.min(10, idx + 1));
  };

  const starsRowRef = useRef<ViewInstance>(null);
  const rowOriginX = useRef(0);

  const measureStarsRow = () => {
    starsRowRef.current?.measureInWindow((x) => {
      rowOriginX.current = x;
    });
  };

  const moodFromPageX = (pageX: number) => {
    const step = STAR_SIZE + STAR_GAP;
    const local = pageX - rowOriginX.current;
    const idx = Math.floor(local / step);
    return Math.max(1, Math.min(10, idx + 1));
  };

  const dragPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > CLOSE_THRESHOLD) saveAndClose();
        else
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 200,
          }).start();
      },
      onPanResponderTerminate: (_, g) => {
        if (g.dy > CLOSE_THRESHOLD) saveAndClose();
        else
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 200,
          }).start();
      },
      onPanResponderTerminationRequest: () => true,
    }),
  ).current;

  const starsPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        setMood(moodFromPageX(evt.nativeEvent.pageX));
        stateRef.current.dirty = true;
      },
      onPanResponderMove: (evt) => {
        setMood(moodFromPageX(evt.nativeEvent.pageX));
        stateRef.current.dirty = true;
      },
    }),
  ).current;

  const handleDelete = async () => {
    closedRef.current = true;
    if (date) await deleteSleepLog(date);
    onSaved();
    setConfirmVisible(false);
    closeAnimated();
  };

  const refreshTodosForCurrentDate = async () => {
    if (!date) return;
    setNowMs(Date.now());
    const visibleTodos = await getTodosForDate(date);
    setTodos(visibleTodos);
    onSaved();
  };

  const handleAddTodo = async (title: string) => {
    if (!date) return;
    await addTodoTask(date, title);
    await refreshTodosForCurrentDate();
  };

  const handleToggleTodo = async (todo: TodoTask) => {
    if (!date) return;
    await toggleTodoCompleted(todo.id, date);
    await refreshTodosForCurrentDate();
  };

  const handleEditTodo = async (todo: TodoTask, nextTitle: string) => {
    await updateTodoTitle(todo.id, nextTitle);
    await refreshTodosForCurrentDate();
  };

  const handleDeleteTodoConfirm = async () => {
    const target = todoPendingDelete;
    setTodoPendingDelete(null);
    if (!target) return;
    await deleteTodoTask(target.id);
    await refreshTodosForCurrentDate();
  };

  const scrollTodoIntoView = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 120);
  };

  const hasDayData =
    hasEntry ||
    (date !== null &&
      todos.some((t) => t.created_date === date || t.completed_date === date));

  const toggleHistory = () => {
    if (!historyExpanded) {
      setHistoryExpanded(true);
      historyOpacity.setValue(0);
      historyTranslate.setValue(-6);
      Animated.parallel([
        Animated.timing(historyOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(historyTranslate, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(historyOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(historyTranslate, {
          toValue: -6,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(() => setHistoryExpanded(false));
    }
  };

  const renderHourLabel = useCallback((p: number) => `${pageToHour(p)}h`, []);
  const boldFont = resolveFont("bold");
  const hoursLabelStyle = useMemo(
    () => [styles.hoursValueCenter, { color: colors.text, fontFamily: boldFont }],
    [colors.text, boldFont],
  );

  const selectedBodyCareProduct = useMemo(
    () =>
      BODY_CARE_PRODUCTS.find(
        (product) => product.id === selectedBodyCareProductId,
      ) ?? null,
    [selectedBodyCareProductId],
  );

  const bodyCareImageAspectRatio = useMemo(() => {
    if (!selectedBodyCareProduct) return 1;
    const asset = Image.resolveAssetSource(selectedBodyCareProduct.images.full);
    return asset?.width != null && asset?.height != null && asset.height > 0
      ? asset.width / asset.height
      : 1;
  }, [selectedBodyCareProduct]);

  const openBodyCarePicker = () => {
    setBodyCarePickerMounted(true);

    requestAnimationFrame(() => {
      Animated.timing(bodyCarePickerProgress, {
        toValue: 1,
        duration: 140,
        useNativeDriver: false,
      }).start();
    });
  };

  const closeBodyCarePicker = () => {
    Animated.timing(bodyCarePickerProgress, {
      toValue: 0,
      duration: 120,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) setBodyCarePickerMounted(false);
    });
  };

  const runBodyCareOpenAnimation = (targetHeight: number) => {
    bodyCareHeightAnim.stopAnimation();
    bodyCareContentOpacity.stopAnimation();
    bodyCareContentTranslate.stopAnimation();

    Animated.parallel([
      Animated.timing(bodyCareHeightAnim, {
        toValue: targetHeight,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(bodyCareContentOpacity, {
        toValue: 1,
        duration: 210,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(bodyCareContentTranslate, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished && bodyCareDesiredOpenRef.current) {
        bodyCareSettledOpenRef.current = true;
        setBodyCareSettledOpen(true);
      }
    });
  };

  const handleBodyCareMenuLayout = (event: LayoutChangeEvent) => {
    const measuredHeight = event.nativeEvent.layout.height;
    if (measuredHeight <= 0) return;

    measuredBodyCareHeightRef.current = measuredHeight;

    if (bodyCarePendingMeasureRef.current && bodyCareDesiredOpenRef.current) {
      bodyCarePendingMeasureRef.current = false;
      runBodyCareOpenAnimation(measuredHeight);
    }
  };

  const openBodyCareContent = () => {
    bodyCareDesiredOpenRef.current = true;

    if (bodyCareContentMountedRef.current) {
      if (bodyCareSettledOpenRef.current) return;

      if (!bodyCarePendingMeasureRef.current && measuredBodyCareHeightRef.current > 0) {
        runBodyCareOpenAnimation(measuredBodyCareHeightRef.current);
      }
      return;
    }

    bodyCareHeightAnim.stopAnimation();
    bodyCareContentOpacity.stopAnimation();
    bodyCareContentTranslate.stopAnimation();

    bodyCareHeightAnim.setValue(0);
    bodyCareContentOpacity.setValue(0);
    bodyCareContentTranslate.setValue(-8);

    bodyCareSettledOpenRef.current = false;
    bodyCareContentMountedRef.current = true;
    bodyCarePendingMeasureRef.current = true;
    setBodyCareSettledOpen(false);
    setBodyCareContentMounted(true);
  };

  const closeBodyCareContent = () => {
    bodyCareDesiredOpenRef.current = false;
    bodyCarePendingMeasureRef.current = false;

    if (!bodyCareContentMountedRef.current) return;

    bodyCareHeightAnim.stopAnimation();
    bodyCareContentOpacity.stopAnimation();
    bodyCareContentTranslate.stopAnimation();

    if (bodyCareSettledOpenRef.current) {
      bodyCareHeightAnim.setValue(measuredBodyCareHeightRef.current);
      bodyCareSettledOpenRef.current = false;
      setBodyCareSettledOpen(false);
    }

    requestAnimationFrame(() => {
      if (bodyCareDesiredOpenRef.current) return;

      Animated.parallel([
        Animated.timing(bodyCareHeightAnim, {
          toValue: 0,
          duration: 210,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(bodyCareContentOpacity, {
          toValue: 0,
          duration: 150,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bodyCareContentTranslate, {
          toValue: -8,
          duration: 190,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished || bodyCareDesiredOpenRef.current) return;

        bodyCareContentMountedRef.current = false;
        bodyCareSettledOpenRef.current = false;
        setBodyCareContentMounted(false);
        setBodyCareSettledOpen(false);
        bodyCareHeightAnim.setValue(0);

        setBodyCarePickerMounted(false);
        bodyCarePickerProgress.setValue(0);

        if (pendingBodyCareClearRef.current && !bodyCareEnabledRef.current) {
          pendingBodyCareClearRef.current = false;
          setSelectedBodyCareProductId(null);
          setBodyCareAmounts({});
          setBodyCareSelectedZones({});
          BODY_CARE_ZONES.forEach((zone) => {
            bodyCareOverlayOpacity[zone].setValue(0);
          });
        }
      });
    });
  };

  const bodyCareContentStyle = {
    opacity: bodyCareContentOpacity,
    transform: [{ translateY: bodyCareContentTranslate }],
  };

  const bodyCarePickerStyle = {
    height: bodyCarePickerProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, BODY_CARE_PRODUCTS.length * BODY_CARE_OPTION_HEIGHT],
    }),
    opacity: bodyCarePickerProgress,
    transform: [
      {
        translateY: bodyCarePickerProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [-5, 0],
        }),
      },
    ],
  };

  const selectBodyCareProduct = (productId: string) => {
    const changingProduct = selectedBodyCareProductId !== productId;

    setSelectedBodyCareProductId(productId);

    if (changingProduct) {
      setBodyCareAmounts({});
      setBodyCareSelectedZones({});

      BODY_CARE_ZONES.forEach((zone) => {
        bodyCareOverlayOpacity[zone].setValue(0);
      });
    }

    stateRef.current.dirty = true;
  };

  const toggleBodyCareMenu = () => {
    const nextOpen = !bodyCareMenuOpen;

    setBodyCareMenuOpen(nextOpen);

    if (nextOpen) {
      openBodyCareContent();
      return;
    }

    setBodyCareProductPickerOpen(false);
    closeBodyCareContent();
  };

  const toggleBodyCareEnabled = () => {
    const nextEnabled = !bodyCareEnabled;
    bodyCareEnabledRef.current = nextEnabled;

    setBodyCareEnabled(nextEnabled);
    stateRef.current.dirty = true;

    if (nextEnabled) {
      if (pendingBodyCareClearRef.current) {
        pendingBodyCareClearRef.current = false;
        setBodyCareAmounts({});
        setBodyCareSelectedZones({});
        BODY_CARE_ZONES.forEach((zone) => {
          bodyCareOverlayOpacity[zone].setValue(0);
        });
      }

      setBodyCareMenuOpen(true);
      setSelectedBodyCareProductId((current) => current ?? "gillette-platinum");
      openBodyCareContent();
      return;
    }

    pendingBodyCareClearRef.current = true;
    setBodyCareMenuOpen(false);
    setBodyCareProductPickerOpen(false);
    closeBodyCareContent();
  };

  const toggleBodyCareZone = (zone: BodyCareZone) => {
    const isSelected = bodyCareSelectedZones[zone] === true;

    if (isSelected) {
      const nextSelectedZones = {
        ...bodyCareSelectedZones,
        [zone]: false,
      };

      setBodyCareSelectedZones(nextSelectedZones);

      stateRef.current.bodyCareSelectedZones = nextSelectedZones;

      Animated.timing(bodyCareOverlayOpacity[zone], {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }).start();

      stateRef.current.dirty = true;
      return;
    }

    const nextSelectedZones = {
      ...bodyCareSelectedZones,
      [zone]: true,
    };

    setBodyCareSelectedZones(nextSelectedZones);

    stateRef.current.bodyCareSelectedZones = nextSelectedZones;

    setBodyCareAmounts((previous) => ({
      ...previous,
      [zone]: previous[zone] ?? "",
    }));

    bodyCareOverlayOpacity[zone].setValue(0);

    requestAnimationFrame(() => {
      Animated.timing(bodyCareOverlayOpacity[zone], {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });

    stateRef.current.dirty = true;
  };

  const setBodyCareAmount = (zone: BodyCareZone, amount: string) => {
    setBodyCareAmounts((previous) => ({
      ...previous,
      [zone]: amount.replace(",", "."),
    }));

    stateRef.current.dirty = true;
  };

  const getBodyCareAmountStyle = (zone: BodyCareZone) => {
    const isTop = zone.startsWith("top");
    const isLeft = zone.endsWith("left");

    return [
      styles.bodyCareAmountInput,
      isTop ? styles.bodyCareAmountTop : styles.bodyCareAmountBottom,
      isLeft ? styles.bodyCareAmountLeft : styles.bodyCareAmountRight,
      {
        color: colors.text,
        borderColor: colors.textSecondary,
        backgroundColor: colors.modalBackground,
        fontFamily: resolveFont("regular"),
      },
    ];
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={saveAndClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {visible && <StatusBar style="light" />}
        <View
          style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}
        >
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.sheet,
              {
                backgroundColor: colors.modalBackground,
                transform: [{ translateY }],
              },
            ]}
          >
            <View
              style={styles.dragZone}
              {...dragPan.panHandlers}
              hitSlop={{ top: 20, bottom: 20, left: 60, right: 60 }}
            >
              <View style={styles.dragHandle} />
            </View>
            <ScrollView
              ref={scrollViewRef}
              scrollEnabled={!scrollLocked}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text
                style={[
                  styles.title,
                  { color: colors.text, fontFamily: resolveFont("bold") },
                ]}
              >
                {date}
              </Text>

              <Text
                style={[
                  styles.label,
                  {
                    color: colors.textSecondary,
                    fontFamily: resolveFont("italic"),
                  },
                ]}
              >
                hours of sleep
              </Text>
              {readyHours !== null && (
                <WheelPicker
                  ref={hoursWheelRef}
                  pagerKey={pagerKey}
                  page={HOURS_CENTER + readyHours}
                  totalPages={HOURS_TOTAL_PAGES}
                  renderLabel={renderHourLabel}
                  onSelected={onHoursSelected}
                  onScrollStateChanged={onHoursScrollStateChanged}
                  arrowColor={colors.textSecondary}
                  containerStyle={styles.hoursColumn}
                  pagerStyle={styles.hoursPager}
                  pageStyle={styles.hoursPage}
                  labelStyle={hoursLabelStyle}
                />
              )}

              {features.moodStarsEnabled && (
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
                    mood rating
                  </Text>

                  <View
                    ref={starsRowRef}
                    style={styles.starsRow}
                    onLayout={measureStarsRow}
                    {...starsPan.panHandlers}
                  >
                    {Array.from({ length: 10 }).map((_, i) => (
                      <Ionicons
                        key={i}
                        name={i < mood ? "star" : "star-outline"}
                        size={STAR_SIZE}
                        color={colors.text}
                        style={{ marginRight: i < 9 ? STAR_GAP : 0 }}
                      />
                    ))}
                  </View>
                </>
              )}

              {features.bodyCareEnabled && (
                <View style={styles.bodyCareSection}>
                <View style={styles.bodyCareHeader}>
                  <View style={styles.bodyCareControls}>
                    <View
                      style={[
                        styles.bodyCareHeaderSide,
                        styles.bodyCareHeaderLeft,
                      ]}
                    >
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPressIn={toggleBodyCareEnabled}
                        style={styles.bodyCareRadioInput}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <AnimatedRadioDot
                          checked={bodyCareEnabled}
                          size={24}
                          color={colors.text}
                          snapKey={pagerKey}
                        />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.bodyCareHeaderCenter}>
                      <Text
                        style={[
                          styles.bodyCareRadioText,
                          {
                            color: colors.text,
                            fontFamily: resolveFont(
                              bodyCareEnabled ? "bold" : "regular",
                            ),
                          },
                        ]}
                      >
                        self harm
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.bodyCareHeaderSide,
                        styles.bodyCareHeaderRight,
                      ]}
                    >
                      <Animated.View
                        pointerEvents={bodyCareEnabled ? "auto" : "none"}
                        style={{
                          opacity: bodyCareArrowOpacity,
                          transform: [{ scale: bodyCareArrowScale }],
                        }}
                      >
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPressIn={toggleBodyCareMenu}
                          style={styles.bodyCareArrowButton}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons
                            name={
                              bodyCareMenuOpen ? "chevron-up" : "chevron-down"
                            }
                            size={21}
                            color={colors.text}
                          />
                        </TouchableOpacity>
                      </Animated.View>
                    </View>
                  </View>
                </View>

                {bodyCareContentMounted && (
                  <Animated.View
                    style={[
                      styles.bodyCareAnimatedContent,
                      !bodyCareSettledOpen && {
                        height: bodyCareHeightAnim,
                        overflow: "hidden",
                      },
                    ]}
                  >
                    <Animated.View
                      onLayout={handleBodyCareMenuLayout}
                      style={[
                        styles.bodyCareMenu,
                        !bodyCareSettledOpen && {
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                        },
                        bodyCareContentStyle,
                      ]}
                    >
                      <Text
                        style={[
                          styles.bodyCareLabel,
                          {
                            color: colors.textSecondary,
                            fontFamily: resolveFont("italic"),
                          },
                        ]}
                      >
                        select razor
                      </Text>

                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => {
                          if (bodyCareProductPickerOpen) {
                            setBodyCareProductPickerOpen(false);
                            closeBodyCarePicker();
                          } else {
                            setBodyCareProductPickerOpen(true);
                            openBodyCarePicker();
                          }
                        }}
                        style={[
                          styles.bodyCareProductToggle,
                          { backgroundColor: colors.backgroundElement },
                        ]}
                      >
                        <Text
                          style={[
                            styles.bodyCareProductToggleText,
                            {
                              color: colors.text,
                              fontFamily: resolveFont("regular"),
                            },
                          ]}
                        >
                          {selectedBodyCareProduct?.label ?? "select product"}
                        </Text>

                        <Ionicons
                          name={
                            bodyCareProductPickerOpen
                              ? "chevron-up"
                              : "chevron-down"
                          }
                          size={20}
                          color={colors.text}
                        />
                      </TouchableOpacity>

                      {bodyCarePickerMounted && (
                        <Animated.View
                          style={[
                            styles.bodyCareProductOptions,
                            bodyCarePickerStyle,
                            { backgroundColor: colors.backgroundElement },
                          ]}
                        >
                          {BODY_CARE_PRODUCTS.map((product) => {
                            const isSelected =
                              product.id === selectedBodyCareProductId;

                            return (
                              <TouchableOpacity
                                key={product.id}
                                activeOpacity={0.8}
                                onPress={() =>
                                  selectBodyCareProduct(product.id)
                                }
                                style={[
                                  styles.bodyCareProductOption,
                                  isSelected && {
                                    backgroundColor: colors.backgroundSelected,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.bodyCareProductOptionText,
                                    {
                                      color: colors.text,
                                      fontFamily: resolveFont(
                                        isSelected ? "bold" : "regular",
                                      ),
                                    },
                                  ]}
                                >
                                  {product.label}
                                </Text>

                                {isSelected && (
                                  <Ionicons
                                    name="checkmark"
                                    size={19}
                                    color={colors.text}
                                  />
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </Animated.View>
                      )}

                      {selectedBodyCareProduct && (
                        <>
                          <Text
                            style={[
                              styles.bodyCareHint,
                              {
                                color: colors.textSecondary,
                                fontFamily: resolveFont("italic"),
                              },
                            ]}
                          >
                            tap an area to select it
                          </Text>

                          <View
                            style={[
                              styles.bodyCareImageFrame,
                              { aspectRatio: bodyCareImageAspectRatio },
                            ]}
                          >
                            <Image
                              source={selectedBodyCareProduct.images.full}
                              resizeMode="contain"
                              style={[
                                styles.bodyCareImage,
                                {
                                  opacity: 1,
                                  tintColor:
                                    scheme === "dark"
                                      ? "#8d929999"
                                      : "#9A9AA099",
                                },
                              ]}
                            />

                            {BODY_CARE_ZONES.map((zone) => {
                              const selected =
                                bodyCareSelectedZones[zone] === true;

                              return (
                                <View
                                  key={zone}
                                  pointerEvents="box-none"
                                  style={styles.bodyCareImageLayer}
                                >
                                  {selected && (
                                    <Animated.Image
                                      source={
                                        selectedBodyCareProduct.images[zone]
                                      }
                                      resizeMode="contain"
                                      style={[
                                        styles.bodyCareImageOverlay,
                                        {
                                          tintColor: colors.text,
                                          opacity: bodyCareOverlayOpacity[zone],
                                        },
                                      ]}
                                    />
                                  )}

                                  <TouchableOpacity
                                    activeOpacity={0.85}
                                    onPress={() => toggleBodyCareZone(zone)}
                                    style={[
                                      styles.bodyCareZone,
                                      zone === "top-left" &&
                                        styles.bodyCareTopLeft,
                                      zone === "top-right" &&
                                        styles.bodyCareTopRight,
                                      zone === "bottom-left" &&
                                        styles.bodyCareBottomLeft,
                                      zone === "bottom-right" &&
                                        styles.bodyCareBottomRight,
                                    ]}
                                  />

                                  {selected && (
                                    <Animated.View
                                      pointerEvents="box-none"
                                      style={[
                                        styles.bodyCareInputAnimationLayer,
                                        {
                                          opacity: bodyCareOverlayOpacity[zone],
                                        },
                                      ]}
                                    >
                                      <TextInput
                                        value={bodyCareAmounts[zone]}
                                        onChangeText={(text) =>
                                          setBodyCareAmount(zone, text)
                                        }
                                        keyboardType="decimal-pad"
                                        placeholder="0"
                                        placeholderTextColor={
                                          colors.textSecondary
                                        }
                                        style={getBodyCareAmountStyle(zone)}
                                      />
                                    </Animated.View>
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        </>
                      )}
                    </Animated.View>
                  </Animated.View>
                )}
              </View>
            )}

              {features.commentsEnabled && (
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

                  <View
                    style={[
                      styles.commentBox,
                      { borderColor: colors.textSecondary },
                    ]}
                  >
                    <TextInput
                      value={comment}
                      onChangeText={(t) => {
                        setComment(t);
                        stateRef.current.dirty = true;
                      }}
                      multiline
                      placeholder="text will be here"
                      placeholderTextColor={colors.textSecondary}
                      style={[
                        styles.commentInput,
                        {
                          color: colors.text,
                          fontFamily: resolveFont(
                            comment ? "regular" : "italic",
                          ),
                        },
                      ]}
                    />
                  </View>
                </>
              )}

              {features.todoListEnabled !== false && (
                <TodoListSection
                  todos={todos}
                  colors={colors}
                  scheme={scheme}
                  resolveFont={resolveFont}
                  nowMs={nowMs}
                  resetKey={pagerKey}
                  onAddTodo={handleAddTodo}
                  onToggleTodo={handleToggleTodo}
                  onEditTodo={handleEditTodo}
                  onRequestDeleteTodo={setTodoPendingDelete}
                  onInputFocus={scrollTodoIntoView}
                />
              )}

              {hasEntry && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPressIn={toggleHistory}
                  style={styles.historyFooter}
                >
                  <Text
                    style={[
                      styles.historyFooterText,
                      {
                        color: colors.textSecondary,
                        fontFamily: resolveFont("italic"),
                      },
                    ]}
                  >
                    {updatedAt && edits.length > 0
                      ? `last edited: ${formatTimestamp(updatedAt)}`
                      : loggedAt
                        ? `logged: ${formatTimestamp(loggedAt)}`
                        : "no timestamp available"}
                  </Text>

                  {historyExpanded && edits.length > 0 && (
                    <Animated.View
                      style={{
                        opacity: historyOpacity,
                        transform: [{ translateY: historyTranslate }],
                      }}
                    >
                      <View style={styles.historyList}>
                        {edits.map((e) => {
                          const parts: string[] = [];
                          if (e.changed_mood)
                            parts.push(`mood ${e.prev_mood} → ${e.new_mood}`);
                          if (e.changed_hours)
                            parts.push(
                              `hours ${e.prev_hours} → ${e.new_hours}`,
                            );
                          if (e.changed_comment) parts.push("comment");
                          return (
                            <Text
                              key={e.id}
                              style={[
                                styles.historyItem,
                                {
                                  color: colors.textSecondary,
                                  fontFamily: resolveFont("regular"),
                                },
                              ]}
                            >
                              #{e.edit_index} {formatTimestamp(e.edited_at)}{" "}
                              changed {parts.join(", ")}
                            </Text>
                          );
                        })}
                      </View>
                    </Animated.View>
                  )}
                </TouchableOpacity>
              )}

              {hasDayData && (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPressIn={() => {
                    setConfirmVisible(true);
                  }}
                  style={[
                    styles.deleteButton,
                    { backgroundColor: colors.text },
                  ]}
                >
                  <Text
                    style={[
                      styles.deleteButtonText,
                      { color: colors.background },
                    ]}
                  >
                    delete
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
            <View
              style={[
                styles.bottomFiller,
                { backgroundColor: colors.modalBackground },
              ]}
            />
          </Animated.View>
        </View>

        <ConfirmDialog
          visible={confirmVisible}
          message={`Are you sure you want to delete data for ${date}?`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmVisible(false)}
        />

        <ConfirmDialog
          visible={todoPendingDelete !== null}
          message={`Are you sure you want to delete "${todoPendingDelete?.title ?? ""}"?`}
          onConfirm={() => void handleDeleteTodoConfirm()}
          onCancel={() => setTodoPendingDelete(null)}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}
