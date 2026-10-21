import { Colors } from "@/constants/theme";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";
import {
  BodyCareAmounts,
  deleteSleepLog,
  getBodyCareLog,
  getLastBodyCareProductId,
  getSleepLog,
  getSleepLogEdits,
  saveBodyCareLog,
  saveSleepLog,
  SleepLogEdit,
} from "@/lib/db";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  DeviceEventEmitter,
  Dimensions,
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ConfirmDialog from "../confirm-dialog";
import WheelPicker, { WheelPickerHandle } from "../wheel-picker";
import { styles } from "./sleep-modal.styles";

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
  const colors = Colors[scheme];

  const [hours, setHours] = useState<number | null>(null);
  const [mood, setMood] = useState(0);
  const [comment, setComment] = useState("");
  const [hasEntry, setHasEntry] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [scrollLocked, setScrollLocked] = useState(false);

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

  const bodyCareContentOpacity = useRef(new Animated.Value(0)).current;
  const bodyCareContentTranslate = useRef(new Animated.Value(-12)).current;

  const bodyCarePickerProgress = useRef(new Animated.Value(0)).current;

  const [bodyCareContentMounted, setBodyCareContentMounted] = useState(false);
  const [bodyCarePickerMounted, setBodyCarePickerMounted] = useState(false);

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
      loadExisting();
      closedRef.current = false;
      translateY.setValue(SCREEN_HEIGHT);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();
    }
  }, [visible]);

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
    if (!bodyCareEnabled) {
      bodyCareArrowOpacity.setValue(0);
      bodyCareArrowScale.setValue(0.8);
      return;
    }

    bodyCareArrowOpacity.setValue(0);
    bodyCareArrowScale.setValue(0.8);

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
  }, [bodyCareEnabled]);

  const loadExisting = async () => {
    if (!date) return;
    stateRef.current.dirty = false;
    setReadyHours(null);
    setHistoryExpanded(false);
    historyOpacity.setValue(0);
    historyTranslate.setValue(-6);

    const existing = await getSleepLog(date);
    const h = existing?.hours ?? 0;

    setHours(h);
    setMood(existing?.mood ?? 0);
    setComment(existing?.comment ?? "");

    setBodyCareMenuOpen(false);
    setBodyCareProductPickerOpen(false);
    setBodyCareContentMounted(false);
    setBodyCarePickerMounted(false);
    bodyCareContentOpacity.setValue(0);
    bodyCareContentTranslate.setValue(-12);
    bodyCarePickerProgress.setValue(0);

    const bodyCare = await getBodyCareLog(date);

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
      const lastProductId = await getLastBodyCareProductId();

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

    const history = existing ? await getSleepLogEdits(date) : [];
    setEdits(history);

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
    const s = stateRef.current;
    closeAnimated();

    if (!s.date || !s.dirty) return;

    const hasNormalLogData =
      s.hours > 0 || s.mood > 0 || s.comment.trim().length > 0;

    const hasBodyCareData = s.bodyCareEnabled && s.bodyCareProductId !== null;

    if (hasNormalLogData || hasBodyCareData) {
      saveSleepLog(s.date, s.hours, s.mood, s.comment);
    }

    saveBodyCareLog(
      s.date,
      s.bodyCareEnabled,
      s.bodyCareProductId,
      getSelectedBodyCareAmounts(s.bodyCareAmounts, s.bodyCareSelectedZones),
    );
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

  const starsRowRef = useRef<View>(null);
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
    if (date) await deleteSleepLog(date);
    onSaved();
    setConfirmVisible(false);
    closeAnimated();
  };

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

  const selectedBodyCareProduct =
    BODY_CARE_PRODUCTS.find(
      (product) => product.id === selectedBodyCareProductId,
    ) ?? null;

  const bodyCareImageAsset = selectedBodyCareProduct
    ? Image.resolveAssetSource(selectedBodyCareProduct.images.full)
    : null;

  const bodyCareImageAspectRatio =
    bodyCareImageAsset && bodyCareImageAsset.height > 0
      ? bodyCareImageAsset.width / bodyCareImageAsset.height
      : 1;

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

  const openBodyCareContent = () => {
    setBodyCareContentMounted(true);

    bodyCareContentOpacity.setValue(0);
    bodyCareContentTranslate.setValue(-12);

    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(bodyCareContentOpacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.spring(bodyCareContentTranslate, {
          toValue: 0,
          damping: 20,
          stiffness: 230,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const closeBodyCareContent = () => {
    Animated.parallel([
      Animated.timing(bodyCareContentOpacity, {
        toValue: 0,
        duration: 110,
        useNativeDriver: true,
      }),
      Animated.timing(bodyCareContentTranslate, {
        toValue: -8,
        duration: 130,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setBodyCareContentMounted(false);
      }
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
    closeBodyCarePicker();
    closeBodyCareContent();
  };

  const toggleBodyCareEnabled = () => {
    const nextEnabled = !bodyCareEnabled;

    setBodyCareEnabled(nextEnabled);
    stateRef.current.dirty = true;

    if (nextEnabled) {
      setBodyCareMenuOpen(true);

      setSelectedBodyCareProductId((current) => current ?? "gillette-platinum");

      openBodyCareContent();
      return;
    }

    setBodyCareMenuOpen(false);
    setBodyCareProductPickerOpen(false);

    closeBodyCarePicker();
    closeBodyCareContent();

    setSelectedBodyCareProductId(null);
    setBodyCareAmounts({});
    setBodyCareSelectedZones({});
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
        fontFamily: "Redaction20-Regular",
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
        <StatusBar style="light" />
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
              scrollEnabled={!scrollLocked}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text
                style={[
                  styles.title,
                  { color: colors.text, fontFamily: "Redaction35-Bold" },
                ]}
              >
                {date}
              </Text>

              <Text
                style={[
                  styles.label,
                  {
                    color: colors.textSecondary,
                    fontFamily: "Redaction20-Italic",
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
                  renderLabel={(p) => `${pageToHour(p)}h`}
                  onSelected={onHoursSelected}
                  onScrollStateChanged={onHoursScrollStateChanged}
                  arrowColor={colors.textSecondary}
                  containerStyle={styles.hoursColumn}
                  pagerStyle={styles.hoursPager}
                  pageStyle={styles.hoursPage}
                  labelStyle={[
                    styles.hoursValueCenter,
                    { color: colors.text, fontFamily: "Redaction20-Bold" },
                  ]}
                />
              )}

              <Text
                style={[
                  styles.label,
                  {
                    color: colors.textSecondary,
                    fontFamily: "Redaction20-Italic",
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
                        <Ionicons
                          name={
                            bodyCareEnabled
                              ? "radio-button-on"
                              : "radio-button-off"
                          }
                          size={24}
                          color={colors.text}
                        />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.bodyCareHeaderCenter}>
                      <Text
                        style={[
                          styles.bodyCareRadioText,
                          {
                            color: colors.text,
                            fontFamily: bodyCareEnabled
                              ? "Redaction20-Bold"
                              : "Redaction20-Regular",
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
                      bodyCareContentStyle,
                    ]}
                  >
                    <View style={styles.bodyCareMenu}>
                      <Text
                        style={[
                          styles.bodyCareLabel,
                          {
                            color: colors.textSecondary,
                            fontFamily: "Redaction20-Italic",
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
                              fontFamily: "Redaction20-Regular",
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
                                      fontFamily: isSelected
                                        ? "Redaction20-Bold"
                                        : "Redaction20-Regular",
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
                                fontFamily: "Redaction20-Italic",
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
                    </View>
                  </Animated.View>
                )}
              </View>

              <Text
                style={[
                  styles.label,
                  {
                    color: colors.textSecondary,
                    fontFamily: "Redaction20-Italic",
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
                      fontFamily: comment
                        ? "Redaction20-Regular"
                        : "Redaction20-Italic",
                    },
                  ]}
                />
              </View>

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
                        fontFamily: "Redaction20-Italic",
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
                                  fontFamily: "Redaction20-Regular",
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

              {hasEntry && (
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
      </KeyboardAvoidingView>
    </Modal>
  );
}
