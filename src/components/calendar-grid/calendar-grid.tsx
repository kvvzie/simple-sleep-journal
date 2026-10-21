import { Colors } from "@/constants/theme";
import { useSettings } from "@/contexts/settings-context";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";
import { getMonthLogs, initDB } from "@/lib/db";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  DeviceEventEmitter,
  Easing,
  Pressable,
  Text,
  ToastAndroid,
  useWindowDimensions,
  View,
} from "react-native";
import PagerView from "react-native-pager-view";
import SleepModal from "../sleep-modal/sleep-modal";
import {
  getDayCellWidth,
  getDayColor,
  getDayFont,
  getDayFontSize,
  getGridRowHeight,
  styles,
} from "./calendar-grid.styles";
import {
  CalendarDay,
  getCalendarDays,
  MONTH_NAMES,
} from "./calendar-grid.utils";

const CENTER_PAGE = 60;
const TOTAL_PAGES = CENTER_PAGE * 2 + 1;
const MAX_PAGE = TOTAL_PAGES - 1;
const MONTH_RENDER_RADIUS = 2;
const GRID_RENDER_RADIUS = 1;

const YEAR_RANGE = 5;
const YEAR_TOTAL_PAGES = YEAR_RANGE * 2 + 1;
const YEAR_CENTER_PAGE = YEAR_RANGE;

const TEXT_PADDING = 48;
const DEFAULT_MONTH_WIDTH = 140;
const DEFAULT_YEAR_WIDTH = 200;

const MONTH_FIXED_WIDTH = 320;
const YEAR_FIXED_WIDTH = 300;

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

