import { useAppearance } from "@/contexts/appearance-context";
import { getNavBarClearance } from "@/contexts/nav-utils";
import { useHeaderWidthSync } from "@/hooks/use-header-width-sync";
import { getAllWeekTopicSummaries, initDB, type WeekTopicSummary } from "@/lib/db";
import { FontVariant } from "@/lib/theme-utils";
import { ThemePaletteColors } from "@/types/appearance";
import { Ionicons } from "@expo/vector-icons";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  DeviceEventEmitter,
  Easing,
  type GestureResponderEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import SmoothHorizontalPager, {
  type SmoothHorizontalPagerHandle,
} from "../smooth-pager";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  evaluatePageSelected,
  getDayCellWidth,
  getDragPreviewPage,
  isScrollSettled,
  resolveCanceledSwipePage,
  SWIPE_RETURN_THRESHOLD,
  SWIPE_TRIGGER_THRESHOLD,
} from "../calendar-grid/calendar-grid.utils";
import { styles } from "./to-discuss.styles";
import {
  DISCUSS_MONTH_NAMES,
  evaluatePinchZoomStep,
  formatFullWeekDateRange,
  formatWeekTopicSummary,
  getHalfYearWeekCells,
  getIsoMonthForIsoWeek,
  getIsoQuarterForIsoWeek,
  getIsoWeekFromDate,
  getMonthQuincunxLayout,
  getMonthWeekCells,
  getQuarterForIsoWeek,
  getQuarterMonthColumns,
  getWeekCellColor,
  getWeekCellFont,
  HALF_YEAR_COLUMNS,
  HALF_YEAR_ROWS,
  pageToYearHalf,
  pageToYearMonthIndex,
  pageToYearQuarter,
  shouldApplyPinchCooldown,
  type RecapZoomLevel,
  type WeekGridCell,
  type WeekHalf,
  type WeekQuarter,
  yearHalfToPage,
  yearMonthIndexToPage,
  yearQuarterToPage,
} from "./to-discuss.utils";
import WeekDiscussModal from "./week-discuss-modal";

const WEEKLY_RECAPS_DESCRIPTION =
  "a dedicated space for longer, structured notes beyond your daily entries. prepare what you want to talk about and easily carry over open topics week to week.";

const YEAR_RANGE = 5;
const YEAR_PAGE_COUNT = YEAR_RANGE * 2 + 1;
const YEAR_CENTER_PAGE = YEAR_RANGE;
const YEAR_HALF_QUARTER_WIDTH = 92;
const YEAR_MONTH_WIDTH = 78;
const QUARTER_EXTRA_OFFSETS = [-4, 4] as const;
const MONTH_EXTRA_OFFSETS = [-12, 12] as const;
const MONTH_INDICES = Array.from({ length: 12 }, (_, m) => m);
const MONTH_HEADER_BASE_FONT_SIZE = 34;
const MONTH_HEADER_TEXT_PADDING = 36;
const DEFAULT_MONTH_HEADER_WIDTH = 136;
const MEASURE_CONTAINER_WIDTH = 1200;

const HALF_PAGE_COUNT = YEAR_PAGE_COUNT * 2;
const QUARTER_PAGE_COUNT = YEAR_PAGE_COUNT * 4;
const MONTH_PAGE_COUNT = YEAR_PAGE_COUNT * 12;

const ZOOM_EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const HEADER_AND_TITLE_CLEARANCE = 326;
const PINCH_COOLDOWN_MS = 90;

const ZOOM_LEVELS: RecapZoomLevel[] = ["half", "quarter", "month"];
const QUARTER_NUMS: WeekQuarter[] = [1, 2, 3, 4];

type PagerKey = "year" | "month" | "grid";
type ScrollState = "idle" | "dragging" | "settling";

type ZoomTransitionData = {
  id: number;
  outgoing: { level: RecapZoomLevel; page: number };
  incoming: { level: RecapZoomLevel; page: number };
  direction: "in" | "out";
  fromPinch: boolean;
  fromScale: number;
};

function getTouchDistance(
  touches: readonly { pageX: number; pageY: number }[],
): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.hypot(dx, dy);
}

function clampYear(y: number, minYear: number): number {
  return Math.max(minYear, Math.min(minYear + YEAR_PAGE_COUNT - 1, y));
}

function getPageCountForZoom(level: RecapZoomLevel): number {
  if (level === "half") return HALF_PAGE_COUNT;
  if (level === "quarter") return QUARTER_PAGE_COUNT;
  return MONTH_PAGE_COUNT;
}

function getYearFromZoomPage(
  level: RecapZoomLevel,
  p: number,
  minYear: number,
): number {
  if (level === "half") return pageToYearHalf(p, minYear, 1, 0).year;
  if (level === "quarter") return pageToYearQuarter(p, minYear, 1, 0).year;
  return pageToYearMonthIndex(p, minYear, 0, 0).year;
}

function replaceYearInZoomPage(
  level: RecapZoomLevel,
  currentPage: number,
  targetYear: number,
  minYear: number,
): number {
  const safeYear = clampYear(targetYear, minYear);
  if (level === "half") {
    const { half } = pageToYearHalf(currentPage, minYear, 1, 0);
    return yearHalfToPage(safeYear, half, minYear, 1, 0);
  }
  if (level === "quarter") {
    const { quarter } = pageToYearQuarter(currentPage, minYear, 1, 0);
    return yearQuarterToPage(safeYear, quarter, minYear, 1, 0);
  }
  const { month } = pageToYearMonthIndex(currentPage, minYear, 0, 0);
  return yearMonthIndexToPage(safeYear, month, minYear, 0, 0);
}

function anchorToZoomPage(
  anchor: { weekYear: number; week: number },
  level: RecapZoomLevel,
  minYear: number,
): number {
  if (level === "half") {
    const safeYear = clampYear(anchor.weekYear, minYear);
    const half: WeekHalf = anchor.week <= 27 ? 1 : 2;
    return yearHalfToPage(safeYear, half, minYear, 1, 0);
  }
  if (level === "quarter") {
    const { year, quarter } = getIsoQuarterForIsoWeek(
      anchor.weekYear,
      anchor.week,
    );
    const safeYear = clampYear(year, minYear);
    return yearQuarterToPage(safeYear, quarter, minYear, 1, 0);
  }
  const { year, month } = getIsoMonthForIsoWeek(anchor.weekYear, anchor.week);
  const safeYear = clampYear(year, minYear);
  return yearMonthIndexToPage(safeYear, month, minYear, 0, 0);
}

function getDefaultAnchorForPage(
  level: RecapZoomLevel,
  p: number,
  minYear: number,
  todayIso: { weekYear: number; week: number },
  todayCalendar: { year: number; month: number },
): { weekYear: number; week: number } {
  if (level === "half") {
    const { year, half } = pageToYearHalf(p, minYear, 1, 0);
    const todayHalf: WeekHalf = todayIso.week <= 27 ? 1 : 2;
    if (year === todayIso.weekYear && half === todayHalf) {
      return { weekYear: todayIso.weekYear, week: todayIso.week };
    }
    return { weekYear: year, week: half === 1 ? 14 : 40 };
  }
  if (level === "quarter") {
    const { year, quarter } = pageToYearQuarter(p, minYear, 1, 0);
    const todayQ = getIsoQuarterForIsoWeek(todayIso.weekYear, todayIso.week);
    if (year === todayQ.year && quarter === todayQ.quarter) {
      return { weekYear: todayIso.weekYear, week: todayIso.week };
    }
    const cols = getQuarterMonthColumns(year, quarter, new Set(), "");
    const midCells = cols[1]?.cells ?? [];
    const midCell = midCells[Math.floor(midCells.length / 2)] ?? midCells[0];
    return midCell
      ? { weekYear: midCell.weekYear, week: midCell.week }
      : { weekYear: year, week: (quarter - 1) * 13 + 7 };
  }
  const { year, month } = pageToYearMonthIndex(p, minYear, 0, 0);
  if (year === todayCalendar.year && month === todayCalendar.month) {
    return { weekYear: todayIso.weekYear, week: todayIso.week };
  }
  const monthCells = getMonthWeekCells(year, month, new Set(), "");
  const mid = monthCells[Math.floor(monthCells.length / 2)] ?? monthCells[0];
  return mid
    ? { weekYear: mid.weekYear, week: mid.week }
    : { weekYear: year, week: 1 };
}

