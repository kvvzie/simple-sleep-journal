import { useAppearance } from "@/contexts/appearance-context";
import { useSettings } from "@/contexts/settings-context";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";
import { getAllLoggedDates, getMonthLogs, initDB } from "@/lib/db";
import { FontVariant } from "@/lib/theme-utils";
import { ThemePaletteColors } from "@/types/appearance";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  BackHandler,
  DeviceEventEmitter,
  Easing,
  LayoutChangeEvent,
  Pressable,
  Text,
  ToastAndroid,
  useWindowDimensions,
  View,
} from "react-native";
import PagerView from "react-native-pager-view";
import SleepModal from "../sleep-modal";
import {
  getDayCellWidth,
  getDayColor,
  getDayFontSize,
  getGridRowHeight,
  styles,
} from "./calendar-grid.styles";
import {
  CalendarDay,
  computeWidthScale,
  evaluatePageSelected,
  getCalendarDays,
  getMonthKey,
  getScaledMeasuredWidth,
  getSwipeTargetPage,
  groupDatesByMonth,
  isScrollSettled,
  MONTH_NAMES,
  resolveCanceledSwipePage,
} from "./calendar-grid.utils";

const CENTER_PAGE = 60;
const TOTAL_PAGES = CENTER_PAGE * 2 + 1;
const MAX_PAGE = TOTAL_PAGES - 1;
const MONTH_RENDER_RADIUS = 2;
const GRID_RENDER_RADIUS = 2;

const YEAR_RANGE = 5;
const YEAR_TOTAL_PAGES = YEAR_RANGE * 2 + 1;
const YEAR_CENTER_PAGE = YEAR_RANGE;

const TEXT_PADDING = 48;
const DEFAULT_MONTH_WIDTH = 140;
const DEFAULT_YEAR_WIDTH = 200;

const MONTH_FIXED_WIDTH = 320;
const YEAR_FIXED_WIDTH = 300;
const MONTH_BASE_FONT_SIZE = 52;
const YEAR_BASE_FONT_SIZE = 72;
const HEADER_ANIM_DURATION = 260;
const MEASURE_CONTAINER_WIDTH = 1200;
const SWIPE_TRIGGER_THRESHOLD = 0.06;

const EMPTY_DATE_SET = new Set<string>();
const PAGE_INDICES = Array.from({ length: TOTAL_PAGES }, (_, p) => p);
const YEAR_PAGE_INDICES = Array.from({ length: YEAR_TOTAL_PAGES }, (_, p) => p);
const MONTH_INDICES = Array.from({ length: 12 }, (_, m) => m);

type ScrollState = "idle" | "dragging" | "settling";
type PagerKey = "year" | "month" | "grid";

function pageToYearMonth(page: number, baseYear: number, baseMonth: number) {
  const diff = page - CENTER_PAGE;
  const total = baseYear * 12 + baseMonth + diff;
  const year = Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  return { year, month };
}

function clampPage(p: number) {
  return Math.max(0, Math.min(MAX_PAGE, p));
}