function CalendarGrid() {
  const scheme = useAppColorScheme();
  const colors = Colors[scheme];
  const { rows, columns } = useSettings();
  const totalCells = rows * columns;

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const rowHeight = getGridRowHeight(screenHeight, rows);

  const [gridWidth, setGridWidth] = useState(320);

  const GRID_WIDTH = Math.min(screenWidth * 0.88, 500);

  const todayRef = useRef(new Date());
  const baseYear = todayRef.current.getFullYear();
  const baseMonth = todayRef.current.getMonth();

  const [monthGen, setMonthGen] = useState(0);
  const [gridGen, setGridGen] = useState(0);

  const [page, setPage] = useState(CENTER_PAGE);
  const [loggedDates, setLoggedDates] = useState<Set<string>>(new Set());
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

  const [activeSource, setActiveSource] = useState<PagerKey | null>(null);
  const activeSourceRef = useRef<PagerKey | null>(null);

  const monthWidthAnim = useRef(
    new Animated.Value(DEFAULT_MONTH_WIDTH),
  ).current;
  const yearWidthAnim = useRef(new Animated.Value(DEFAULT_YEAR_WIDTH)).current;
  const gridScaleAnim = useRef(new Animated.Value(1)).current;

  const monthWidthMap = useRef<Record<number, number>>({});
  const yearWidthMap = useRef<Record<number, number>>({});
  const firstMonthMeasure = useRef(true);
  const firstYearMeasure = useRef(true);

  const refs: Record<PagerKey, React.RefObject<PagerView | null>> = {
    year: yearPagerRef,
    month: monthPagerRef,
    grid: gridPagerRef,
  };

  const { year, month } = useMemo(
    () => pageToYearMonth(page, baseYear, baseMonth),
    [page],
  );

  const yearPageIndex = useMemo(
    () => YEAR_CENTER_PAGE + (year - baseYear),
    [year, baseYear],
  );

  useEffect(() => {
    const cached = monthWidthMap.current[month];
    if (cached !== undefined) {
      Animated.timing(monthWidthAnim, {
        toValue: cached,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [month]);

  useEffect(() => {
    const cached = yearWidthMap.current[year];
    if (cached !== undefined) {
      Animated.timing(yearWidthAnim, {
        toValue: cached,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [year]);

  useEffect(() => {
    initDB();
  }, []);

  const latestLogsRequest = useRef("");

  const refreshLogs = useCallback(async () => {
    const key = `${year}-${month}`;
    latestLogsRequest.current = key;
    const logs = await getMonthLogs(year, month);
    if (latestLogsRequest.current !== key) return;
    setLoggedDates(new Set(logs.map((r) => r.date)));
  }, [year, month]);

  useEffect(() => {
    refreshLogs();
  }, [refreshLogs]);

  const prevModalVisible = useRef(false);
  useEffect(() => {
    if (prevModalVisible.current && !modalVisible) {
      refreshLogs();
    }
    prevModalVisible.current = modalVisible;
  }, [modalVisible, refreshLogs]);

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
      refreshLogs,
    );
    return () => {
      subscription.remove();
    };
  }, [refreshLogs]);

  const handleDayPress = (d: CalendarDay) => {
    if (!d.dateStr || d.type === "otherMonth" || d.type === "future") return;
    setSelectedDate(d.dateStr);
    setModalVisible(true);
  };

  const safeSetPage = (key: PagerKey, targetPage: number) => {
    if (scrollStates.current[key] === "idle") {
      refs[key].current?.setPageWithoutAnimation(targetPage);
      if (key === "year") lastYearPage.current = targetPage;
      delete pendingUpdates.current[key];
    } else {
      pendingUpdates.current[key] = targetPage;
    }
  };

  const handleScrollStateChanged = (key: PagerKey, state: ScrollState) => {
    scrollStates.current[key] = state;

    if (state === "idle" && activeSourceRef.current === key) {
      activeSourceRef.current = null;
      setActiveSource(null);
    }

    if (state === "idle" && pendingUpdates.current[key] !== undefined) {
      const target = pendingUpdates.current[key]!;
      delete pendingUpdates.current[key];
      if (key === "month") setMonthGen((g) => g + 1);
      else if (key === "grid") setGridGen((g) => g + 1);
      else {
        refs[key].current?.setPageWithoutAnimation(target);
        if (key === "year") lastYearPage.current = target;
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

  const syncAllPagers = (rawNewPage: number, source?: PagerKey) => {
    if (source) delete pendingUpdates.current[source];

    const newPage = clampPage(rawNewPage);
    if (newPage === lastSyncedPage.current) {
      if (source === "year") safeSetPage("year", yearPageIndex);
      if (source === "month") safeSetPage("month", lastSyncedPage.current);
      if (source === "grid") safeSetPage("grid", lastSyncedPage.current);
      return;
    }

    gridScaleAnim.setValue(0.98);
    Animated.spring(gridScaleAnim, {
      toValue: 1,
      friction: 2,
      tension: 16,
      useNativeDriver: true,
    }).start();

    lastSyncedPage.current = newPage;
    setPage(newPage);

    const { year: newYear } = pageToYearMonth(newPage, baseYear, baseMonth);
    const newYearPageIndex = YEAR_CENTER_PAGE + (newYear - baseYear);

    if (source !== "year") safeSetPage("year", newYearPageIndex);
    if (source === "year") lastYearPage.current = newYearPageIndex;

    if (source === "year") {
      if (scrollStates.current.month === "idle") {
        setMonthGen((g) => g + 1);
        delete pendingUpdates.current.month;
      } else {
        pendingUpdates.current.month = newPage;
      }
      if (scrollStates.current.grid === "idle") {
        setGridGen((g) => g + 1);
        delete pendingUpdates.current.grid;
      } else {
        pendingUpdates.current.grid = newPage;
      }
    } else {
      if (source !== "month") safeSetPage("month", newPage);
      if (source !== "grid") safeSetPage("grid", newPage);
    }
  };

  const onYearPageSelected = (e: { nativeEvent: { position: number } }) => {
    delete pendingUpdates.current.year;

    const yearOffset = e.nativeEvent.position - YEAR_CENTER_PAGE;
    const targetYear = baseYear + yearOffset;

    const { month: currentMonth } = pageToYearMonth(
      lastSyncedPage.current,
      baseYear,
      baseMonth,
    );

    const targetPage =
      CENTER_PAGE + (targetYear - baseYear) * 12 + (currentMonth - baseMonth);

    lastYearPage.current = e.nativeEvent.position;
    syncAllPagers(targetPage, "year");
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} animated />

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
              width: Animated.add(yearWidthAnim, TEXT_PADDING),
              height: 90,
              overflow: "hidden",
            }}
          >
            <Animated.View
              style={{
                width: YEAR_FIXED_WIDTH,
                height: 90,
                marginLeft: Animated.multiply(
                  Animated.add(yearWidthAnim, TEXT_PADDING - YEAR_FIXED_WIDTH),
                  0.5,
                ),
              }}
            >
              <PagerView
                ref={yearPagerRef}
                style={{ width: YEAR_FIXED_WIDTH, height: 90 }}
                initialPage={YEAR_CENTER_PAGE}
                onPageSelected={onYearPageSelected}
                onPageScrollStateChanged={(e) =>
                  handleScrollStateChanged(
                    "year",
                    e.nativeEvent.pageScrollState,
                  )
                }
              >
                {Array.from({ length: YEAR_TOTAL_PAGES }).map((_, p) => {
                  const py = baseYear + (p - YEAR_CENTER_PAGE);
                  return (
                    <View key={p} style={styles.yearPage}>
                      <Text
                        style={[styles.year, { color: colors.text }]}
                        onLayout={(e) => {
                          const w = e.nativeEvent.layout.width;
                          yearWidthMap.current[py] = w;
                          if (py === year && firstYearMeasure.current) {
                            yearWidthAnim.setValue(w);
                            firstYearMeasure.current = false;
                          }
                        }}
                      >
                        {py}
                      </Text>
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
              width: Animated.add(monthWidthAnim, TEXT_PADDING),
              height: 90,
              overflow: "hidden",
            }}
          >
            <Animated.View
              style={{
                width: MONTH_FIXED_WIDTH,
                height: 90,
                marginLeft: Animated.multiply(
                  Animated.add(
                    monthWidthAnim,
                    TEXT_PADDING - MONTH_FIXED_WIDTH,
                  ),
                  0.5,
                ),
              }}
            >
              <PagerView
                key={`month-${monthGen}`}
                ref={monthPagerRef}
                style={{ width: MONTH_FIXED_WIDTH, height: 90 }}
                initialPage={page}
                onPageSelected={(e) =>
                  syncAllPagers(e.nativeEvent.position, "month")
                }
                onPageScrollStateChanged={(e) =>
                  handleScrollStateChanged(
                    "month",
                    e.nativeEvent.pageScrollState,
                  )
                }
              >
                {Array.from({ length: TOTAL_PAGES }).map((_, p) => {
                  const isNear = Math.abs(p - page) <= MONTH_RENDER_RADIUS;
                  if (!isNear) return <View key={p} style={styles.monthPage} />;
                  const { month: pm } = pageToYearMonth(p, baseYear, baseMonth);
                  return (
                    <View key={p} style={styles.monthPage}>
                      <Text
                        style={[styles.month, { color: colors.text }]}
                        onLayout={(e) => {
                          const w = e.nativeEvent.layout.width;
                          monthWidthMap.current[pm] = w;
                          if (pm === month && firstMonthMeasure.current) {
                            monthWidthAnim.setValue(w);
                            firstMonthMeasure.current = false;
                          }
                        }}
                      >
                        <Text style={{ fontSize: 16 }}> </Text>
                        {MONTH_NAMES[pm]}
                        <Text style={{ fontSize: 16 }}> </Text>
                      </Text>
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
          key={`grid-${gridGen}`}
          ref={gridPagerRef}
          style={[
            styles.pager,
            { height: rows * rowHeight, width: GRID_WIDTH },
          ]}
          initialPage={page}
          onPageSelected={(e) => syncAllPagers(e.nativeEvent.position, "grid")}
          onPageScrollStateChanged={(e) =>
            handleScrollStateChanged("grid", e.nativeEvent.pageScrollState)
          }
        >
          {Array.from({ length: TOTAL_PAGES }).map((_, p) => {
            const isNear = Math.abs(p - page) <= GRID_RENDER_RADIUS;
            if (!isNear) return <View key={p} style={styles.grid} />;
            const { year: py, month: pm } = pageToYearMonth(
              p,
              baseYear,
              baseMonth,
            );
            const days = getCalendarDays(
              py,
              pm,
              py === year && pm === month ? loggedDates : new Set(),
              totalCells,
            );
            return (
              <Animated.View
                key={p}
                style={[styles.grid, { width: GRID_WIDTH }]}
                collapsable={false}
              >
                {days.map((d, i) => (
                  <Pressable
                    key={i}
                    onPress={() => handleDayPress(d)}
                    style={[
                      styles.dayCell,
                      {
                        width: getDayCellWidth(gridWidth, columns),
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
                          fontFamily: getDayFont(d.type),
                          color: getDayColor(d.type, colors),
                          fontSize: getDayFontSize(columns),
                        },
                      ]}
                    >
                      {d.day}
                    </Text>
                  </Pressable>
                ))}
              </Animated.View>
            );
          })}
        </PagerView>
      </Animated.View>

      <SleepModal
        visible={modalVisible}
        date={selectedDate}
        onClose={() => setModalVisible(false)}
        onSaved={refreshLogs}
      />
    </View>
  );
}
export default memo(CalendarGrid);