const WeekGridPage = memo(function WeekGridPage({
  zoomLevel,
  pageIndex,
  minYear,
  loggedWeekKeys,
  weekTopicSummaries,
  currentWeekKey,
  gridWidth,
  gridBoxHeight,
  halfRowHeight,
  colors,
  boldFont,
  regularFont,
  italicFont,
  onWeekPress,
  staticOverlay = false,
}: {
  zoomLevel: RecapZoomLevel;
  pageIndex: number;
  minYear: number;
  loggedWeekKeys: Set<string>;
  weekTopicSummaries: Record<string, WeekTopicSummary>;
  currentWeekKey: string;
  gridWidth: number;
  gridBoxHeight: number;
  halfRowHeight: number;
  colors: ThemePaletteColors;
  boldFont: string;
  regularFont: string;
  italicFont: string;
  onWeekPress: (cell: WeekGridCell) => void;
  staticOverlay?: boolean;
}) {
  const halfCells = useMemo(() => {
    if (zoomLevel !== "half") return [];
    const meta = pageToYearHalf(pageIndex, minYear, 1, 0);
    return getHalfYearWeekCells(
      meta.year,
      meta.half,
      loggedWeekKeys,
      currentWeekKey,
    );
  }, [zoomLevel, pageIndex, minYear, loggedWeekKeys, currentWeekKey]);

  const quarterCols = useMemo(() => {
    if (zoomLevel !== "quarter") return [];
    const meta = pageToYearQuarter(pageIndex, minYear, 1, 0);
    return getQuarterMonthColumns(
      meta.year,
      meta.quarter,
      loggedWeekKeys,
      currentWeekKey,
    );
  }, [zoomLevel, pageIndex, minYear, loggedWeekKeys, currentWeekKey]);

  const monthCells = useMemo(() => {
    if (zoomLevel !== "month") return [];
    const meta = pageToYearMonthIndex(pageIndex, minYear, 0, 0);
    return getMonthWeekCells(
      meta.year,
      meta.month,
      loggedWeekKeys,
      currentWeekKey,
    );
  }, [zoomLevel, pageIndex, minYear, loggedWeekKeys, currentWeekKey]);

  const fontForType = (type: WeekGridCell["type"]) => {
    const key = getWeekCellFont(type);
    if (key === "Redaction35-Bold") return boldFont;
    if (key === "Redaction35-Regular") return regularFont;
    return italicFont;
  };

  if (zoomLevel === "half") {
    const halfCellWidth = getDayCellWidth(gridWidth, HALF_YEAR_COLUMNS);
    const halfFontSize = Math.min(
      23,
      Math.max(
        15,
        Math.floor(Math.min(halfCellWidth * 0.27, (halfRowHeight - 18) * 0.6)),
      ),
    );
    const halfNumberLineHeight = Math.round(halfFontSize * 1.15);
    return (
      <>
        {halfCells.map((cell) => {
          const isOutside = cell.isOutsideHalf === true;
          const cellStyle = [
            styles.weekCell,
            { width: halfCellWidth, height: halfRowHeight },
          ];
          const content = (
            <>
              <Text
                numberOfLines={1}
                style={[
                  styles.weekText,
                  {
                    color: getWeekCellColor(cell.type, colors, isOutside),
                    fontFamily: fontForType(cell.type),
                    fontSize: halfFontSize,
                    lineHeight: halfNumberLineHeight,
                    includeFontPadding: false,
                  },
                ]}
              >
                {`W${cell.week}`}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.halfMonthLabel,
                  {
                    color: colors.textSecondary,
                    fontFamily: italicFont,
                    opacity: isOutside ? 0.45 : 0.78,
                  },
                ]}
              >
                {cell.monthShortLabel ? (
                  <>
                    <Text style={{ fontSize: 4 }}>{"\u00A0"}</Text>
                    {cell.monthShortLabel}
                    <Text style={{ fontSize: 4 }}>{"\u00A0"}</Text>
                  </>
                ) : (
                  " "
                )}
              </Text>
            </>
          );
          return staticOverlay ? (
            <View key={cell.weekKey} style={cellStyle}>
              {content}
            </View>
          ) : (
            <Pressable
              key={cell.weekKey}
              onPress={() => onWeekPress(cell)}
              style={cellStyle}
            >
              {content}
            </Pressable>
          );
        })}
      </>
    );
  }

  if (zoomLevel === "quarter") {
    const colWidth = Math.floor(gridWidth / 3);
    const colCellHeight = Math.max(44, Math.floor((gridBoxHeight - 24) / 5));
    const qFontSize = Math.min(
      25,
      Math.max(18, Math.floor(Math.min(colWidth * 0.24, colCellHeight * 0.46))),
    );
    return (
      <View
        style={[
          styles.quarterColumnsContainer,
          { width: gridWidth, height: gridBoxHeight },
        ]}
      >
        {quarterCols.map((col) => (
          <View
            key={col.monthIndex}
            style={[styles.quarterColumn, { width: colWidth }]}
          >
            <Text
              style={[
                styles.quarterColumnLabel,
                { color: colors.textSecondary, fontFamily: italicFont },
              ]}
            >
              {`\u00A0${col.shortMonthName}\u00A0`}
            </Text>
            {col.cells.map((cell) => {
              const itemStyle = [
                styles.quarterWeekItem,
                { height: colCellHeight },
              ];
              const content = (
                <>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.weekText,
                      {
                        color: getWeekCellColor(cell.type, colors),
                        fontFamily: fontForType(cell.type),
                        fontSize: qFontSize,
                      },
                    ]}
                  >
                    {`W${cell.week}`}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.quarterDateSubtext,
                      { color: colors.textSecondary, fontFamily: italicFont },
                    ]}
                  >
                    {cell.compactRangeLabel}
                  </Text>
                </>
              );
              return staticOverlay ? (
                <View key={cell.weekKey} style={itemStyle}>
                  {content}
                </View>
              ) : (
                <Pressable
                  key={cell.weekKey}
                  onPress={() => onWeekPress(cell)}
                  style={itemStyle}
                >
                  {content}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    );
  }

  const monthSlots = getMonthQuincunxLayout(monthCells.length);
  const monthCellWidth = Math.max(132, Math.floor(gridWidth * 0.47));
  const monthCellHeight = Math.max(82, Math.floor(gridBoxHeight * 0.36));
  const monthFontSize = Math.min(
    34,
    Math.max(
      25,
      Math.floor(Math.min(monthCellWidth * 0.24, monthCellHeight * 0.35)),
    ),
  );

  return (
    <View
      style={[
        styles.positionedCanvas,
        { width: gridWidth, height: gridBoxHeight },
      ]}
    >
      {monthCells.map((cell, idx) => {
        const slot = monthSlots[idx] ?? { xRatio: 0.5, yRatio: 0.5 };
        const left = slot.xRatio * gridWidth - monthCellWidth / 2;
        const top = slot.yRatio * gridBoxHeight - monthCellHeight / 2;
        const summary = weekTopicSummaries[cell.weekKey];
        const summaryInfo = formatWeekTopicSummary(summary);
        const hasOpenTopics = (summary?.openCount ?? 0) > 0;
        const fullRangeLabel = formatFullWeekDateRange(cell.weekYear, cell.week);
        const cellStyle = [
          styles.positionedCell,
          { left, top, width: monthCellWidth, height: monthCellHeight },
        ];
        const content = (
          <>
            <Text
              numberOfLines={1}
              style={[
                styles.weekText,
                {
                  color: getWeekCellColor(cell.type, colors),
                  fontFamily: fontForType(cell.type),
                  fontSize: monthFontSize,
                },
              ]}
            >
              {`W${cell.week}`}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.weekRangeSubtext,
                {
                  color: colors.textSecondary,
                  fontFamily: italicFont,
                },
              ]}
            >
              {fullRangeLabel}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.weekStatusSubtext,
                {
                  color: hasOpenTopics ? colors.text : colors.textSecondary,
                  fontFamily: hasOpenTopics ? regularFont : italicFont,
                },
              ]}
            >
              {summaryInfo.statusLabel}
            </Text>
            {summaryInfo.previewTitle && (
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[
                  styles.weekTopicPreview,
                  {
                    color: colors.textSecondary,
                    fontFamily: italicFont,
                    maxWidth: monthCellWidth - 8,
                  },
                ]}
              >
                {summaryInfo.previewTitle}
              </Text>
            )}
          </>
        );
        return staticOverlay ? (
          <View key={cell.weekKey} style={cellStyle}>
            {content}
          </View>
        ) : (
          <Pressable
            key={cell.weekKey}
            onPress={() => onWeekPress(cell)}
            style={cellStyle}
          >
            {content}
          </Pressable>
        );
      })}
    </View>
  );
});