function useHeaderWidthSync(options: {
  activeKey: number;
  measureKey: string;
  fixedWidth: number;
  defaultWidth: number;
  minScale: number;
}) {
  const { activeKey, measureKey, fixedWidth, defaultWidth, minScale } = options;
  const maxTextWidth = fixedWidth - 8;

  const [fontScale, setFontScale] = useState(1);
  const widthAnim = useRef(new Animated.Value(defaultWidth)).current;
  const widthsByKey = useRef<Record<string, Record<number, number>>>({});
  const snappedKey = useRef<string | null>(null);
  const activeAnim = useRef<Animated.CompositeAnimation | null>(null);

  const activeKeyRef = useRef(activeKey);
  const measureKeyRef = useRef(measureKey);
  const scaleRef = useRef(fontScale);

  useLayoutEffect(() => {
    activeKeyRef.current = activeKey;
    measureKeyRef.current = measureKey;
    scaleRef.current = fontScale;
  }, [activeKey, measureKey, fontScale]);

  const animateTo = useCallback(
    (target: number) => {
      activeAnim.current?.stop();
      const anim = Animated.timing(widthAnim, {
        toValue: target,
        duration: HEADER_ANIM_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      });
      activeAnim.current = anim;
      anim.start(() => {
        if (activeAnim.current === anim) {
          activeAnim.current = null;
        }
      });
    },
    [widthAnim],
  );

  useEffect(() => {
    const scale = computeWidthScale(
      widthsByKey.current[measureKey],
      maxTextWidth,
      minScale,
    );
    setFontScale(scale);
  }, [measureKey, maxTextWidth, minScale]);

  useEffect(() => {
    const target = getScaledMeasuredWidth(
      widthsByKey.current[measureKey],
      activeKey,
      fontScale,
      maxTextWidth,
    );
    if (target === undefined) return;
    if (snappedKey.current !== measureKey) {
      activeAnim.current?.stop();
      widthAnim.setValue(target);
      snappedKey.current = measureKey;
      return;
    }
    animateTo(target);
  }, [activeKey, measureKey, fontScale, maxTextWidth, widthAnim, animateTo]);

  const onMeasure = useCallback(
    (itemKey: number, rawWidth: number) => {
      const bucket = (widthsByKey.current[measureKey] ??= {});
      bucket[itemKey] = rawWidth;
      const scale = computeWidthScale(bucket, maxTextWidth, minScale);
      if (scale !== scaleRef.current) {
        setFontScale(scale);
      }
      if (
        measureKey === measureKeyRef.current &&
        itemKey === activeKeyRef.current
      ) {
        const scaledWidth = Math.min(maxTextWidth, rawWidth * scale);
        if (snappedKey.current !== measureKey) {
          activeAnim.current?.stop();
          widthAnim.setValue(scaledWidth);
          snappedKey.current = measureKey;
        } else {
          animateTo(scaledWidth);
        }
      }
    },
    [measureKey, maxTextWidth, minScale, widthAnim, animateTo],
  );

  const containerWidth = useMemo(
    () => Animated.add(widthAnim, TEXT_PADDING),
    [widthAnim],
  );
  const pagerMarginLeft = useMemo(
    () =>
      Animated.multiply(
        Animated.add(widthAnim, TEXT_PADDING - fixedWidth),
        0.5,
      ),
    [widthAnim, fixedWidth],
  );

  return {
    fontScale,
    containerWidth,
    pagerMarginLeft,
    onMeasure,
  };
}

type YearPageProps = {
  yearValue: number;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  maxWidth?: number;
  onLayout?: (e: LayoutChangeEvent) => void;
};

const YearPage = memo(function YearPage({
  yearValue,
  textColor,
  fontFamily,
  fontSize,
  maxWidth,
  onLayout,
}: YearPageProps) {
  return (
    <Text
      numberOfLines={1}
      onLayout={onLayout}
      style={[
        styles.year,
        { color: textColor, fontFamily, fontSize, maxWidth },
      ]}
    >
      {yearValue}
    </Text>
  );
});

type MonthPageProps = {
  monthIndex: number;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  maxWidth?: number;
  onLayout?: (e: LayoutChangeEvent) => void;
};

const MonthPage = memo(function MonthPage({
  monthIndex,
  textColor,
  fontFamily,
  fontSize,
  maxWidth,
  onLayout,
}: MonthPageProps) {
  return (
    <Text
      numberOfLines={1}
      onLayout={onLayout}
      style={[
        styles.month,
        { color: textColor, fontFamily, fontSize, maxWidth },
      ]}
    >
      <Text style={{ fontSize: 16 }}> </Text>
      {MONTH_NAMES[monthIndex]}
      <Text style={{ fontSize: 16 }}> </Text>
    </Text>
  );
});

type GridPageProps = {
  year: number;
  month: number;
  loggedDates: Set<string>;
  totalCells: number;
  cellWidth: number;
  rowHeight: number;
  fontSize: number;
  colors: ThemePaletteColors;
  boldFont: string;
  regularFont: string;
  italicFont: string;
  onDayPress: (day: CalendarDay) => void;
};

