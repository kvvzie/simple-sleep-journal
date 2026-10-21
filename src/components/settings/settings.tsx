import { useAppearance } from "@/contexts/appearance-context";
import {
  ColorSchemePref,
  GRID_STEPS,
  useSettings,
} from "@/contexts/settings-context";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";
import {
  getAllBodyCareLogs,
  getAllEdits,
  getAllLogs,
  importBackup,
  importLogs,
} from "@/lib/db";
import { saveFileToDevice } from "@/lib/file-saver";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { EncodingType, readAsStringAsync } from "expo-file-system/legacy";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import { memo, useEffect, useRef, useState } from "react";
import {
  Animated,
  DeviceEventEmitter,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import ConfirmDialog from "../confirm-dialog";
import WheelPicker, { WheelPickerHandle } from "../wheel-picker";
import { styles } from "./settings.styles";

const MAX_STEP = GRID_STEPS.length - 1;
const SWITCH_PADDING = 4;
const SWITCH_BORDER = 1.5;

const columnsPageForStep = (idx: number) => MAX_STEP - idx;
const columnsStepForPage = (page: number) => MAX_STEP - page;

const MOOD_SCALE_MAX = 10;

const COLOR_PRESETS = [
  {
    name: "vanilla",
    palette: {},
  },
  {
    name: "cyberpunk",
    palette: {
      dark: {
        background: "#090A0F",
        text: "#00FFCC",
        backgroundElement: "#141724",
        backgroundSelected: "#1F2538",
        textSecondary: "#5D707F",
      },
    },
  },
  {
    name: "mocha",
    palette: {
      dark: {
        background: "#1C1714",
        text: "#F5E2CF",
        backgroundElement: "#2A211D",
        backgroundSelected: "#3D302A",
        textSecondary: "#A38C7D",
      },
    },
  },
  {
    name: "matcha",
    palette: {
      dark: {
        background: "#101813",
        text: "#CBE8D0",
        backgroundElement: "#1A261F",
        backgroundSelected: "#273A2E",
        textSecondary: "#6E8B75",
      },
    },
  },
  {
    name: "twilight",
    palette: {
      dark: {
        background: "#18121E",
        text: "#F1D2FF",
        backgroundElement: "#271E30",
        backgroundSelected: "#3C2C4B",
        textSecondary: "#977CA8",
      },
    },
  },
];

function Settings() {
  const scheme = useAppColorScheme();
  const {
    mode,
    canExportTheme,
    canImportTheme,
    colors,
    theme,
    features,
    backgrounds,
    customFont,
    resolveFont,
    updateTheme,
    updateFeatures,
    updateBackground,
    setCustomFont,
    resetTheme,
    exportTheme,
    importThemeFromFile,
  } = useAppearance();

  const {
    stepIndex,
    setStepIndex,
    colorSchemePref,
    setColorSchemePref,
    loaded,
    rows,
    columns,
  } = useSettings();

  const rowsRef = useRef<WheelPickerHandle>(null);
  const columnsRef = useRef<WheelPickerHandle>(null);
  const gridLockRef = useRef<string | null>(null);

  const [exportDialogVisible, setExportDialogVisible] = useState(false);
  const [exportType, setExportType] = useState<"json" | "txt" | "csv" | null>(
    null,
  );
  const [fileName, setFileName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [infoDialog, setInfoDialog] = useState({ visible: false, message: "" });

  const [themeExportDialogVisible, setThemeExportDialogVisible] = useState(false);
  const [themeExportName, setThemeExportName] = useState("");
  const [resetThemeConfirmVisible, setResetThemeConfirmVisible] = useState(false);

  const showInfo = (message: string) => {
    setInfoDialog({ visible: true, message });
  };

  const canIncreaseRows = stepIndex < MAX_STEP;
  const canDecreaseRows = stepIndex > 0;
  const canIncreaseColumns = stepIndex > 0;
  const canDecreaseColumns = stepIndex < MAX_STEP;

  useEffect(() => {
    if (loaded) {
      rowsRef.current?.syncTo(stepIndex);
      columnsRef.current?.syncTo(columnsPageForStep(stepIndex));
    }
  }, [stepIndex, loaded]);

  const [trackSize, setTrackSize] = useState({ width: 220, height: 52 });
  const innerWidth = trackSize.width - SWITCH_BORDER * 2;
  const innerHeight = trackSize.height - SWITCH_BORDER * 2;
  const slotWidth = (innerWidth - SWITCH_PADDING * 2) / 3;
  const indicatorHeight = innerHeight - SWITCH_PADDING * 2;

  const onRowsSelected = (idx: number) => {
    setStepIndex(idx);
    columnsRef.current?.syncTo(columnsPageForStep(idx));
  };

  const onColumnsSelected = (page: number) => {
    const idx = columnsStepForPage(page);
    setStepIndex(idx);
    rowsRef.current?.syncTo(idx);
  };

  const handlePickFont = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const asset = res.assets[0];
      const fontName = asset.name ? asset.name.replace(/\.[^/.]+$/, "") : "CustomFont";

      const ok = await setCustomFont({
        name: fontName,
        dataUriOrPath: asset.uri,
      });

      if (ok) {
        showInfo(`Font "${fontName}" applied successfully!`);
      } else {
        showInfo("Could not load font file.");
      }
    } catch {
      showInfo("Failed to pick font.");
    }
  };

  const handleResetFont = async () => {
    await setCustomFont(null);
    showInfo("Font reset to default Redaction.");
  };

  const handlePickBackground = async (screen: "calendar" | "settings") => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "image/png", "image/jpeg", "image/webp"],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const asset = res.assets[0];

      const base64 = await readAsStringAsync(asset.uri, {
        encoding: EncodingType.Base64,
      });
      const mime = asset.mimeType || "image/jpeg";
      const dataUri = `data:${mime};base64,${base64}`;

      updateBackground(screen, dataUri);
      showInfo(`${screen} background updated!`);
    } catch {
      showInfo("Failed to load image file.");
    }
  };

  const handleClearBackground = (screen: "calendar" | "settings") => {
    updateBackground(screen, null);
    showInfo(`${screen} background removed.`);
  };

  const handleExportThemePress = () => {
    setThemeExportName(theme.name || "My Theme");
    setThemeExportDialogVisible(true);
  };

  const handleExportThemeConfirm = async () => {
    setThemeExportDialogVisible(false);
    const res = await exportTheme(themeExportName);
    if (res.success) {
      showInfo("App look exported successfully (.moodtheme)!");
    } else if (!res.canceled) {
      showInfo(res.error || "Failed to export theme.");
    }
  };

  const handleImportThemePress = async () => {
    const res = await importThemeFromFile();
    if (res.success) {
      showInfo("App look successfully imported!");
      DeviceEventEmitter.emit("refreshCalendarGrid");
    } else if (!res.canceled) {
      showInfo(res.error || "Failed to import theme file.");
    }
  };

  const handleResetThemeConfirm = async () => {
    setResetThemeConfirmVisible(false);
    await resetTheme();
    showInfo(
      mode === "baked"
        ? "Appearance reset to baked defaults!"
        : "Appearance reset to vanilla defaults!",
    );
    DeviceEventEmitter.emit("refreshCalendarGrid");
  };

  const getTargetX = (p: ColorSchemePref) => {
    switch (p) {
      case "light":
        return SWITCH_PADDING;
      case "automatic":
        return SWITCH_PADDING + slotWidth;
      case "dark":
        return SWITCH_PADDING + slotWidth * 2;
    }
  };

  const indicatorX = useRef(
    new Animated.Value(getTargetX(colorSchemePref)),
  ).current;

  useEffect(() => {
    Animated.spring(indicatorX, {
      toValue: getTargetX(colorSchemePref),
      useNativeDriver: true,
      damping: 22,
      stiffness: 260,
    }).start();
  }, [colorSchemePref, slotWidth]);

  const setPrefAnimated = (next: ColorSchemePref) => {
    setColorSchemePref(next);
  };

  const swipePan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderRelease: (_, g) => {
      const order: ColorSchemePref[] = ["light", "automatic", "dark"];
      const currentIdx = order.indexOf(colorSchemePref);
      if (g.dx > 20 && currentIdx < 2) setPrefAnimated(order[currentIdx + 1]);
      else if (g.dx < -20 && currentIdx > 0)
        setPrefAnimated(order[currentIdx - 1]);
    },
  });

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    if (!y || !m || !d) return dateStr;
    return `${d}.${m}.${y}`;
  };

  const openExportSetup = (type: "json" | "txt" | "csv") => {
    setExportType(type);
    const today = new Date().toISOString().split("T")[0];
    const defaultName = `sleepinapp_${type}_${today}`;
    setFileName(defaultName);
    setStartDate("");
    setEndDate("");
  };

  const handleExportConfirm = async () => {
    if (!exportType) return;
    setExportDialogVisible(false);

    try {
      const logs = await getAllLogs();
      const bodyCareLogs = features.bodyCareEnabled
        ? await getAllBodyCareLogs()
        : [];
      const bodyCareByDate = new Map<string, (typeof bodyCareLogs)[0]>();
      bodyCareLogs.forEach((b) => bodyCareByDate.set(b.date, b));

      let fileContent = "";
      let mimeType = "application/json";
      let fileExtension = ".json";

      const sanitizedName =
        fileName.trim() || `sleepinapp_export_${new Date().toISOString().split("T")[0]}`;

      if (exportType === "json") {
        const allEdits = await getAllEdits();
        const exportPayload = {
          export_date: new Date().toISOString(),
          version: "1.1.2",
          logs,
          edits: allEdits,
          bodyCareLogs: features.bodyCareEnabled ? bodyCareLogs : [],
        };
        fileContent = JSON.stringify(exportPayload, null, 2);
        mimeType = "application/json";
        fileExtension = ".json";
      } else if (exportType === "txt") {
        const filteredLogs = logs.filter((log) => {
          if (startDate && log.date < startDate) return false;
          if (endDate && log.date > endDate) return false;
          return true;
        });

        const allEdits = await getAllEdits();
        const editsByDate = new Map<string, typeof allEdits>();
        for (const e of allEdits) {
          if (!editsByDate.has(e.log_date)) editsByDate.set(e.log_date, []);
          editsByDate.get(e.log_date)!.push(e);
        }

        fileContent = `SLEEP / MOOD LOG REPORT (${startDate || "All Time"} to ${endDate || "All Time"})\n\n`;
        filteredLogs.forEach((log) => {
          const bodyCare = bodyCareByDate.get(log.date);
          fileContent += `Date: ${log.date}\n`;
          fileContent += `Hours Slept: ${log.hours}\n`;
          if (features.moodStarsEnabled) {
            fileContent += `Mood Rating: ${log.mood}/${MOOD_SCALE_MAX}\n`;
          }
          if (features.bodyCareEnabled) {
            fileContent += `Self Harm: ${bodyCare ? "yes" : "no"}\n`;
          }
          if (features.commentsEnabled && log.comment) {
            fileContent += `Notes: ${log.comment}\n`;
          }
          if (log.logged_at) fileContent += `Logged: ${log.logged_at}\n`;
          if (log.updated_at) {
            fileContent += `Last Edited: ${log.updated_at}\n`;
            const dateEdits = editsByDate.get(log.date) ?? [];
            dateEdits.forEach((e) => {
              const parts: string[] = [];
              if (e.changed_hours)
                parts.push(`hours ${e.prev_hours} → ${e.new_hours}`);
              if (features.moodStarsEnabled && e.changed_mood)
                parts.push(`mood ${e.prev_mood} → ${e.new_mood}`);
              if (features.commentsEnabled && e.changed_comment)
                parts.push("comment");
              fileContent += `  #${e.edit_index} ${e.edited_at} changed ${parts.join(", ")}\n`;
            });
          }
          fileContent += `---------------------------\n`;
        });

        mimeType = "text/plain";
        fileExtension = ".txt";
      } else if (exportType === "csv") {
        const filteredLogs = logs.filter((log) => {
          if (startDate && log.date < startDate) return false;
          if (endDate && log.date > endDate) return false;
          return true;
        });
        const allEdits = await getAllEdits();
        const filteredEdits = allEdits.filter((e) => {
          if (startDate && e.log_date < startDate) return false;
          if (endDate && e.log_date > endDate) return false;
          return true;
        });

        const filteredBodyCareLogs = bodyCareLogs.filter((bodyCare) => {
          if (startDate && bodyCare.date < startDate) return false;
          if (endDate && bodyCare.date > endDate) return false;
          return true;
        });

        const header = [
          "record_type",
          "date",
          "hours",
          "mood",
          "comment",
          "logged_at",
          "updated_at",
          "edit_index",
          "edited_at",
          "prev_hours",
          "new_hours",
          "prev_mood",
          "new_mood",
          "prev_comment",
          "new_comment",
          "changed_hours",
          "changed_mood",
          "changed_comment",
          "self_harm_product_id",
          "self_harm_top_left",
          "self_harm_top_right",
          "self_harm_bottom_left",
          "self_harm_bottom_right",
          "self_harm_updated_at",
        ];

        const rowsData: string[][] = [header];

        filteredLogs.forEach((log) => {
          rowsData.push([
            "log",
            log.date,
            String(log.hours),
            features.moodStarsEnabled ? String(log.mood) : "",
            features.commentsEnabled ? (log.comment ?? "") : "",
            log.logged_at ?? "",
            log.updated_at ?? "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            ...Array(6).fill(""),
          ]);
        });

        filteredEdits.forEach((edit) => {
          rowsData.push([
            "edit",
            edit.log_date,
            "",
            "",
            "",
            "",
            "",
            String(edit.edit_index),
            edit.edited_at,
            edit.prev_hours?.toString() ?? "",
            edit.new_hours?.toString() ?? "",
            edit.prev_mood?.toString() ?? "",
            edit.new_mood?.toString() ?? "",
            edit.prev_comment ?? "",
            edit.new_comment ?? "",
            String(edit.changed_hours),
            String(edit.changed_mood),
            String(edit.changed_comment),
            ...Array(6).fill(""),
          ]);
        });

        if (features.bodyCareEnabled) {
          filteredBodyCareLogs.forEach((bodyCare) => {
            rowsData.push([
              "self_harm",
              bodyCare.date,
              ...Array(16).fill(""),
              bodyCare.product_id,
              bodyCare.amounts["top-left"] ?? "",
              bodyCare.amounts["top-right"] ?? "",
              bodyCare.amounts["bottom-left"] ?? "",
              bodyCare.amounts["bottom-right"] ?? "",
              bodyCare.updated_at ?? "",
            ]);
          });
        }

        const csvEscape = (s: string) => `"${s.replace(/"/g, '""')}"`;
        fileContent = rowsData.map((r) => r.map(csvEscape).join(",")).join("\n");
        mimeType = "text/csv";
        fileExtension = ".csv";
      }

      const finalFileName = `${sanitizedName}${fileExtension}`;

      const result = await saveFileToDevice({
        fileName: finalFileName,
        content: fileContent,
        mimeType,
      });

      if (result.success) {
        showInfo(`File saved successfully as ${finalFileName}.`);
      } else if (!result.canceled) {
        showInfo("Failed to export your data file.");
      }

      setExportType(null);
    } catch {
      showInfo("An error occurred during export.");
      setExportType(null);
    }
  };

  const handleImport = async () => {
    try {
      const pickerRes = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (pickerRes.canceled || !pickerRes.assets || pickerRes.assets.length === 0) {
        return;
      }

      const fileUri = pickerRes.assets[0].uri;
      const response = await fetch(fileUri);
      const content = await response.text();
      const parsed = JSON.parse(content);

      if (Array.isArray(parsed)) {
        await importLogs(parsed);
      } else if (parsed && Array.isArray(parsed.logs)) {
        const edits = Array.isArray(parsed.edits) ? parsed.edits : [];
        const importedBodyCareLogs = Array.isArray(parsed.bodyCareLogs)
          ? parsed.bodyCareLogs
          : [];
        await importBackup(parsed.logs, edits, importedBodyCareLogs);
      } else {
        throw new Error("Invalid format");
      }

      showInfo("Data has been successfully imported!");
      DeviceEventEmitter.emit("refreshCalendarGrid");
    } catch {
      showInfo("Please select a valid sleepinapp backup file (JSON).");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} animated />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[
            styles.title,
            { color: colors.text, fontFamily: resolveFont("bold") },
          ]}
        >
          settings
        </Text>

        {features.gridPickerEnabled ? (
          loaded && (
            <View style={styles.gridRow}>
              <View style={styles.gridColumn}>
                <Text
                  style={[
                    styles.gridLabel,
                    {
                      color: colors.textSecondary,
                      fontFamily: resolveFont("italic"),
                    },
                  ]}
                >
                  rows
                </Text>
                <WheelPicker
                  ref={rowsRef}
                  page={stepIndex}
                  totalPages={GRID_STEPS.length}
                  renderLabel={(p) => String(GRID_STEPS[p].rows)}
                  onSelected={onRowsSelected}
                  canIncrease={canIncreaseRows}
                  canDecrease={canDecreaseRows}
                  arrowColor={colors.textSecondary}
                  arrowSlotStyle={styles.gridArrow}
                  pagerStyle={styles.gridPager}
                  pageStyle={styles.gridPage}
                  labelStyle={[
                    styles.gridValue,
                    { color: colors.text, fontFamily: resolveFont("bold") },
                  ]}
                  lockRef={gridLockRef}
                  lockKey="rows"
                />
              </View>

              <Text
                style={[
                  styles.xSign,
                  { color: colors.text, fontFamily: resolveFont("bold") },
                ]}
              >
                x
              </Text>

              <View style={styles.gridColumn}>
                <Text
                  style={[
                    styles.gridLabel,
                    {
                      color: colors.textSecondary,
                      fontFamily: resolveFont("italic"),
                    },
                  ]}
                >
                  columns
                </Text>
                <WheelPicker
                  ref={columnsRef}
                  page={columnsPageForStep(stepIndex)}
                  totalPages={GRID_STEPS.length}
                  renderLabel={(p) =>
                    String(GRID_STEPS[columnsStepForPage(p)].columns)
                  }
                  onSelected={onColumnsSelected}
                  canIncrease={canIncreaseColumns}
                  canDecrease={canDecreaseColumns}
                  arrowColor={colors.textSecondary}
                  arrowSlotStyle={styles.gridArrow}
                  pagerStyle={styles.gridPager}
                  pageStyle={styles.gridPage}
                  labelStyle={[
                    styles.gridValue,
                    { color: colors.text, fontFamily: resolveFont("bold") },
                  ]}
                  lockRef={gridLockRef}
                  lockKey="columns"
                />
              </View>
            </View>
          )
        ) : (
          <View
            style={[
              styles.gridLockedBadge,
              { backgroundColor: colors.backgroundElement },
            ]}
          >
            <Text
              style={[
                styles.gridLockedText,
                { color: colors.text, fontFamily: resolveFont("bold") },
              ]}
            >
              grid size: {rows} × {columns} (locked)
            </Text>
          </View>
        )}

        <Text
          style={[
            styles.sectionLabel,
            { color: colors.textSecondary, fontFamily: resolveFont("italic") },
          ]}
        >
          color scheme
        </Text>
        <View
          style={[styles.switchTrack, { borderColor: colors.textSecondary }]}
          {...swipePan.panHandlers}
        >
          <Animated.View
            style={[
              styles.switchIndicator,
              {
                backgroundColor: colors.text,
                width: slotWidth,
                height: indicatorHeight,
                top: SWITCH_PADDING,
                transform: [{ translateX: indicatorX }],
              },
            ]}
          />
          <Pressable
            style={styles.switchOption}
            onPress={() => setPrefAnimated("light")}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              if (width && height) {
                setTrackSize({
                  width: width * 3 + SWITCH_BORDER * 2 + SWITCH_PADDING * 2,
                  height: height + SWITCH_BORDER * 2 + SWITCH_PADDING * 2,
                });
              }
            }}
          >
            <Ionicons
              name="sunny-sharp"
              size={18}
              color={
                colorSchemePref === "light"
                  ? colors.background
                  : colors.textSecondary
              }
            />
          </Pressable>
          <Pressable
            style={styles.switchOption}
            onPress={() => setPrefAnimated("automatic")}
          >
            <Ionicons
              name="phone-portrait-sharp"
              size={18}
              color={
                colorSchemePref === "automatic"
                  ? colors.background
                  : colors.textSecondary
              }
            />
          </Pressable>
          <Pressable
            style={styles.switchOption}
            onPress={() => setPrefAnimated("dark")}
          >
            <Ionicons
              name="moon-sharp"
              size={18}
              color={
                colorSchemePref === "dark"
                  ? colors.background
                  : colors.textSecondary
              }
            />
          </Pressable>
        </View>

        {features.inAppCustomizationEnabled && (
          <View
            style={[
              styles.studioCard,
              {
                borderColor: colors.textSecondary,
                backgroundColor: colors.backgroundElement,
              },
            ]}
          >
            <Text
              style={[
                styles.studioSubheading,
                { color: colors.text, fontFamily: resolveFont("bold") },
              ]}
            >
              appearance studio
            </Text>

            <View style={styles.studioItemRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text
                  style={[
                    styles.studioItemLabel,
                    { color: colors.text, fontFamily: resolveFont("regular") },
                  ]}
                >
                  font: {customFont?.name || "Redaction"}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Pressable
                  onPress={handlePickFont}
                  style={[styles.studioSmallBtn, { backgroundColor: colors.text }]}
                >
                  <Text
                    style={[
                      styles.studioSmallBtnText,
                      { color: colors.background, fontFamily: resolveFont("bold") },
                    ]}
                  >
                    pick .ttf
                  </Text>
                </Pressable>
                {customFont && (
                  <Pressable
                    onPress={handleResetFont}
                    style={[
                      styles.studioSmallBtn,
                      { backgroundColor: colors.backgroundSelected },
                    ]}
                  >
                    <Text
                      style={[
                        styles.studioSmallBtnText,
                        { color: colors.text, fontFamily: resolveFont("regular") },
                      ]}
                    >
                      reset
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            <View style={styles.studioItemRow}>
              <Text
                style={[
                  styles.studioItemLabel,
                  { color: colors.text, fontFamily: resolveFont("regular") },
                ]}
              >
                calendar bg: {backgrounds.calendar ? "custom" : "default"}
              </Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Pressable
                  onPress={() => handlePickBackground("calendar")}
                  style={[styles.studioSmallBtn, { backgroundColor: colors.text }]}
                >
                  <Text
                    style={[
                      styles.studioSmallBtnText,
                      { color: colors.background, fontFamily: resolveFont("bold") },
                    ]}
                  >
                    pick
                  </Text>
                </Pressable>
                {backgrounds.calendar && (
                  <Pressable
                    onPress={() => handleClearBackground("calendar")}
                    style={[
                      styles.studioSmallBtn,
                      { backgroundColor: colors.backgroundSelected },
                    ]}
                  >
                    <Text
                      style={[
                        styles.studioSmallBtnText,
                        { color: colors.text, fontFamily: resolveFont("regular") },
                      ]}
                    >
                      clear
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            <View style={styles.studioItemRow}>
              <Text
                style={[
                  styles.studioItemLabel,
                  { color: colors.text, fontFamily: resolveFont("regular") },
                ]}
              >
                settings bg: {backgrounds.settings ? "custom" : "default"}
              </Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Pressable
                  onPress={() => handlePickBackground("settings")}
                  style={[styles.studioSmallBtn, { backgroundColor: colors.text }]}
                >
                  <Text
                    style={[
                      styles.studioSmallBtnText,
                      { color: colors.background, fontFamily: resolveFont("bold") },
                    ]}
                  >
                    pick
                  </Text>
                </Pressable>
                {backgrounds.settings && (
                  <Pressable
                    onPress={() => handleClearBackground("settings")}
                    style={[
                      styles.studioSmallBtn,
                      { backgroundColor: colors.backgroundSelected },
                    ]}
                  >
                    <Text
                      style={[
                        styles.studioSmallBtnText,
                        { color: colors.text, fontFamily: resolveFont("regular") },
                      ]}
                    >
                      clear
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            <Text
              style={[
                styles.studioSubheading,
                { color: colors.textSecondary, fontFamily: resolveFont("italic") },
              ]}
            >
              quick palettes
            </Text>
            <View style={styles.palettePillRow}>
              {COLOR_PRESETS.map((p) => {
                const isActive = theme.name === p.name;
                return (
                  <Pressable
                    key={p.name}
                    onPress={() =>
                      updateTheme({
                        name: p.name,
                        palette: p.palette,
                      })
                    }
                    style={[
                      styles.palettePill,
                      {
                        backgroundColor: isActive
                          ? colors.text
                          : colors.backgroundSelected,
                        borderColor: colors.textSecondary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.palettePillText,
                        {
                          color: isActive ? colors.background : colors.text,
                          fontFamily: resolveFont(isActive ? "bold" : "regular"),
                        },
                      ]}
                    >
                      {p.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text
              style={[
                styles.studioSubheading,
                { color: colors.textSecondary, fontFamily: resolveFont("italic") },
              ]}
            >
              feature toggles
            </Text>

            <Pressable
              onPress={() =>
                updateFeatures({
                  bodyCareEnabled: !features.bodyCareEnabled,
                })
              }
              style={styles.studioItemRow}
            >
              <Text
                style={[
                  styles.studioItemLabel,
                  { color: colors.text, fontFamily: resolveFont("regular") },
                ]}
              >
                razor blade tracker
              </Text>
              <Ionicons
                name={features.bodyCareEnabled ? "checkbox" : "square-outline"}
                size={22}
                color={colors.text}
              />
            </Pressable>

            <Pressable
              onPress={() =>
                updateFeatures({
                  moodStarsEnabled: !features.moodStarsEnabled,
                })
              }
              style={styles.studioItemRow}
            >
              <Text
                style={[
                  styles.studioItemLabel,
                  { color: colors.text, fontFamily: resolveFont("regular") },
                ]}
              >
                mood star ratings
              </Text>
              <Ionicons
                name={features.moodStarsEnabled ? "checkbox" : "square-outline"}
                size={22}
                color={colors.text}
              />
            </Pressable>

            <Pressable
              onPress={() =>
                updateFeatures({
                  commentsEnabled: !features.commentsEnabled,
                })
              }
              style={styles.studioItemRow}
            >
              <Text
                style={[
                  styles.studioItemLabel,
                  { color: colors.text, fontFamily: resolveFont("regular") },
                ]}
              >
                day notes / comments
              </Text>
              <Ionicons
                name={features.commentsEnabled ? "checkbox" : "square-outline"}
                size={22}
                color={colors.text}
              />
            </Pressable>

            <Pressable
              onPress={() =>
                updateFeatures({
                  gridPickerEnabled: !features.gridPickerEnabled,
                })
              }
              style={styles.studioItemRow}
            >
              <Text
                style={[
                  styles.studioItemLabel,
                  { color: colors.text, fontFamily: resolveFont("regular") },
                ]}
              >
                flexible grid picker
              </Text>
              <Ionicons
                name={features.gridPickerEnabled ? "checkbox" : "square-outline"}
                size={22}
                color={colors.text}
              />
            </Pressable>
          </View>
        )}

        <Text
          style={[
            styles.madeByLabel,
            { color: colors.textSecondary, fontFamily: resolveFont("italic") },
          ]}
        >
          app made by
        </Text>
        <Pressable onPress={() => Linking.openURL("https://kvvz.xyz")}>
          <Text
            style={[
              styles.madeByName,
              { color: colors.text, fontFamily: resolveFont("regular") },
            ]}
          >
            kvvzie
          </Text>
        </Pressable>

        <Text
          style={[
            styles.dataLabel,
            { color: colors.textSecondary, fontFamily: resolveFont("italic") },
          ]}
        >
          data & appearance management
        </Text>

        <View style={styles.actionRow}>
          <Pressable
            onPressIn={() => {
              setExportType(null);
              setExportDialogVisible(true);
            }}
            style={[styles.actionButton, { backgroundColor: colors.text }]}
          >
            <Text
              style={[
                styles.actionButtonText,
                { color: colors.background, fontFamily: resolveFont("bold") },
              ]}
            >
              export data
            </Text>
          </Pressable>

          <Pressable
            onPressIn={handleImport}
            style={[styles.actionButton, { backgroundColor: colors.text }]}
          >
            <Text
              style={[
                styles.actionButtonText,
                { color: colors.background, fontFamily: resolveFont("bold") },
              ]}
            >
              import data
            </Text>
          </Pressable>
        </View>

        <View style={styles.actionRow}>
          {canExportTheme && (
            <Pressable
              onPressIn={handleExportThemePress}
              style={[styles.actionButton, { backgroundColor: colors.text }]}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  { color: colors.background, fontFamily: resolveFont("bold") },
                ]}
              >
                export look
              </Text>
            </Pressable>
          )}

          {canImportTheme && (
            <Pressable
              onPressIn={handleImportThemePress}
              style={[styles.actionButton, { backgroundColor: colors.text }]}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  { color: colors.background, fontFamily: resolveFont("bold") },
                ]}
              >
                import look
              </Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.actionRow, { justifyContent: "center" }]}>
          <Pressable
            onPressIn={() => setResetThemeConfirmVisible(true)}
            style={[
              styles.actionButton,
              { backgroundColor: colors.backgroundElement },
            ]}
          >
            <Text
              style={[
                styles.actionButtonText,
                { color: colors.text, fontFamily: resolveFont("bold") },
              ]}
            >
              reset appearance
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={exportDialogVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExportDialogVisible(false)}
      >
        <Pressable
          style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}
          onPress={() => setExportDialogVisible(false)}
        >
          <Pressable
            style={[styles.box, { backgroundColor: colors.modalBackground }]}
            onPress={() => {}}
          >
            {exportType === null ? (
              <>
                <Text
                  style={[
                    styles.message,
                    { color: colors.text, fontFamily: resolveFont("regular") },
                  ]}
                >
                  Choose export format
                </Text>
                <View style={styles.dialogActionsColumn}>
                  <Pressable
                    style={[
                      styles.dialogButton,
                      { backgroundColor: colors.text },
                    ]}
                    onPress={() => openExportSetup("json")}
                  >
                    <Text
                      style={[
                        styles.dialogButtonText,
                        {
                          color: colors.background,
                          fontFamily: resolveFont("bold"),
                        },
                      ]}
                    >
                      Backup for App (JSON)
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.dialogButton,
                      { backgroundColor: colors.text },
                    ]}
                    onPress={() => openExportSetup("csv")}
                  >
                    <Text
                      style={[
                        styles.dialogButtonText,
                        {
                          color: colors.background,
                          fontFamily: resolveFont("bold"),
                        },
                      ]}
                    >
                      Spreadsheet (CSV)
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.dialogButton,
                      { backgroundColor: colors.text },
                    ]}
                    onPress={() => openExportSetup("txt")}
                  >
                    <Text
                      style={[
                        styles.dialogButtonText,
                        {
                          color: colors.background,
                          fontFamily: resolveFont("bold"),
                        },
                      ]}
                    >
                      Text Summary (TXT)
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text
                  style={[
                    styles.message,
                    { color: colors.text, fontFamily: resolveFont("bold") },
                  ]}
                >
                  Export {exportType.toUpperCase()}
                </Text>

                <Text
                  style={[
                    styles.inputLabel,
                    {
                      color: colors.textSecondary,
                      fontFamily: resolveFont("regular"),
                    },
                  ]}
                >
                  File Name:
                </Text>
                <TextInput
                  style={[
                    styles.inputField,
                    {
                      color: colors.text,
                      borderBottomColor: colors.textSecondary,
                      fontFamily: resolveFont("regular"),
                    },
                  ]}
                  value={fileName}
                  onChangeText={setFileName}
                  placeholder="Enter file name"
                  placeholderTextColor={colors.textSecondary}
                />

                {(exportType === "txt" || exportType === "csv") && (
                  <>
                    <Text
                      style={[
                        styles.inputLabel,
                        {
                          color: colors.textSecondary,
                          fontFamily: resolveFont("regular"),
                        },
                      ]}
                    >
                      Start Date (YYYY-MM-DD):
                    </Text>
                    <TextInput
                      style={[
                        styles.inputField,
                        {
                          color: colors.text,
                          borderBottomColor: colors.textSecondary,
                          fontFamily: resolveFont("regular"),
                        },
                      ]}
                      value={startDate}
                      onChangeText={setStartDate}
                      placeholder="e.g. 2026-01-01 (optional)"
                      placeholderTextColor={colors.textSecondary}
                    />

                    <Text
                      style={[
                        styles.inputLabel,
                        {
                          color: colors.textSecondary,
                          fontFamily: resolveFont("regular"),
                        },
                      ]}
                    >
                      End Date (YYYY-MM-DD):
                    </Text>
                    <TextInput
                      style={[
                        styles.inputField,
                        {
                          color: colors.text,
                          borderBottomColor: colors.textSecondary,
                          fontFamily: resolveFont("regular"),
                        },
                      ]}
                      value={endDate}
                      onChangeText={setEndDate}
                      placeholder="e.g. 2026-12-31 (optional)"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </>
                )}

                <View
                  style={[
                    styles.dialogActionsColumn,
                    { marginTop: 16, flexDirection: "row" },
                  ]}
                >
                  <Pressable
                    style={[
                      styles.dialogButton,
                      {
                        backgroundColor: colors.backgroundElement,
                        flex: 1,
                      },
                    ]}
                    onPress={() => setExportType(null)}
                  >
                    <Text
                      style={[
                        styles.dialogButtonText,
                        {
                          color: colors.text,
                          fontFamily: resolveFont("bold"),
                        },
                      ]}
                    >
                      Back
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.dialogButton,
                      { backgroundColor: colors.text, flex: 1 },
                    ]}
                    onPress={handleExportConfirm}
                  >
                    <Text
                      style={[
                        styles.dialogButtonText,
                        {
                          color: colors.background,
                          fontFamily: resolveFont("bold"),
                        },
                      ]}
                    >
                      Save
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={themeExportDialogVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setThemeExportDialogVisible(false)}
      >
        <Pressable
          style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}
          onPress={() => setThemeExportDialogVisible(false)}
        >
          <Pressable
            style={[styles.box, { backgroundColor: colors.modalBackground }]}
            onPress={() => {}}
          >
            <Text
              style={[
                styles.message,
                { color: colors.text, fontFamily: resolveFont("bold") },
              ]}
            >
              Export Look (.moodtheme)
            </Text>
            <Text
              style={[
                styles.inputLabel,
                {
                  color: colors.textSecondary,
                  fontFamily: resolveFont("regular"),
                },
              ]}
            >
              Theme Name:
            </Text>
            <TextInput
              style={[
                styles.inputField,
                {
                  color: colors.text,
                  borderBottomColor: colors.textSecondary,
                  fontFamily: resolveFont("regular"),
                },
              ]}
              value={themeExportName}
              onChangeText={setThemeExportName}
              placeholder="e.g. Cozy Cat"
              placeholderTextColor={colors.textSecondary}
            />

            <View
              style={[
                styles.dialogActionsColumn,
                { marginTop: 16, flexDirection: "row" },
              ]}
            >
              <Pressable
                style={[
                  styles.dialogButton,
                  { backgroundColor: colors.backgroundElement, flex: 1 },
                ]}
                onPress={() => setThemeExportDialogVisible(false)}
              >
                <Text
                  style={[
                    styles.dialogButtonText,
                    { color: colors.text, fontFamily: resolveFont("bold") },
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.dialogButton,
                  { backgroundColor: colors.text, flex: 1 },
                ]}
                onPress={handleExportThemeConfirm}
              >
                <Text
                  style={[
                    styles.dialogButtonText,
                    {
                      color: colors.background,
                      fontFamily: resolveFont("bold"),
                    },
                  ]}
                >
                  Export
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmDialog
        visible={resetThemeConfirmVisible}
        message={
          mode === "baked"
            ? "Reset all appearance settings back to baked build defaults?"
            : "Reset all appearance settings back to vanilla defaults?"
        }
        onConfirm={handleResetThemeConfirm}
        onCancel={() => setResetThemeConfirmVisible(false)}
      />

      <Modal
        visible={infoDialog.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoDialog({ visible: false, message: "" })}
      >
        <Pressable
          style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}
          onPress={() => setInfoDialog({ visible: false, message: "" })}
        >
          <Pressable
            style={[styles.box, { backgroundColor: colors.modalBackground }]}
            onPress={() => {}}
          >
            <Text
              style={[
                styles.message,
                { color: colors.text, fontFamily: resolveFont("regular") },
              ]}
            >
              {infoDialog.message}
            </Text>
            <Pressable
              style={[
                styles.dialogButton,
                { backgroundColor: colors.text, width: "100%" },
              ]}
              onPress={() => setInfoDialog({ visible: false, message: "" })}
            >
              <Text
                style={[
                  styles.dialogButtonText,
                  {
                    color: colors.background,
                    fontFamily: resolveFont("bold"),
                  },
                ]}
              >
                ok
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export default memo(Settings);