function ToDiscuss() {
  const { colors, resolveFont } = useAppearance();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const GRID_WIDTH = Math.min(screenWidth * 0.88, 500);
  const MONTH_HEADER_FIXED_WIDTH = Math.min(280, GRID_WIDTH - 32);
  const [gridWidth, setGridWidth] = useState(GRID_WIDTH);

  const navClearance = getNavBarClearance(insets.bottom);
  const containerBottomPadding = Math.round(navClearance / 3);
  const containerTopPadding = Math.max(12, insets.top);
  const availableGridHeight =
    screenHeight -
    HEADER_AND_TITLE_CLEARANCE -
    navClearance -
    containerTopPadding * 0.4;
  const halfRowHeight = Math.max(
    38,
    Math.min(58, Math.floor(availableGridHeight / HALF_YEAR_ROWS)),
  );
  const gridBoxHeight = HALF_YEAR_ROWS * halfRowHeight;

  const displayFont = resolveFont("display");
  const boldFont = resolveFont("bold" satisfies FontVariant);
  const regularFont = resolveFont("regular" satisfies FontVariant);
  const italicFont = resolveFont("italic" satisfies FontVariant);

  const todayDate = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => getIsoWeekFromDate(todayDate), [todayDate]);
  const todayCalendar = useMemo(
    () => ({
      year: todayDate.getFullYear(),
      month: todayDate.getMonth(),
    }),
    [todayDate],
  );
  const baseYear = todayIso.weekYear;
  const minYear = baseYear - YEAR_RANGE;
  const baseHalf: WeekHalf = todayIso.week <= 27 ? 1 : 2;
  const initialHalfPage = YEAR_RANGE * 2 + (baseHalf - 1);
  const initialQuarter = getQuarterForIsoWeek(todayIso.week);
  const currentWeekKey = todayIso.weekKey;

  const [zoomLevel, setZoomLevel] = useState<RecapZoomLevel>("half");
  const [pagerZoomLevel, setPagerZoomLevel] = useState<RecapZoomLevel>("half");
  const pagerZoomLevelRef = useRef<RecapZoomLevel>("half");
  const zoomLevelRef = useRef<RecapZoomLevel>("half");
  const [zoomHydrationStage, setZoomHydrationStage] = useState<0 | 1 | 2>(2);
  const [initialGridPage, setInitialGridPage] = useState(initialHalfPage);
  const [monthEnterSeq, setMonthEnterSeq] = useState(0);
  const [monthHeaderInitialPage, setMonthHeaderInitialPage] =
    useState(initialHalfPage);

  const [page, setPage] = useState(initialHalfPage);

  const [weekTopicSummaries, setWeekTopicSummaries] = useState<
    Record<string, WeekTopicSummary>
  >({});
  const loggedWeekKeys = useMemo(
    () => new Set(Object.keys(weekTopicSummaries)),
    [weekTopicSummaries],
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);
  const [isPinching, setIsPinching] = useState(false);
  const [zoomTransition, setZoomTransition] =
    useState<ZoomTransitionData | null>(null);
  const [zoomAnimSettled, setZoomAnimSettled] = useState(false);
  const zoomAnimSettledRef = useRef(false);
  const [handoffReadyId, setHandoffReadyId] = useState<number | null>(null);
  const handoffReadyIdRef = useRef<number | null>(null);
  const zoomTransitionRef = useRef<ZoomTransitionData | null>(null);
  const zoomTransitionIdRef = useRef(0);

  const gridPagerRef = useRef<SmoothHorizontalPagerHandle>(null);
  const yearPagerRef = useRef<SmoothHorizontalPagerHandle>(null);
  const monthHeaderPagerRef = useRef<SmoothHorizontalPagerHandle>(null);
  const lastSyncedPage = useRef(initialHalfPage);
  const lastYearPage = useRef(YEAR_CENTER_PAGE);
  const anchorWeekRef = useRef<{ weekYear: number; week: number }>({
    weekYear: todayIso.weekYear,
    week: todayIso.week,
  });

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
  const pinchScaleAnim = useRef(new Animated.Value(1)).current;
  const combinedGridScale = useRef(
    Animated.multiply(gridScaleAnim, pinchScaleAnim),
  ).current;

  const outgoingScaleAnim = useRef(new Animated.Value(1)).current;
  const outgoingOpacityAnim = useRef(new Animated.Value(1)).current;
  const incomingScaleAnim = useRef(new Animated.Value(1)).current;
  const incomingOpacityAnim = useRef(new Animated.Value(0)).current;
  const allGridScale = useRef(
    Animated.multiply(combinedGridScale, outgoingScaleAnim),
  ).current;

  const activeTransitionAnimRef = useRef<Animated.CompositeAnimation | null>(
    null,
  );
  const activeOutgoingAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const hydrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerOpacityAnim = useRef(new Animated.Value(1)).current;
  const headerScaleAnim = useRef(new Animated.Value(1)).current;
  const headerAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const startRafRef = useRef<number | null>(null);
  const handoffRafRef = useRef<number | null>(null);
  const resetPinchStateRef = useRef<(animateBack?: boolean) => void>(() => {});
  const livePinchScaleRef = useRef(1);
  const pinchCooldownUntilRef = useRef(0);

  const halfAnim = useRef(new Animated.Value(baseHalf === 1 ? 0 : 1)).current;
  const quarterAnims = useRef(
    QUARTER_NUMS.map((q) => new Animated.Value(q === initialQuarter ? 1 : 0)),
  ).current;

  const pagerRefs: Record<
    PagerKey,
    React.RefObject<SmoothHorizontalPagerHandle | null>
  > = {
    year: yearPagerRef,
    month: monthHeaderPagerRef,
    grid: gridPagerRef,
  };

  const year = getYearFromZoomPage(zoomLevel, page, minYear);
  const activeHalf: WeekHalf =
    zoomLevel === "half" ? pageToYearHalf(page, minYear, 1, 0).half : 1;
  const activeQuarter: WeekQuarter =
    zoomLevel === "quarter" ? pageToYearQuarter(page, minYear, 1, 0).quarter : 1;
  const activeMonth =
    zoomLevel === "month" ? pageToYearMonthIndex(page, minYear, 0, 0).month : 0;

  const monthMeasureKey = `${boldFont}|${MONTH_HEADER_FIXED_WIDTH}`;
  const monthHeader = useHeaderWidthSync({
    activeKey: activeMonth,
    measureKey: monthMeasureKey,
    fixedWidth: MONTH_HEADER_FIXED_WIDTH,
    defaultWidth: DEFAULT_MONTH_HEADER_WIDTH,
    minScale: 0.65,
    textPadding: MONTH_HEADER_TEXT_PADDING,
    snapVersion: zoomLevel === "month" ? `m-${monthEnterSeq}` : "inactive",
  });
  const monthHeaderFontSize =
    MONTH_HEADER_BASE_FONT_SIZE * monthHeader.fontScale;

  const yearPageIndex = YEAR_CENTER_PAGE + (year - baseYear);

  const cancelTransitionTimers = useCallback(() => {
    activeTransitionAnimRef.current?.stop();
    activeTransitionAnimRef.current = null;
    activeOutgoingAnimRef.current?.stop();
    activeOutgoingAnimRef.current = null;
    if (hydrationTimerRef.current !== null) {
      clearTimeout(hydrationTimerRef.current);
      hydrationTimerRef.current = null;
    }
    if (startRafRef.current !== null) {
      cancelAnimationFrame(startRafRef.current);
      startRafRef.current = null;
    }
    if (handoffRafRef.current !== null) {
      cancelAnimationFrame(handoffRafRef.current);
      handoffRafRef.current = null;
    }
  }, []);

  const commitZoomHandoff = useCallback(
    (transitionId: number, targetLevel: RecapZoomLevel) => {
      if (
        zoomTransitionRef.current?.id !== transitionId ||
        handoffReadyIdRef.current === transitionId
      ) {
        return;
      }
      handoffReadyIdRef.current = transitionId;
      pagerZoomLevelRef.current = targetLevel;
      setPagerZoomLevel(targetLevel);
      setHandoffReadyId(transitionId);
    },
    [],
  );

  // Progressive post-zoom neighbor hydration: mount ±1 immediately after handoff so swiping works
  // right away without stalling Fabric, then warm ±2 / ±1y neighbors in background once idle.
  useEffect(() => {
    if (hydrationTimerRef.current !== null) {
      clearTimeout(hydrationTimerRef.current);
      hydrationTimerRef.current = null;
    }
    if (zoomTransition !== null) {
      setZoomHydrationStage(0);
      return;
    }
    setZoomHydrationStage((prev) => (prev === 0 ? 1 : prev));
  }, [zoomTransition, zoomLevel]);

  useEffect(() => {
    if (zoomTransition !== null || zoomHydrationStage !== 1) return;
    hydrationTimerRef.current = setTimeout(() => {
      hydrationTimerRef.current = null;
      setZoomHydrationStage(2);
    }, 220);
    return () => {
      if (hydrationTimerRef.current !== null) {
        clearTimeout(hydrationTimerRef.current);
        hydrationTimerRef.current = null;
      }
    };
  }, [zoomHydrationStage, zoomTransition]);

  useEffect(() => {
    if (!zoomTransition) return;
    const { id } = zoomTransition;

    // Outgoing starts synchronously inside `changeZoomLevel` at t=0; join incoming right after 1 frame
    // so both layers travel along one continuous optical zoom without lingering overlap.
    const inAnim = Animated.sequence([
      Animated.delay(20),
      Animated.parallel([
        Animated.timing(incomingScaleAnim, {
          toValue: 1,
          duration: 230,
          easing: ZOOM_EASE_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(incomingOpacityAnim, {
          toValue: 1,
          duration: 165,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);

    startRafRef.current = requestAnimationFrame(() => {
      startRafRef.current = null;
      if (zoomTransitionRef.current?.id !== id) return;
      activeTransitionAnimRef.current = inAnim;
      inAnim.start(({ finished }) => {
        if (!finished || zoomTransitionRef.current?.id !== id) return;
        activeTransitionAnimRef.current = null;
        zoomAnimSettledRef.current = true;
        setZoomAnimSettled(true);
        if (prevTouchCountRef.current < 2) {
          commitZoomHandoff(id, zoomTransition.incoming.level);
        } else {
          // Keep the underlying pager mounted while 2 fingers remain on screen so
          // JSTouchDispatcher keeps routing moves for continuous Stage-2 pinching.
          pinchTriggeredRef.current = false;
          pinchActiveRef.current = true;
        }
      });
    });

    return () => {
      cancelTransitionTimers();
    };
  }, [
    zoomTransition,
    cancelTransitionTimers,
    commitZoomHandoff,
    incomingScaleAnim,
    incomingOpacityAnim,
  ]);

  // Reveal the new pager cleanly after React + Fabric commit `pagerZoomLevel === incoming.level`
  // behind the opaque incoming cover, minimizing post-zoom swipe wait.
  useEffect(() => {
    if (!zoomTransition || handoffReadyId !== zoomTransition.id) return;
    if (pagerZoomLevel !== zoomTransition.incoming.level) return;
    const { id } = zoomTransition;
    handoffRafRef.current = requestAnimationFrame(() => {
      handoffRafRef.current = null;
      if (zoomTransitionRef.current?.id !== id) return;
      outgoingScaleAnim.setValue(1);
      outgoingOpacityAnim.setValue(1);
      zoomTransitionRef.current = null;
      zoomAnimSettledRef.current = false;
      handoffReadyIdRef.current = null;
      setHandoffReadyId(null);
      setZoomAnimSettled(false);
      setZoomTransition(null);
      setZoomHydrationStage(1);
      if (prevTouchCountRef.current < 2) {
        pinchTriggeredRef.current = false;
        pinchStageRef.current = 0;
        pinchStageDirRef.current = null;
        pinchStartDistRef.current = null;
        if (pinchActiveRef.current) {
          resetPinchStateRef.current(false);
        }
      }
    });
    return () => {
      if (handoffRafRef.current !== null) {
        cancelAnimationFrame(handoffRafRef.current);
        handoffRafRef.current = null;
      }
    };
  }, [
    handoffReadyId,
    pagerZoomLevel,
    zoomTransition,
    outgoingScaleAnim,
    outgoingOpacityAnim,
  ]);

  useEffect(() => {
    if (zoomLevel !== "half") return;
    Animated.spring(halfAnim, {
      toValue: activeHalf === 1 ? 0 : 1,
      damping: 18,
      stiffness: 240,
      useNativeDriver: true,
    }).start();
  }, [zoomLevel, activeHalf, halfAnim]);

  useEffect(() => {
    if (zoomLevel !== "quarter") return;
    Animated.parallel(
      QUARTER_NUMS.map((q, idx) =>
        Animated.spring(quarterAnims[idx], {
          toValue: q === activeQuarter ? 1 : 0,
          damping: 18,
          stiffness: 240,
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [zoomLevel, activeQuarter, quarterAnims]);

  useEffect(() => {
    return () => {
      headerAnimRef.current?.stop();
      cancelTransitionTimers();
    };
  }, [cancelTransitionTimers]);

  const refreshAllLoggedWeeks = useCallback(async () => {
    const summaries = await getAllWeekTopicSummaries();
    setWeekTopicSummaries(summaries);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await initDB();
      if (active) await refreshAllLoggedWeeks();
    })();
    return () => {
      active = false;
    };
  }, [refreshAllLoggedWeeks]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      "refreshToDiscuss",
      refreshAllLoggedWeeks,
    );
    return () => sub.remove();
  }, [refreshAllLoggedWeeks]);

  const safeSetPage = (key: PagerKey, targetPage: number) => {
    const ref = pagerRefs[key].current;
    if (scrollStates.current[key] === "idle") {
      expectedPageRef.current[key] = undefined;
      ref?.setPageWithoutAnimation(targetPage);
      if (key === "year") lastYearPage.current = targetPage;
      delete pendingUpdates.current[key];
    } else {
      expectedPageRef.current[key] = targetPage;
      pendingUpdates.current[key] = targetPage;
    }
  };

  const syncPagers = (
    rawNewPage: number,
    source?: PagerKey,
    bounce = true,
  ) => {
    const currentZoom = zoomLevelRef.current;
    const maxPage = getPageCountForZoom(currentZoom) - 1;
    if (source) delete pendingUpdates.current[source];
    const newPage = Math.max(0, Math.min(maxPage, rawNewPage));

    if (zoomTransitionRef.current !== null) {
      cancelTransitionTimers();
      outgoingScaleAnim.setValue(1);
      outgoingOpacityAnim.setValue(1);
      zoomTransitionRef.current = null;
      zoomAnimSettledRef.current = false;
      handoffReadyIdRef.current = null;
      setHandoffReadyId(null);
      setZoomAnimSettled(false);
      setZoomTransition(null);
      pagerZoomLevelRef.current = currentZoom;
      setPagerZoomLevel(currentZoom);
      setZoomHydrationStage(1);
    }

    if (newPage === lastSyncedPage.current) {
      if (rawNewPage !== newPage) {
        if (source === "year") {
          const curYear = getYearFromZoomPage(
            currentZoom,
            lastSyncedPage.current,
            minYear,
          );
          safeSetPage("year", YEAR_CENTER_PAGE + (curYear - baseYear));
        }
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

    anchorWeekRef.current = getDefaultAnchorForPage(
      currentZoom,
      newPage,
      minYear,
      todayIso,
      todayCalendar,
    );

    const nextYear = getYearFromZoomPage(currentZoom, newPage, minYear);
    const targetYearPage = Math.max(
      0,
      Math.min(YEAR_PAGE_COUNT - 1, YEAR_CENTER_PAGE + (nextYear - baseYear)),
    );

    if (source !== "grid") safeSetPage("grid", newPage);
    if (currentZoom === "month" && source !== "month") {
      safeSetPage("month", newPage);
    }
    if (source !== "year" && targetYearPage !== lastYearPage.current) {
      safeSetPage("year", targetYearPage);
    } else if (source === "year") {
      lastYearPage.current = targetYearPage;
    }
  };

  const changeZoomLevel = useCallback(
    (nextLevel: RecapZoomLevel, fromScale = 1, fromPinch = false) => {
      const prevLevel = zoomLevelRef.current;
      if (nextLevel === prevLevel) return;

      const prevPage = lastSyncedPage.current;
      const prevOrder = ZOOM_LEVELS.indexOf(prevLevel);
      const nextOrder = ZOOM_LEVELS.indexOf(nextLevel);
      const direction: "in" | "out" = nextOrder > prevOrder ? "in" : "out";

      const targetPage = anchorToZoomPage(
        anchorWeekRef.current,
        nextLevel,
        minYear,
      );
      const nextYear = getYearFromZoomPage(nextLevel, targetPage, minYear);
      const targetYearPage = Math.max(
        0,
        Math.min(YEAR_PAGE_COUNT - 1, YEAR_CENTER_PAGE + (nextYear - baseYear)),
      );

      cancelTransitionTimers();

      const prevYearPage = lastYearPage.current;
      scrollStates.current = { year: "idle", month: "idle", grid: "idle" };
      pendingUpdates.current = {};
      lastScrollPosRef.current = {};
      lastOffsetRef.current = {};
      pendingGestureFinishRef.current = {};
      expectedPageRef.current =
        targetYearPage !== prevYearPage ? { year: targetYearPage } : {};
      manualScrollSource.current = null;
      dragAnchorRef.current = null;
      dragStartPosRef.current = null;
      dragCommittedDirRef.current = 0;
      hadMovedInGestureRef.current = false;
      activeSourceRef.current = null;
      setActiveSource(null);

      pinchCooldownUntilRef.current = 0;
      livePinchScaleRef.current = 1;
      if (!fromPinch || prevTouchCountRef.current < 2) {
        // Release pinch scroll lock immediately on non-pinch / lifted-finger zooms so
        // the upcoming pager mounts with scrollEnabled=true.
        pinchActiveRef.current = false;
        setIsPinching(false);
      }
      if (!fromPinch) {
        pinchStartDistRef.current = null;
        pinchTriggeredRef.current = false;
        pinchStageRef.current = 0;
        pinchStageDirRef.current = null;
      }

      lastSyncedPage.current = targetPage;
      lastYearPage.current = targetYearPage;
      yearPagerRef.current?.setPageWithoutAnimation(targetYearPage);

      // Snap header indicators directly so 0 concurrent spring animations fight Frame 0.
      if (nextLevel === "half") {
        const nextHalf = pageToYearHalf(targetPage, minYear, 1, 0).half;
        halfAnim.stopAnimation();
        halfAnim.setValue(nextHalf === 1 ? 0 : 1);
      } else if (nextLevel === "quarter") {
        const nextQuarter = pageToYearQuarter(
          targetPage,
          minYear,
          1,
          0,
        ).quarter;
        QUARTER_NUMS.forEach((q, idx) => {
          quarterAnims[idx].stopAnimation();
          quarterAnims[idx].setValue(q === nextQuarter ? 1 : 0);
        });
      }

      outgoingOpacityAnim.setValue(1);
      outgoingScaleAnim.setValue(fromScale);
      pinchScaleAnim.setValue(1);

      const outEndScale =
        direction === "in"
          ? Math.max(fromScale * 1.22, fromScale + 0.24)
          : Math.min(fromScale * 0.78, fromScale - 0.22);
      const outAnim = Animated.parallel([
        Animated.timing(outgoingScaleAnim, {
          toValue: outEndScale,
          duration: 200,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
        Animated.timing(outgoingOpacityAnim, {
          toValue: 0,
          duration: 115,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]);
      activeOutgoingAnimRef.current = outAnim;
      outAnim.start(({ finished }) => {
        if (finished && activeOutgoingAnimRef.current === outAnim) {
          activeOutgoingAnimRef.current = null;
        }
      });

      incomingOpacityAnim.setValue(0);
      incomingScaleAnim.setValue(direction === "in" ? 0.78 : 1.24);

      headerAnimRef.current?.stop();
      headerOpacityAnim.setValue(0.2);
      headerScaleAnim.setValue(direction === "in" ? 0.9 : 1.1);
      const headerAnim = Animated.parallel([
        Animated.timing(headerOpacityAnim, {
          toValue: 1,
          duration: 190,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(headerScaleAnim, {
          toValue: 1,
          duration: 220,
          easing: ZOOM_EASE_OUT,
          useNativeDriver: true,
        }),
      ]);
      headerAnimRef.current = headerAnim;
      headerAnim.start(({ finished }) => {
        if (finished && headerAnimRef.current === headerAnim) {
          headerAnimRef.current = null;
        }
      });

      zoomLevelRef.current = nextLevel;
      zoomAnimSettledRef.current = false;
      handoffReadyIdRef.current = null;
      setZoomAnimSettled(false);
      setHandoffReadyId(null);
      setZoomHydrationStage(0);
      setInitialGridPage(targetPage);
      if (nextLevel === "month") {
        setMonthEnterSeq((s) => s + 1);
        setMonthHeaderInitialPage(targetPage);
      }
      setPage(targetPage);
      setZoomLevel(nextLevel);

      const nextTransition: ZoomTransitionData = {
        id: ++zoomTransitionIdRef.current,
        outgoing: { level: prevLevel, page: prevPage },
        incoming: { level: nextLevel, page: targetPage },
        direction,
        fromPinch,
        fromScale,
      };
      zoomTransitionRef.current = nextTransition;
      setZoomTransition(nextTransition);
    },
    [
      baseYear,
      minYear,
      cancelTransitionTimers,
      halfAnim,
      quarterAnims,
      pinchScaleAnim,
      outgoingOpacityAnim,
      outgoingScaleAnim,
      incomingOpacityAnim,
      incomingScaleAnim,
      headerOpacityAnim,
      headerScaleAnim,
    ],
  );

  const changeZoomLevelRef = useRef(changeZoomLevel);
  changeZoomLevelRef.current = changeZoomLevel;

  const pinchActiveRef = useRef(false);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchTriggeredRef = useRef(false);
  const pinchStageRef = useRef(0);
  const pinchStageDirRef = useRef<"in" | "out" | null>(null);
  const prevTouchCountRef = useRef(0);

  const resetPinchState = useCallback(
    (animateBack = true) => {
      const wasActive = pinchActiveRef.current;
      const wasTriggered =
        pinchTriggeredRef.current || pinchStageRef.current > 0;
      const hadLiveScale = Math.abs(livePinchScaleRef.current - 1) > 0.001;
      const applyCooldown = shouldApplyPinchCooldown(wasActive, wasTriggered);
      pinchActiveRef.current = false;
      pinchStartDistRef.current = null;
      pinchTriggeredRef.current = false;
      pinchStageRef.current = 0;
      pinchStageDirRef.current = null;
      livePinchScaleRef.current = 1;
      pinchCooldownUntilRef.current = applyCooldown
        ? Date.now() + PINCH_COOLDOWN_MS
        : 0;
      setIsPinching(false);

      if (applyCooldown && scrollStates.current.grid === "idle") {
        gridPagerRef.current?.setPageWithoutAnimation(lastSyncedPage.current);
      }

      const activeTr = zoomTransitionRef.current;
      if (
        activeTr !== null &&
        zoomAnimSettledRef.current &&
        handoffReadyIdRef.current === null
      ) {
        commitZoomHandoff(activeTr.id, activeTr.incoming.level);
      }

      if (animateBack && (!wasTriggered || hadLiveScale)) {
        Animated.spring(pinchScaleAnim, {
          toValue: 1,
          damping: 18,
          stiffness: 240,
          useNativeDriver: true,
        }).start();
      }
    },
    [commitZoomHandoff, pinchScaleAnim],
  );
  resetPinchStateRef.current = resetPinchState;

  const handlePinchTouchCapture = useCallback(
    (evt: GestureResponderEvent) => {
      const touches = evt.nativeEvent.touches;
      const prevCount = prevTouchCountRef.current;
      prevTouchCountRef.current = touches.length;

      // Clear any orphaned pinch lock left behind if an unmounted child dropped touchEnd.
      if (touches.length < 2) {
        if (
          pinchActiveRef.current ||
          pinchTriggeredRef.current ||
          pinchStageRef.current > 0
        ) {
          resetPinchState(true);
        }
        return;
      }

      const isFreshTwoFingerStart = prevCount < 2;
      if (zoomTransitionRef.current === null && isFreshTwoFingerStart) {
        pinchStageRef.current = 0;
        pinchStageDirRef.current = null;
        pinchActiveRef.current = true;
        pinchTriggeredRef.current = false;
        pinchCooldownUntilRef.current = Date.now() + PINCH_COOLDOWN_MS;
        pinchStartDistRef.current = getTouchDistance(touches);
        livePinchScaleRef.current = 1;
        setIsPinching(true);
        if (activeSourceRef.current === "grid") {
          activeSourceRef.current = null;
          setActiveSource(null);
        }
        manualScrollSource.current = null;
        scrollStates.current.grid = "idle";
        dragAnchorRef.current = null;
        dragStartPosRef.current = null;
        dragCommittedDirRef.current = 0;
        hadMovedInGestureRef.current = false;
      }
    },
    [resetPinchState],
  );

  const handlePinchTouchReleaseCapture = useCallback(
    (evt: GestureResponderEvent) => {
      const remaining = evt.nativeEvent.touches.length;
      prevTouchCountRef.current = remaining;
      if (
        remaining < 2 &&
        (pinchActiveRef.current ||
          pinchTriggeredRef.current ||
          pinchStageRef.current > 0)
      ) {
        resetPinchState(true);
      }
    },
    [resetPinchState],
  );

  const pinchPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (evt) =>
        evt.nativeEvent.touches.length >= 2,
      onMoveShouldSetPanResponderCapture: (evt) =>
        evt.nativeEvent.touches.length >= 2,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        prevTouchCountRef.current = touches.length;
        if (touches.length >= 2 && zoomTransitionRef.current === null) {
          pinchActiveRef.current = true;
          pinchTriggeredRef.current = false;
          pinchCooldownUntilRef.current = Date.now() + PINCH_COOLDOWN_MS;
          if (!pinchStartDistRef.current || pinchStartDistRef.current <= 0) {
            pinchStartDistRef.current = getTouchDistance(touches);
            livePinchScaleRef.current = 1;
          }
          setIsPinching(true);
        }
      },
      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        prevTouchCountRef.current = touches.length;
        if (touches.length < 2) {
          if (
            pinchActiveRef.current ||
            pinchTriggeredRef.current ||
            pinchStageRef.current > 0
          ) {
            resetPinchState(true);
          }
          return;
        }
        if (zoomTransitionRef.current !== null && !zoomAnimSettledRef.current) {
          return;
        }

        const dist = getTouchDistance(touches);
        if (!pinchActiveRef.current) {
          pinchActiveRef.current = true;
          pinchTriggeredRef.current = false;
          setIsPinching(true);
          if (!pinchStartDistRef.current || pinchStartDistRef.current <= 0) {
            pinchStartDistRef.current = dist;
            livePinchScaleRef.current = 1;
            return;
          }
        }
        if (!pinchStartDistRef.current || pinchStartDistRef.current <= 0) {
          pinchStartDistRef.current = dist;
          livePinchScaleRef.current = 1;
          return;
        }
        if (pinchTriggeredRef.current) return;

        const startDist = pinchStartDistRef.current;
        const ratio = dist / startDist;
        const curLevel = zoomLevelRef.current;
        const curIdx = ZOOM_LEVELS.indexOf(curLevel);
        const canZoomIn = curIdx < ZOOM_LEVELS.length - 1;
        const canZoomOut = curIdx > 0;
        const isStage2 = pinchStageRef.current > 0;

        let nextScale = 1;
        if (isStage2) {
          const sameDirIn =
            pinchStageDirRef.current === "in" && ratio > 1 && canZoomIn;
          const sameDirOut =
            pinchStageDirRef.current === "out" && ratio < 1 && canZoomOut;
          if (sameDirIn || sameDirOut) {
            nextScale = Math.max(
              0.82,
              Math.min(1.22, 1 + (ratio - 1) * 0.38),
            );
          } else {
            nextScale = 1;
          }
        } else if ((ratio > 1 && canZoomIn) || (ratio < 1 && canZoomOut)) {
          nextScale = Math.max(
            0.76,
            Math.min(1.28, 1 + (ratio - 1) * 0.9),
          );
        } else {
          // Subtle rubber-band resistance at boundary zoom levels
          nextScale = Math.max(0.95, Math.min(1.05, 1 + (ratio - 1) * 0.18));
        }

        livePinchScaleRef.current = nextScale;
        pinchScaleAnim.setValue(nextScale);

        const step = evaluatePinchZoomStep({
          currentZoomLevel: curLevel,
          anchorDist: startDist,
          currentDist: dist,
          stage: pinchStageRef.current,
          allowedDirection: pinchStageDirRef.current,
        });

        if (step) {
          pinchTriggeredRef.current = true;
          pinchStageRef.current += 1;
          pinchStageDirRef.current = step.direction;
          pinchStartDistRef.current = dist;
          changeZoomLevelRef.current(step.nextLevel, nextScale, true);
        }
      },
      onPanResponderRelease: () => {
        prevTouchCountRef.current = 0;
        resetPinchState(true);
      },
      onPanResponderTerminate: () => {
        prevTouchCountRef.current = 0;
        resetPinchState(true);
      },
    }),
  ).current;

  const tryLock = (key: PagerKey) => {
    if (key === "grid" && pinchActiveRef.current) {
      return;
    }
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

  const reconcileCanceledGestureIfNeeded = (key: PagerKey) => {
    const canceledTarget = resolveCanceledSwipePage({
      scrollPos:
        lastScrollPosRef.current[key] ??
        (key === "year" ? lastYearPage.current : lastSyncedPage.current),
      offset: lastOffsetRef.current[key] ?? 0,
      dragAnchor: dragAnchorRef.current,
      hadMovedInGesture: hadMovedInGestureRef.current,
      currentTarget:
        key === "year" ? lastYearPage.current : lastSyncedPage.current,
      isDragging: scrollStates.current[key] === "dragging",
    });
    if (canceledTarget === null) return;
    if (key === "year") {
      lastYearPage.current = canceledTarget;
      const targetYear = baseYear + (canceledTarget - YEAR_CENTER_PAGE);
      const targetGrid = replaceYearInZoomPage(
        zoomLevelRef.current,
        lastSyncedPage.current,
        targetYear,
        minYear,
      );
      syncPagers(targetGrid, "year", false);
    } else {
      syncPagers(canceledTarget, key, false);
    }
  };

  const reconcileSettledGestureIfNeeded = (key: PagerKey) => {
    const rawPos = lastScrollPosRef.current[key];
    if (rawPos === undefined || pendingUpdates.current[key] !== undefined) {
      return;
    }
    if (key === "year") {
      const settledYearPage = Math.max(
        0,
        Math.min(YEAR_PAGE_COUNT - 1, Math.round(rawPos)),
      );
      if (settledYearPage !== lastYearPage.current) {
        lastYearPage.current = settledYearPage;
        const targetYear = baseYear + (settledYearPage - YEAR_CENTER_PAGE);
        const targetGrid = replaceYearInZoomPage(
          zoomLevelRef.current,
          lastSyncedPage.current,
          targetYear,
          minYear,
        );
        syncPagers(targetGrid, "year", false);
      }
      return;
    }

    const maxPage = getPageCountForZoom(zoomLevelRef.current) - 1;
    const settledPage = Math.max(0, Math.min(maxPage, Math.round(rawPos)));
    if (settledPage !== lastSyncedPage.current) {
      syncPagers(settledPage, key, false);
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
      expectedPageRef.current[key] = undefined;
      pagerRefs[key].current?.setPageWithoutAnimation(target);
      if (key === "year") lastYearPage.current = target;
    }
  };

  const handleScrollStateChanged = (
    key: PagerKey,
    state: ScrollState,
    boundLevel?: RecapZoomLevel,
  ) => {
    if (boundLevel !== undefined && boundLevel !== zoomLevelRef.current) {
      return;
    }
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
          pendingGestureFinishRef.current[key] = true;
          return;
        }
        reconcileCanceledGestureIfNeeded(key);
        reconcileSettledGestureIfNeeded(key);
      }
      finishGesture(key);
    }
  };

  const handlePageScroll = (
    key: PagerKey,
    e: { nativeEvent: { position: number; offset: number } },
    boundLevel?: RecapZoomLevel,
  ) => {
    if (boundLevel !== undefined && boundLevel !== zoomLevelRef.current) {
      return;
    }
    if (
      pinchActiveRef.current ||
      (key === "grid" && Date.now() < pinchCooldownUntilRef.current)
    ) {
      return;
    }
    const offset = e.nativeEvent.offset;
    const pos = e.nativeEvent.position + offset;
    lastScrollPosRef.current[key] = pos;
    lastOffsetRef.current[key] = offset;

    if (
      manualScrollSource.current !== key &&
      activeSourceRef.current !== key
    ) {
      return;
    }

    if (pendingGestureFinishRef.current[key] && isScrollSettled(offset)) {
      reconcileCanceledGestureIfNeeded(key);
      reconcileSettledGestureIfNeeded(key);
      finishGesture(key);
      return;
    }

    if (manualScrollSource.current === null) {
      manualScrollSource.current = key;
    }
    if (dragAnchorRef.current === null) {
      dragAnchorRef.current =
        key === "year" ? lastYearPage.current : lastSyncedPage.current;
    }

    const anchor = dragAnchorRef.current;
    const maxPage =
      key === "year"
        ? YEAR_PAGE_COUNT - 1
        : getPageCountForZoom(zoomLevelRef.current) - 1;
    if (dragStartPosRef.current === null) dragStartPosRef.current = pos;

    // Track genuine multi-page fast flings once scroll crosses > 1 full page past anchor.
    if (manualScrollSource.current === key && Math.abs(pos - anchor) >= 1.05) {
      const flewPage = Math.max(0, Math.min(maxPage, Math.round(pos)));
      dragAnchorRef.current = flewPage;
      dragStartPosRef.current = flewPage;
      dragCommittedDirRef.current = 0;
      hadMovedInGestureRef.current = true;
      if (key === "year") {
        if (flewPage !== lastYearPage.current) {
          lastYearPage.current = flewPage;
          const targetYear = baseYear + (flewPage - YEAR_CENTER_PAGE);
          const targetGrid = replaceYearInZoomPage(
            zoomLevelRef.current,
            lastSyncedPage.current,
            targetYear,
            minYear,
          );
          syncPagers(targetGrid, "year", false);
        }
      } else if (flewPage !== lastSyncedPage.current) {
        syncPagers(flewPage, key, false);
      }
      return;
    }

    const gestureMovedScrollPos = anchor + (pos - dragStartPosRef.current);
    const preview = getDragPreviewPage({
      scrollPos: gestureMovedScrollPos,
      anchorPage: anchor,
      committedDir: dragCommittedDirRef.current,
      isDragging: scrollStates.current[key] === "dragging",
      triggerThreshold: SWIPE_TRIGGER_THRESHOLD,
      returnThreshold: SWIPE_RETURN_THRESHOLD,
      minPage: 0,
      maxPage,
    });
    if (preview === null) return;

    dragCommittedDirRef.current = preview.nextDir;
    hadMovedInGestureRef.current = preview.nextDir !== 0;
    const bounce = preview.nextDir !== 0;
    if (key === "year") {
      lastYearPage.current = preview.targetPage;
      const targetYear = baseYear + (preview.targetPage - YEAR_CENTER_PAGE);
      const targetGrid = replaceYearInZoomPage(
        zoomLevelRef.current,
        lastSyncedPage.current,
        targetYear,
        minYear,
      );
      syncPagers(targetGrid, "year", bounce);
    } else {
      syncPagers(preview.targetPage, key, bounce);
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
    const targetYear = baseYear + (pos - YEAR_CENTER_PAGE);
    const targetGrid = replaceYearInZoomPage(
      zoomLevelRef.current,
      lastSyncedPage.current,
      targetYear,
      minYear,
    );
    if (targetGrid !== lastSyncedPage.current) {
      syncPagers(targetGrid, "year", false);
    }
  };

  const onHorizontalPageSelected = (
    source: "month" | "grid",
    e: { nativeEvent: { position: number } },
    boundLevel?: RecapZoomLevel,
  ) => {
    if (boundLevel !== undefined && boundLevel !== zoomLevelRef.current) {
      return;
    }
    const pos = e.nativeEvent.position;
    if (
      source === "grid" &&
      (pinchActiveRef.current || Date.now() < pinchCooldownUntilRef.current)
    ) {
      if (pos !== lastSyncedPage.current) {
        gridPagerRef.current?.setPageWithoutAnimation(lastSyncedPage.current);
      }
      return;
    }
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
    syncPagers(pos, source, false);
  };

  const goToYearHalf = useCallback(
    (targetYear: number, targetHalf: WeekHalf) => {
      const targetPage = yearHalfToPage(targetYear, targetHalf, minYear, 1, 0);
      syncPagers(targetPage);
    },
    [minYear],
  );

  const goToYearQuarter = useCallback(
    (targetYear: number, targetQuarter: WeekQuarter) => {
      const targetPage = yearQuarterToPage(
        targetYear,
        targetQuarter,
        minYear,
        1,
        0,
      );
      syncPagers(targetPage);
    },
    [minYear],
  );

  const stepYearInCurrentZoom = (delta: -1 | 1) => {
    const targetYear =
      getYearFromZoomPage(
        zoomLevelRef.current,
        lastSyncedPage.current,
        minYear,
      ) + delta;
    const targetPage = replaceYearInZoomPage(
      zoomLevelRef.current,
      lastSyncedPage.current,
      targetYear,
      minYear,
    );
    syncPagers(targetPage, "year");
    safeSetPage("year", lastYearPage.current);
  };

  const handleWeekPress = useCallback((cell: WeekGridCell) => {
    anchorWeekRef.current = { weekYear: cell.weekYear, week: cell.week };
    setSelectedWeekKey(cell.weekKey);
    setModalVisible(true);
  }, []);

  const pointerEventsFor = (key: PagerKey) =>
    activeSource === null || activeSource === key ? "auto" : "none";

  const transitionActive = zoomTransition !== null;
  const canReuseGridAsOutgoing =
    zoomTransition !== null && zoomTransition.outgoing.level === pagerZoomLevel;
  const hideGridPager = transitionActive && !canReuseGridAsOutgoing;
  const gridWindowRadius =
    transitionActive || zoomHydrationStage === 0
      ? 0
      : zoomHydrationStage === 1
        ? 1
        : 2;
  const gridExtraOffsets =
    transitionActive || zoomHydrationStage < 2
      ? undefined
      : pagerZoomLevel === "quarter"
        ? QUARTER_EXTRA_OFFSETS
        : pagerZoomLevel === "month"
          ? MONTH_EXTRA_OFFSETS
          : undefined;
  const transitionLayers = zoomTransition
    ? [
        ...(!canReuseGridAsOutgoing && !zoomAnimSettled
          ? [
              {
                key: `zoom-${zoomTransition.outgoing.level}-${zoomTransition.outgoing.page}`,
                role: "outgoing" as const,
                level: zoomTransition.outgoing.level,
                page: zoomTransition.outgoing.page,
              },
            ]
          : []),
        {
          key: `zoom-${zoomTransition.incoming.level}-${zoomTransition.incoming.page}`,
          role: "incoming" as const,
          level: zoomTransition.incoming.level,
          page: zoomTransition.incoming.page,
        },
      ]
    : [];

  const renderYearPager = (
    width = YEAR_HALF_QUARTER_WIDTH,
    height = 50,
    fontSize = 29,
    staticOnly = false,
  ) => {
    if (staticOnly) {
      return (
        <View style={[styles.yearPage, { width, height }]}>
          <Text
            numberOfLines={1}
            style={[
              styles.yearText,
              { color: colors.text, fontFamily: displayFont, fontSize },
            ]}
          >
            {year}
          </Text>
        </View>
      );
    }

    return (
      <View
        pointerEvents={pointerEventsFor("year")}
        onTouchStart={() => tryLock("year")}
        onTouchEnd={() => releaseIfNotDragging("year")}
        onTouchCancel={() => releaseIfNotDragging("year")}
        style={{ width, height }}
      >
        <SmoothHorizontalPager
          ref={yearPagerRef}
          pageCount={YEAR_PAGE_COUNT}
          initialPage={yearPageIndex}
          pageWidth={width}
          windowRadius={YEAR_RANGE}
          style={{ width, height }}
          onPageSelected={onYearPageSelected}
          onPageScroll={(e) => handlePageScroll("year", e)}
          onPageScrollStateChanged={(e) =>
            handleScrollStateChanged("year", e.nativeEvent.pageScrollState)
          }
          renderPage={(p) => {
            const py = baseYear + (p - YEAR_CENTER_PAGE);
            return (
              <View style={[styles.yearPage, { flex: 1 }]}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.yearText,
                    { color: colors.text, fontFamily: displayFont, fontSize },
                  ]}
                >
                  {py}
                </Text>
              </View>
            );
          }}
        />
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: containerTopPadding,
          paddingBottom: containerBottomPadding,
        },
      ]}
    >
      <View
        pointerEvents="none"
        collapsable={false}
        style={styles.measureOverlay}
      >
        {MONTH_INDICES.map((m) => (
          <View
            key={`td-m-${monthMeasureKey}-${m}`}
            style={[styles.monthHeaderPage, { width: MEASURE_CONTAINER_WIDTH }]}
          >
            <Text
              numberOfLines={1}
              onLayout={(e) =>
                monthHeader.onMeasure(m, e.nativeEvent.layout.width)
              }
              style={[
                styles.monthHeaderText,
                {
                  color: colors.text,
                  fontFamily: boldFont,
                  fontSize: MONTH_HEADER_BASE_FONT_SIZE,
                },
              ]}
            >
              <Text style={{ fontSize: 14 }}> </Text>
              {DISCUSS_MONTH_NAMES[m]}
              <Text style={{ fontSize: 14 }}> </Text>
            </Text>
          </View>
        ))}
      </View>

      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={[styles.title, { color: colors.text, fontFamily: boldFont }]}
      >
        weekly recaps
      </Text>

      <Text
        style={[
          styles.subtitle,
          { color: colors.textSecondary, fontFamily: regularFont },
        ]}
      >
        {WEEKLY_RECAPS_DESCRIPTION}
      </Text>

      <View style={styles.headerSlot}>
        <Animated.View
          style={{
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
            opacity: headerOpacityAnim,
            transform: [{ scale: headerScaleAnim }],
          }}
        >
        {zoomLevel === "month" ? (
          <View style={styles.monthHeaderStacked}>
            <View style={styles.monthYearRow}>
              <Pressable
                onPress={() => stepYearInCurrentZoom(-1)}
                hitSlop={12}
              >
                <Ionicons
                  name="chevron-back"
                  size={14}
                  color={colors.textSecondary}
                  style={styles.hint}
                />
              </Pressable>

              {renderYearPager(
                YEAR_MONTH_WIDTH,
                36,
                25,
                pagerZoomLevel !== "month",
              )}

              <Pressable onPress={() => stepYearInCurrentZoom(1)} hitSlop={12}>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={colors.textSecondary}
                  style={styles.hint}
                />
              </Pressable>
            </View>

            <View style={styles.monthNameRow}>
              <Pressable
                onPress={() => syncPagers(lastSyncedPage.current - 1)}
                hitSlop={16}
              >
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
                    height: 46,
                    overflow: "hidden",
                  }}
                >
                  <Animated.View
                    style={{
                      width: MONTH_HEADER_FIXED_WIDTH,
                      height: 46,
                      marginLeft: monthHeader.pagerMarginLeft,
                    }}
                  >
                    {pagerZoomLevel === "month" ? (
                      <SmoothHorizontalPager
                        key={`mh-${monthEnterSeq}`}
                        ref={monthHeaderPagerRef}
                        pageCount={MONTH_PAGE_COUNT}
                        initialPage={monthHeaderInitialPage}
                        pageWidth={MONTH_HEADER_FIXED_WIDTH}
                        windowRadius={12}
                        style={{ width: MONTH_HEADER_FIXED_WIDTH, height: 46 }}
                        onPageSelected={(e) =>
                          onHorizontalPageSelected("month", e, "month")
                        }
                        onPageScroll={(e) =>
                          handlePageScroll("month", e, "month")
                        }
                        onPageScrollStateChanged={(e) =>
                          handleScrollStateChanged(
                            "month",
                            e.nativeEvent.pageScrollState,
                            "month",
                          )
                        }
                        renderPage={(p) => {
                          const { month: pm } = pageToYearMonthIndex(
                            p,
                            minYear,
                            0,
                            0,
                          );
                          return (
                            <View style={[styles.monthHeaderPage, { flex: 1 }]}>
                              <Text
                                numberOfLines={1}
                                style={[
                                  styles.monthHeaderText,
                                  {
                                    color: colors.text,
                                    fontFamily: boldFont,
                                    fontSize: monthHeaderFontSize,
                                    maxWidth: MONTH_HEADER_FIXED_WIDTH,
                                  },
                                ]}
                              >
                                <Text style={{ fontSize: 14 }}> </Text>
                                {DISCUSS_MONTH_NAMES[pm]}
                                <Text style={{ fontSize: 14 }}> </Text>
                              </Text>
                            </View>
                          );
                        }}
                      />
                    ) : (
                      <View
                        style={[
                          styles.monthHeaderPage,
                          { width: MONTH_HEADER_FIXED_WIDTH, height: 46 },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.monthHeaderText,
                            {
                              color: colors.text,
                              fontFamily: boldFont,
                              fontSize: monthHeaderFontSize,
                              maxWidth: MONTH_HEADER_FIXED_WIDTH,
                            },
                          ]}
                        >
                          <Text style={{ fontSize: 14 }}> </Text>
                          {DISCUSS_MONTH_NAMES[activeMonth]}
                          <Text style={{ fontSize: 14 }}> </Text>
                        </Text>
                      </View>
                    )}
                  </Animated.View>
                </Animated.View>
              </View>

              <Pressable
                onPress={() => syncPagers(lastSyncedPage.current + 1)}
                hitSlop={16}
              >
                <Ionicons
                  name="chevron-forward"
                  size={15}
                  color={colors.textSecondary}
                  style={styles.hint}
                />
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => syncPagers(lastSyncedPage.current - 1)}
              hitSlop={14}
            >
              <Ionicons
                name="chevron-back"
                size={16}
                color={colors.textSecondary}
                style={styles.hint}
              />
            </Pressable>

            {zoomLevel === "half" && (
              <Pressable
                onPress={() => goToYearHalf(year, 1)}
                hitSlop={10}
                style={styles.halfSwitchWrap}
              >
                <Animated.Text
                  style={[
                    styles.halfText,
                    {
                      color:
                        activeHalf === 1 ? colors.text : colors.textSecondary,
                      fontFamily: activeHalf === 1 ? boldFont : regularFont,
                      opacity: halfAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0.55],
                      }),
                      transform: [
                        {
                          scale: halfAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1.05, 0.94],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  h1
                </Animated.Text>
              </Pressable>
            )}

            {zoomLevel === "quarter" &&
              QUARTER_NUMS.slice(0, 2).map((q, idx) => {
                const isSelected = activeQuarter === q;
                const animVal = quarterAnims[idx];
                return (
                  <Pressable
                    key={q}
                    onPress={() => goToYearQuarter(year, q)}
                    hitSlop={8}
                    style={styles.quarterSwitchWrap}
                  >
                    <Animated.Text
                      style={[
                        styles.quarterText,
                        {
                          color: isSelected
                            ? colors.text
                            : colors.textSecondary,
                          fontFamily: isSelected ? boldFont : regularFont,
                          opacity: animVal.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.55, 1],
                          }),
                          transform: [
                            {
                              scale: animVal.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.92, 1.06],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      {`q${q}`}
                    </Animated.Text>
                  </Pressable>
                );
              })}

            {renderYearPager(
              YEAR_HALF_QUARTER_WIDTH,
              50,
              29,
              pagerZoomLevel === "month",
            )}

            {zoomLevel === "half" && (
              <Pressable
                onPress={() => goToYearHalf(year, 2)}
                hitSlop={10}
                style={styles.halfSwitchWrap}
              >
                <Animated.Text
                  style={[
                    styles.halfText,
                    {
                      color:
                        activeHalf === 2 ? colors.text : colors.textSecondary,
                      fontFamily: activeHalf === 2 ? boldFont : regularFont,
                      opacity: halfAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.55, 1],
                      }),
                      transform: [
                        {
                          scale: halfAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.94, 1.05],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  h2
                </Animated.Text>
              </Pressable>
            )}

            {zoomLevel === "quarter" &&
              QUARTER_NUMS.slice(2).map((q, sliceIdx) => {
                const idx = sliceIdx + 2;
                const isSelected = activeQuarter === q;
                const animVal = quarterAnims[idx];
                return (
                  <Pressable
                    key={q}
                    onPress={() => goToYearQuarter(year, q)}
                    hitSlop={8}
                    style={styles.quarterSwitchWrap}
                  >
                    <Animated.Text
                      style={[
                        styles.quarterText,
                        {
                          color: isSelected
                            ? colors.text
                            : colors.textSecondary,
                          fontFamily: isSelected ? boldFont : regularFont,
                          opacity: animVal.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.55, 1],
                          }),
                          transform: [
                            {
                              scale: animVal.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.92, 1.06],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      {`q${q}`}
                    </Animated.Text>
                  </Pressable>
                );
              })}

            <Pressable
              onPress={() => syncPagers(lastSyncedPage.current + 1)}
              hitSlop={14}
            >
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textSecondary}
                style={styles.hint}
              />
            </Pressable>
          </View>
        )}
        </Animated.View>
      </View>

      <View style={styles.zoomPillRow}>
        {ZOOM_LEVELS.map((lvl) => {
          const isSelected = zoomLevel === lvl;
          return (
            <Pressable
              key={lvl}
              onPress={() => changeZoomLevel(lvl)}
              hitSlop={8}
              style={[
                styles.zoomPill,
                {
                  borderColor: isSelected ? colors.text : colors.textSecondary,
                  backgroundColor: isSelected
                    ? colors.backgroundElement
                    : "transparent",
                  opacity: isSelected ? 1 : 0.6,
                },
              ]}
            >
              <Text
                style={[
                  styles.zoomPillText,
                  {
                    color: isSelected ? colors.text : colors.textSecondary,
                    fontFamily: isSelected ? boldFont : regularFont,
                  },
                ]}
              >
                {lvl}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        {...pinchPan.panHandlers}
        onTouchStartCapture={handlePinchTouchCapture}
        onTouchMoveCapture={handlePinchTouchCapture}
        onTouchEndCapture={handlePinchTouchReleaseCapture}
        onTouchCancelCapture={handlePinchTouchReleaseCapture}
        onTouchEnd={(evt) => {
          prevTouchCountRef.current = evt.nativeEvent.touches.length;
          if (
            evt.nativeEvent.touches.length < 2 &&
            (pinchActiveRef.current ||
              pinchTriggeredRef.current ||
              pinchStageRef.current > 0)
          ) {
            resetPinchState(true);
          }
        }}
        onTouchCancel={() => {
          prevTouchCountRef.current = 0;
          if (
            pinchActiveRef.current ||
            pinchTriggeredRef.current ||
            pinchStageRef.current > 0
          ) {
            resetPinchState(true);
          }
        }}
        style={[
          styles.zoomClipViewport,
          {
            width: screenWidth,
            height: gridBoxHeight + 12,
            marginTop: 4,
          },
        ]}
      >
        <View style={{ width: GRID_WIDTH, height: gridBoxHeight }}>
          <Animated.View
            key={pagerZoomLevel}
            pointerEvents={
              !transitionActive || zoomAnimSettled
                ? pointerEventsFor("grid")
                : "none"
            }
            onTouchStart={() => tryLock("grid")}
            onTouchEnd={() => releaseIfNotDragging("grid")}
            onTouchCancel={() => releaseIfNotDragging("grid")}
            onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
            style={{
              width: GRID_WIDTH,
              height: gridBoxHeight,
              opacity: canReuseGridAsOutgoing ? outgoingOpacityAnim : 1,
              transform: [
                {
                  scale: canReuseGridAsOutgoing
                    ? allGridScale
                    : combinedGridScale,
                },
              ],
            }}
          >
            <SmoothHorizontalPager
              ref={gridPagerRef}
              pageCount={getPageCountForZoom(pagerZoomLevel)}
              initialPage={initialGridPage}
              pageWidth={GRID_WIDTH}
              windowRadius={gridWindowRadius}
              extraOffsets={gridExtraOffsets}
              scrollEnabled={!isPinching}
              style={[
                { height: gridBoxHeight, width: GRID_WIDTH },
                hideGridPager && { opacity: 0 },
              ]}
              onPageSelected={(e) =>
                onHorizontalPageSelected("grid", e, pagerZoomLevel)
              }
              onPageScroll={(e) => handlePageScroll("grid", e, pagerZoomLevel)}
              onPageScrollStateChanged={(e) =>
                handleScrollStateChanged(
                  "grid",
                  e.nativeEvent.pageScrollState,
                  pagerZoomLevel,
                )
              }
              renderPage={(p) => (
                <View style={[styles.grid, { width: GRID_WIDTH }]}>
                  <WeekGridPage
                    zoomLevel={pagerZoomLevel}
                    pageIndex={p}
                    minYear={minYear}
                    loggedWeekKeys={loggedWeekKeys}
                    weekTopicSummaries={weekTopicSummaries}
                    currentWeekKey={currentWeekKey}
                    gridWidth={gridWidth}
                    gridBoxHeight={gridBoxHeight}
                    halfRowHeight={halfRowHeight}
                    colors={colors}
                    boldFont={boldFont}
                    regularFont={regularFont}
                    italicFont={italicFont}
                    onWeekPress={handleWeekPress}
                  />
                </View>
              )}
            />
          </Animated.View>

          {transitionLayers.map((layer) => {
            const isIncoming = layer.role === "incoming";
            return (
              <Animated.View
                key={layer.key}
                pointerEvents="none"
                style={[
                  styles.grid,
                  {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: GRID_WIDTH,
                    height: gridBoxHeight,
                    backgroundColor:
                      isIncoming && zoomAnimSettled
                        ? colors.background
                        : "transparent",
                    opacity: isIncoming
                      ? incomingOpacityAnim
                      : outgoingOpacityAnim,
                    transform: [
                      {
                        scale: isIncoming
                          ? zoomAnimSettled
                            ? pinchScaleAnim
                            : incomingScaleAnim
                          : outgoingScaleAnim,
                      },
                    ],
                  },
                ]}
              >
                <WeekGridPage
                  zoomLevel={layer.level}
                  pageIndex={layer.page}
                  minYear={minYear}
                  loggedWeekKeys={loggedWeekKeys}
                  weekTopicSummaries={weekTopicSummaries}
                  currentWeekKey={currentWeekKey}
                  gridWidth={gridWidth}
                  gridBoxHeight={gridBoxHeight}
                  halfRowHeight={halfRowHeight}
                  colors={colors}
                  boldFont={boldFont}
                  regularFont={regularFont}
                  italicFont={italicFont}
                  onWeekPress={handleWeekPress}
                  staticOverlay
                />
              </Animated.View>
            );
          })}
        </View>
      </View>

      <WeekDiscussModal
        visible={modalVisible}
        weekKey={selectedWeekKey}
        currentWeekKey={currentWeekKey}
        onClose={() => setModalVisible(false)}
        onSaved={() => void refreshAllLoggedWeeks()}
      />
    </View>
  );
}

export default memo(ToDiscuss);