const GridPage = memo(function GridPage({
  year,
  month,
  loggedDates,
  totalCells,
  cellWidth,
  rowHeight,
  fontSize,
  colors,
  boldFont,
  regularFont,
  italicFont,
  onDayPress,
}: GridPageProps) {
  const days = useMemo(
    () => getCalendarDays(year, month, loggedDates, totalCells),
    [year, month, loggedDates, totalCells],
  );

  return (
    <>
      {days.map((d, i) => {
        const fontFamily =
          d.type === "today"
            ? boldFont
            : d.type === "logged"
              ? regularFont
              : italicFont;
        return (
          <Pressable
            key={i}
            onPress={() => onDayPress(d)}
            style={[
              styles.dayCell,
              {
                width: cellWidth,
                paddingVertical: 0,
                height: rowHeight,
                justifyContent: "center",
              },
            ]}
          >
            <Text
              style={[
                styles.dayText,
                {
                  fontFamily,
                  color: getDayColor(d.type, colors),
                  fontSize,
                },
              ]}
            >
              {d.day}
            </Text>
          </Pressable>
        );
      })}
    </>
  );
});

function CalendarGrid() {
  const scheme = useAppColorScheme();
  const { colors, resolveFont, backgrounds } = useAppearance();
  const { rows, columns } = useSettings();
  const totalCells = rows * columns;

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const rowHeight = getGridRowHeight(screenHeight, rows);
  const GRID_WIDTH = Math.min(screenWidth * 0.88, 500);
  const [gridWidth, setGridWidth] = useState(GRID_WIDTH);

  const displayFont = resolveFont("display");
  const titleFont = resolveFont("title");
  const boldFont = resolveFont("bold" satisfies FontVariant);
  const regularFont = resolveFont("regular" satisfies FontVariant);
  const italicFont = resolveFont("italic" satisfies FontVariant);

  const monthMeasureKey = `${titleFont}|${MONTH_FIXED_WIDTH}`;
  const yearMeasureKey = `${displayFont}|${YEAR_FIXED_WIDTH}`;

  const todayRef = useRef(new Date());
  const baseYear = todayRef.current.getFullYear();
  const baseMonth = todayRef.current.getMonth();

  const [page, setPage] = useState(CENTER_PAGE);
  const [loggedByMonth, setLoggedByMonth] = useState<Map<string, Set<string>>>(
    () => new Map(),
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const backPressCount = useRef(0);

  const gridPagerRef = useRef<PagerView>(null);
  const yearPagerRef = useRef<PagerView>(null);
  const monthPagerRef = useRef<PagerView>(null);

  const lastSyncedPage = useRef(CENTER_PAGE);
  const lastYearPage = useRef(YEAR_CENTER_PAGE);

  const scrollStates = useRef<Record<PagerKey, ScrollState>>({
    year: "idle",
    month: "idle",
    grid: "idle",
  });

  const pendingUpdates = useRef<Partial<Record<PagerKey, number>>>({});
  const expectedPageRef = useRef<Partial<Record<PagerKey, number>>>({});
  const lastScrollPosRef = useRef<Partial<Record<PagerKey, number>>>({});
  const lastOffsetRef = useRef<Partial<Record<PagerKey, number>>>({});
  const pendingGestureFinishRef = useRef<Partial<Record<PagerKey, boolean>>>(
    {},
  );
  const manualScrollSource = useRef<PagerKey | null>(null);
  const dragAnchorRef = useRef<number | null>(null);
  const dragStartPosRef = useRef<number | null>(null);
  const dragCommittedDirRef = useRef<-1 | 0 | 1>(0);
  const hadMovedInGestureRef = useRef(false);

  const [activeSource, setActiveSource] = useState<PagerKey | null>(null);
  const activeSourceRef = useRef<PagerKey | null>(null);
  const gridScaleAnim = useRef(new Animated.Value(1)).current;

  const refs: Record<PagerKey, React.RefObject<PagerView | null>> = {
    year: yearPagerRef,
    month: monthPagerRef,
    grid: gridPagerRef,
  };

  const { year, month } = useMemo(
    () => pageToYearMonth(page, baseYear, baseMonth),
    [page, baseYear, baseMonth],
  );

  const yearPageIndex = useMemo(
    () => YEAR_CENTER_PAGE + (year - baseYear),
    [year, baseYear],
  );

  const currentYearRef = useRef(year);
  const currentMonthRef = useRef(month);
  useLayoutEffect(() => {
    currentYearRef.current = year;
    currentMonthRef.current = month;
  }, [year, month]);

  const monthHeader = useHeaderWidthSync({
    activeKey: month,
    measureKey: monthMeasureKey,
    fixedWidth: MONTH_FIXED_WIDTH,
    defaultWidth: DEFAULT_MONTH_WIDTH,
    minScale: 0.65,
  });

  const yearHeader = useHeaderWidthSync({
    activeKey: year,
    measureKey: yearMeasureKey,
    fixedWidth: YEAR_FIXED_WIDTH,
    defaultWidth: DEFAULT_YEAR_WIDTH,
    minScale: 0.7,
  });

  const allLogsRequestId = useRef(0);

  const refreshAllLogs = useCallback(async () => {
    const reqId = ++allLogsRequestId.current;
    const dates = await getAllLoggedDates();
    if (allLogsRequestId.current !== reqId) return;
    setLoggedByMonth(groupDatesByMonth(dates));
  }, []);

  const refreshCurrentMonth = useCallback(async () => {
    const targetYear = currentYearRef.current;
    const targetMonth = currentMonthRef.current;
    const key = getMonthKey(targetYear, targetMonth);
    const logs = await getMonthLogs(targetYear, targetMonth);
    setLoggedByMonth((prev) => {
      const next = new Map(prev);
      if (logs.length === 0) {
        next.delete(key);
      } else {
        next.set(key, new Set(logs.map((r) => r.date)));
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await initDB();
      if (active) {
        await refreshAllLogs();
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshAllLogs]);

  const prevModalVisible = useRef(false);
  useEffect(() => {
    if (prevModalVisible.current && !modalVisible) {
      refreshCurrentMonth();
    }
    prevModalVisible.current = modalVisible;
  }, [modalVisible, refreshCurrentMonth]);

  useEffect(() => {
    const onBackPress = () => {
      if (modalVisible) return false;
      if (backPressCount.current === 0) {
        backPressCount.current = 1;
        ToastAndroid.show("Naciśnij ponownie, aby wyjść", ToastAndroid.SHORT);
        setTimeout(() => {
          backPressCount.current = 0;
        }, 2000);
        return true;
      }
      BackHandler.exitApp();
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [modalVisible]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      "refreshCalendarGrid",
      refreshAllLogs,
    );
    return () => {
      subscription.remove();
    };
  }, [refreshAllLogs]);

  const handleDayPress = useCallback((d: CalendarDay) => {
    if (!d.dateStr || d.type === "otherMonth" || d.type === "future") return;
    setSelectedDate(d.dateStr);
    setModalVisible(true);
  }, []);

  const safeSetPage = (key: PagerKey, targetPage: number) => {
    expectedPageRef.current[key] = targetPage;
    if (scrollStates.current[key] === "idle") {
      refs[key].current?.setPageWithoutAnimation(targetPage);
      if (key === "year") lastYearPage.current = targetPage;
      delete pendingUpdates.current[key];
    } else {
      pendingUpdates.current[key] = targetPage;
    }
  };

  const yearPageToCalendarPage = (yearPagePos: number) => {
    const targetYear = baseYear + (yearPagePos - YEAR_CENTER_PAGE);
    const { month: currentMonth } = pageToYearMonth(
      lastSyncedPage.current,
      baseYear,
      baseMonth,
    );
    return (
      CENTER_PAGE + (targetYear - baseYear) * 12 + (currentMonth - baseMonth)
    );
  };

  const syncAllPagers = (
    rawNewPage: number,
    source?: PagerKey,
    bounce = true,
  ) => {
    if (source) delete pendingUpdates.current[source];

    const newPage = clampPage(rawNewPage);
    if (newPage === lastSyncedPage.current) {
      if (rawNewPage !== newPage) {
        if (source === "year") safeSetPage("year", yearPageIndex);
        if (source === "month") safeSetPage("month", lastSyncedPage.current);
        if (source === "grid") safeSetPage("grid", lastSyncedPage.current);
      }
      return;
    }

    if (bounce) {
      gridScaleAnim.setValue(0.98);
      Animated.spring(gridScaleAnim, {
        toValue: 1,
        friction: 2,
        tension: 16,
        useNativeDriver: true,
      }).start();
    }

    lastSyncedPage.current = newPage;
    setPage(newPage);

    const { year: newYear } = pageToYearMonth(newPage, baseYear, baseMonth);
    const newYearPageIndex = YEAR_CENTER_PAGE + (newYear - baseYear);

    if (source !== "year") safeSetPage("year", newYearPageIndex);
    if (source === "year") lastYearPage.current = newYearPageIndex;

    if (source !== "month") safeSetPage("month", newPage);
    if (source !== "grid") safeSetPage("grid", newPage);
  };

  const reconcileCanceledGestureIfNeeded = (key: PagerKey) => {
    const canceledPage = resolveCanceledSwipePage({
      scrollPos: lastScrollPosRef.current[key] ?? 0,
      offset: lastOffsetRef.current[key] ?? 0,
      dragAnchor: dragAnchorRef.current,
      hadMovedInGesture: hadMovedInGestureRef.current,
      currentTarget:
        key === "year" ? lastYearPage.current : lastSyncedPage.current,
      isDragging: scrollStates.current[key] === "dragging",
    });
    if (canceledPage === null) return;
    if (key === "year") {
      lastYearPage.current = canceledPage;
      syncAllPagers(yearPageToCalendarPage(canceledPage), "year", false);
    } else {
      syncAllPagers(canceledPage, key, false);
    }
  };

  const finishGesture = (key: PagerKey) => {
    pendingGestureFinishRef.current[key] = false;
    if (manualScrollSource.current === key) {
      manualScrollSource.current = null;
      dragAnchorRef.current = null;
      dragStartPosRef.current = null;
      dragCommittedDirRef.current = 0;
      hadMovedInGestureRef.current = false;
    }

    if (activeSourceRef.current === key) {
      activeSourceRef.current = null;
      setActiveSource(null);
    }

    if (pendingUpdates.current[key] !== undefined) {
      const target = pendingUpdates.current[key]!;
      delete pendingUpdates.current[key];
      expectedPageRef.current[key] = target;
      refs[key].current?.setPageWithoutAnimation(target);
      if (key === "year") lastYearPage.current = target;
    }
  };

  const handleScrollStateChanged = (key: PagerKey, state: ScrollState) => {
    scrollStates.current[key] = state;

    if (state === "dragging") {
      manualScrollSource.current = key;
      pendingGestureFinishRef.current[key] = false;
      expectedPageRef.current[key] = undefined;
      dragAnchorRef.current =
        key === "year" ? lastYearPage.current : lastSyncedPage.current;
      dragStartPosRef.current = null;
      dragCommittedDirRef.current = 0;
      hadMovedInGestureRef.current = false;
    } else if (state === "settling") {
      pendingGestureFinishRef.current[key] = false;
    } else if (state === "idle") {
      if (manualScrollSource.current === key) {
        const currentOffset = lastOffsetRef.current[key] ?? 0;
        if (!isScrollSettled(currentOffset)) {
          // ComposePagerView can emit "idle" on DragInteraction.Stop before snapping finishes.
          pendingGestureFinishRef.current[key] = true;
          return;
        }
        reconcileCanceledGestureIfNeeded(key);
      }
      finishGesture(key);
    }
  };

  const handlePageScroll = (
    source: PagerKey,
    e: { nativeEvent: { position: number; offset: number } },
  ) => {
    const offset = e.nativeEvent.offset;
    const scrollPos = e.nativeEvent.position + offset;
    lastOffsetRef.current[source] = offset;
    lastScrollPosRef.current[source] = scrollPos;

    if (
      manualScrollSource.current !== source &&
      activeSourceRef.current !== source
    ) {
      return;
    }

    if (pendingGestureFinishRef.current[source] && isScrollSettled(offset)) {
      reconcileCanceledGestureIfNeeded(source);
      finishGesture(source);
      return;
    }

    if (manualScrollSource.current === null) {
      manualScrollSource.current = source;
    }
    if (dragAnchorRef.current === null) {
      dragAnchorRef.current =
        source === "year" ? lastYearPage.current : lastSyncedPage.current;
    }

    const anchor = dragAnchorRef.current;
    const maxPage = source === "year" ? YEAR_TOTAL_PAGES - 1 : MAX_PAGE;
    if (dragStartPosRef.current === null) {
      dragStartPosRef.current = scrollPos;
    }

    // Measure threshold from where the gesture started so mid-settle grabs still require 6% movement.
    const gestureMovedScrollPos = anchor + (scrollPos - dragStartPosRef.current);
    const target = getSwipeTargetPage(
      gestureMovedScrollPos,
      anchor,
      SWIPE_TRIGGER_THRESHOLD,
      0,
      maxPage,
    );
    if (target === null || target === anchor) return;

    const newDir: -1 | 1 = target > anchor ? 1 : -1;
    if (
      dragCommittedDirRef.current === 0 ||
      (scrollStates.current[source] === "dragging" &&
        newDir !== dragCommittedDirRef.current)
    ) {
      dragCommittedDirRef.current = newDir;
      hadMovedInGestureRef.current = true;
      if (source === "year") {
        lastYearPage.current = target;
        syncAllPagers(yearPageToCalendarPage(target), "year", true);
      } else {
        syncAllPagers(target, source, true);
      }
    }
  };

  const tryLock = (key: PagerKey) => {
    if (activeSourceRef.current === null) {
      activeSourceRef.current = key;
      setActiveSource(key);
    }
  };

  const releaseIfNotDragging = (key: PagerKey) => {
    if (
      activeSourceRef.current === key &&
      scrollStates.current[key] === "idle"
    ) {
      activeSourceRef.current = null;
      setActiveSource(null);
    }
  };

  const onYearPageSelected = (e: { nativeEvent: { position: number } }) => {
    const pos = e.nativeEvent.position;
    const decision = evaluatePageSelected({
      pos,
      expectedProgrammaticPage: expectedPageRef.current.year,
      activeManualSource: manualScrollSource.current,
      isDragging: scrollStates.current.year === "dragging",
      lastScrollPos: lastScrollPosRef.current.year,
      currentPage: lastYearPage.current,
    });
    if (decision === "ignore") return;
    if (decision === "acknowledge-programmatic") {
      expectedPageRef.current.year = undefined;
      delete pendingUpdates.current.year;
      return;
    }

    delete pendingUpdates.current.year;
    lastYearPage.current = pos;
    const targetPage = yearPageToCalendarPage(pos);
    if (targetPage !== lastSyncedPage.current) {
      syncAllPagers(targetPage, "year", false);
    }
  };

  const onHorizontalPageSelected = (
    source: "month" | "grid",
    e: { nativeEvent: { position: number } },
  ) => {
    const pos = e.nativeEvent.position;
    const decision = evaluatePageSelected({
      pos,
      expectedProgrammaticPage: expectedPageRef.current[source],
      activeManualSource: manualScrollSource.current,
      isDragging: scrollStates.current[source] === "dragging",
      lastScrollPos: lastScrollPosRef.current[source],
      currentPage: lastSyncedPage.current,
    });
    if (decision === "ignore") return;
    if (decision === "acknowledge-programmatic") {
      expectedPageRef.current[source] = undefined;
      delete pendingUpdates.current[source];
      return;
    }

    delete pendingUpdates.current[source];
    syncAllPagers(pos, source, false);
  };

  const goPrevMonth = () => syncAllPagers(lastSyncedPage.current - 1);
  const goNextMonth = () => syncAllPagers(lastSyncedPage.current + 1);

  const goPrevYear = () => {
    syncAllPagers(lastSyncedPage.current - 12, "year");
    safeSetPage("year", lastYearPage.current);
  };

  const goNextYear = () => {
    syncAllPagers(lastSyncedPage.current + 12, "year");
    safeSetPage("year", lastYearPage.current);
  };

  const pointerEventsFor = (key: PagerKey) =>
    activeSource === null || activeSource === key ? "auto" : "none";

  const monthFontSize = MONTH_BASE_FONT_SIZE * monthHeader.fontScale;
  const yearFontSize = YEAR_BASE_FONT_SIZE * yearHeader.fontScale;
  const cellWidth = getDayCellWidth(gridWidth, columns);
  const dayFontSize = getDayFontSize(columns);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: backgrounds.calendar
            ? "transparent"
            : colors.background,
        },
      ]}
    >
      <StatusBar style={scheme === "dark" ? "light" : "dark"} animated />

      <View
        pointerEvents="none"
        collapsable={false}
        style={styles.measureOverlay}
      >
        {MONTH_INDICES.map((m) => (
          <View
            key={`m-${monthMeasureKey}-${m}`}
            style={[styles.monthPage, { width: MEASURE_CONTAINER_WIDTH }]}
          >
            <MonthPage
              monthIndex={m}
              textColor={colors.text}
              fontFamily={titleFont}
              fontSize={MONTH_BASE_FONT_SIZE}
              onLayout={(e) =>
                monthHeader.onMeasure(m, e.nativeEvent.layout.width)
              }
            />
          </View>
        ))}

        {YEAR_PAGE_INDICES.map((p) => {
          const py = baseYear + (p - YEAR_CENTER_PAGE);
          return (
            <View
              key={`y-${yearMeasureKey}-${py}`}
              style={[styles.yearPage, { width: MEASURE_CONTAINER_WIDTH }]}
            >
              <YearPage
                yearValue={py}
                textColor={colors.text}
                fontFamily={displayFont}
                fontSize={YEAR_BASE_FONT_SIZE}
                onLayout={(e) =>
                  yearHeader.onMeasure(py, e.nativeEvent.layout.width)
                }
              />
            </View>
          );
        })}
      </View>

      <View style={styles.headerRow}>
        <Pressable onPress={goPrevYear} hitSlop={16}>
          <Ionicons
            name="chevron-back"
            size={15}
            color={colors.textSecondary}
            style={styles.hint}
          />
        </Pressable>
        <View
          pointerEvents={pointerEventsFor("year")}
          onTouchStart={() => tryLock("year")}
          onTouchEnd={() => releaseIfNotDragging("year")}
          onTouchCancel={() => releaseIfNotDragging("year")}
        >
          <Animated.View
            collapsable={false}
            style={{
              width: yearHeader.containerWidth,
              height: 90,
              overflow: "hidden",
            }}
          >
            <Animated.View
              style={{
                width: YEAR_FIXED_WIDTH,
                height: 90,
                marginLeft: yearHeader.pagerMarginLeft,
              }}
            >
              <PagerView
                ref={yearPagerRef}
                style={{ width: YEAR_FIXED_WIDTH, height: 90 }}
                initialPage={YEAR_CENTER_PAGE}
                onPageSelected={onYearPageSelected}
                onPageScroll={(e) => handlePageScroll("year", e)}
                onPageScrollStateChanged={(e) =>
                  handleScrollStateChanged(
                    "year",
                    e.nativeEvent.pageScrollState,
                  )
                }
              >
                {YEAR_PAGE_INDICES.map((p) => {
                  const py = baseYear + (p - YEAR_CENTER_PAGE);
                  return (
                    <View key={p} style={styles.yearPage}>
                      <YearPage
                        yearValue={py}
                        textColor={colors.text}
                        fontFamily={displayFont}
                        fontSize={yearFontSize}
                        maxWidth={YEAR_FIXED_WIDTH}
                      />
                    </View>
                  );
                })}
              </PagerView>
            </Animated.View>
          </Animated.View>
        </View>
        <Pressable onPress={goNextYear} hitSlop={16}>
          <Ionicons
            name="chevron-forward"
            size={15}
            color={colors.textSecondary}
            style={styles.hint}
          />
        </Pressable>
      </View>

      <View style={styles.headerRow}>
        <Pressable onPress={goPrevMonth} hitSlop={16}>
          <Ionicons
            name="chevron-back"
            size={15}
            color={colors.textSecondary}
            style={styles.hint}
          />
        </Pressable>
        <View
          pointerEvents={pointerEventsFor("month")}
          onTouchStart={() => tryLock("month")}
          onTouchEnd={() => releaseIfNotDragging("month")}
          onTouchCancel={() => releaseIfNotDragging("month")}
        >
          <Animated.View
            collapsable={false}
            style={{
              width: monthHeader.containerWidth,
              height: 90,
              overflow: "hidden",
            }}
          >
            <Animated.View
              style={{
                width: MONTH_FIXED_WIDTH,
                height: 90,
                marginLeft: monthHeader.pagerMarginLeft,
              }}
            >
              <PagerView
                ref={monthPagerRef}
                style={{ width: MONTH_FIXED_WIDTH, height: 90 }}
                initialPage={CENTER_PAGE}
                offscreenPageLimit={MONTH_RENDER_RADIUS}
                onPageSelected={(e) => onHorizontalPageSelected("month", e)}
                onPageScroll={(e) => handlePageScroll("month", e)}
                onPageScrollStateChanged={(e) =>
                  handleScrollStateChanged(
                    "month",
                    e.nativeEvent.pageScrollState,
                  )
                }
              >
                {PAGE_INDICES.map((p) => {
                  const isNear = Math.abs(p - page) <= MONTH_RENDER_RADIUS;
                  const { month: pm } = pageToYearMonth(p, baseYear, baseMonth);
                  return (
                    <View key={p} style={styles.monthPage}>
                      {isNear && (
                        <MonthPage
                          monthIndex={pm}
                          textColor={colors.text}
                          fontFamily={titleFont}
                          fontSize={monthFontSize}
                          maxWidth={MONTH_FIXED_WIDTH}
                        />
                      )}
                    </View>
                  );
                })}
              </PagerView>
            </Animated.View>
          </Animated.View>
        </View>
        <Pressable onPress={goNextMonth} hitSlop={16}>
          <Ionicons
            name="chevron-forward"
            size={15}
            color={colors.textSecondary}
            style={styles.hint}
          />
        </Pressable>
      </View>

      <Animated.View
        pointerEvents={pointerEventsFor("grid")}
        onTouchStart={() => tryLock("grid")}
        onTouchEnd={() => releaseIfNotDragging("grid")}
        onTouchCancel={() => releaseIfNotDragging("grid")}
        onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
        style={{ transform: [{ scale: gridScaleAnim }] }}
      >
        <PagerView
          ref={gridPagerRef}
          style={[
            styles.pager,
            { height: rows * rowHeight, width: GRID_WIDTH },
          ]}
          initialPage={CENTER_PAGE}
          offscreenPageLimit={GRID_RENDER_RADIUS}
          onPageSelected={(e) => onHorizontalPageSelected("grid", e)}
          onPageScroll={(e) => handlePageScroll("grid", e)}
          onPageScrollStateChanged={(e) =>
            handleScrollStateChanged("grid", e.nativeEvent.pageScrollState)
          }
        >
          {PAGE_INDICES.map((p) => {
            const isNear = Math.abs(p - page) <= GRID_RENDER_RADIUS;
            const { year: py, month: pm } = pageToYearMonth(
              p,
              baseYear,
              baseMonth,
            );
            const pageLoggedDates =
              loggedByMonth.get(getMonthKey(py, pm)) ?? EMPTY_DATE_SET;
            return (
              <View
                key={p}
                style={[styles.grid, { width: GRID_WIDTH }]}
                collapsable={false}
              >
                {isNear && (
                  <GridPage
                    year={py}
                    month={pm}
                    loggedDates={pageLoggedDates}
                    totalCells={totalCells}
                    cellWidth={cellWidth}
                    rowHeight={rowHeight}
                    fontSize={dayFontSize}
                    colors={colors}
                    boldFont={boldFont}
                    regularFont={regularFont}
                    italicFont={italicFont}
                    onDayPress={handleDayPress}
                  />
                )}
              </View>
            );
          })}
        </PagerView>
      </Animated.View>

      <SleepModal
        visible={modalVisible}
        date={selectedDate}
        onClose={() => setModalVisible(false)}
        onSaved={refreshCurrentMonth}
      />
    </View>
  );
}
export default memo(CalendarGrid);
