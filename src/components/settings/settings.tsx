import { Colors } from "@/constants/theme";
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
import WheelPicker, { WheelPickerHandle } from "../wheel-picker";
import { styles } from "./settings.styles";

const MAX_STEP = GRID_STEPS.length - 1;
const SWITCH_PADDING = 4;
const SWITCH_BORDER = 1.5;

const columnsPageForStep = (idx: number) => MAX_STEP - idx;
const columnsStepForPage = (page: number) => MAX_STEP - page;

const MOOD_SCALE_MAX = 10;

function Settings() {
  const scheme = useAppColorScheme();
  const colors = Colors[scheme];
  const {
    stepIndex,
    setStepIndex,
    colorSchemePref,
    setColorSchemePref,
    loaded,
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

  const switchOptions: {
    key: ColorSchemePref;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { key: "light", icon: "sunny-outline" },
    { key: "automatic", icon: "contrast-outline" },
    { key: "dark", icon: "moon-outline" },
  ];
  const switchIndex = switchOptions.findIndex((o) => o.key === colorSchemePref);
  const switchTranslate = useRef(new Animated.Value(switchIndex)).current;
  Animated.spring(switchTranslate, {
    toValue: switchIndex,
    useNativeDriver: true,
    damping: 16,
    stiffness: 180,
  }).start();

  const prefRef = useRef(colorSchemePref);
  prefRef.current = colorSchemePref;

  const swipePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 15,
      onPanResponderRelease: (_, g) => {
        const current = prefRef.current;
        if (g.dx > 20) {
          if (current === "light") setColorSchemePref("automatic");
          else if (current === "automatic") setColorSchemePref("dark");
        } else if (g.dx < -20) {
          if (current === "dark") setColorSchemePref("automatic");
          else if (current === "automatic") setColorSchemePref("light");
        }
      },
    }),
  ).current;

  const csvEscape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const openExportSetup = async (type: "json" | "txt" | "csv") => {
    try {
      const logs = await getAllLogs();
      if (logs.length > 0) {
        setStartDate(logs[0].date);
        setEndDate(logs[logs.length - 1].date);
      } else {
        const todayStr = new Date().toISOString().split("T")[0];
        setStartDate(todayStr);
        setEndDate(todayStr);
      }
      setFileName(
        type === "json"
          ? "sleepinapp_backup"
          : type === "csv"
            ? "sleepinapp_data"
            : "sleepinapp_report",
      );
      setExportType(type);
    } catch (e) {
      showInfo("Failed to look up log parameters.");
    }
  };

  const executeExport = async () => {
    if (!fileName.trim()) {
      showInfo("Please provide a valid filename.");
      return;
    }

    setExportDialogVisible(false);
    const sanitizedName = fileName.trim().replace(/[^a-zA-Z0-9_.-]/g, "_");

    try {
      const logs = await getAllLogs();
      const bodyCareLogs = await getAllBodyCareLogs();

      const bodyCareByDate = new Map(
        bodyCareLogs.map((bodyCare) => [bodyCare.date, bodyCare]),
      );

      let fileContent = "";
      let mimeType = "text/plain";
      let fileExtension = ".txt";

      if (exportType === "json") {
        const edits = await getAllEdits();

        fileContent = JSON.stringify({
          version: 3,
          logs,
          edits,
          bodyCareLogs,
        });

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
          fileContent += `Mood Rating: ${log.mood}/${MOOD_SCALE_MAX}\n`;
          fileContent += `Self Harm: ${bodyCare ? "yes" : "no"}\n`;
          if (log.comment) fileContent += `Notes: ${log.comment}\n`;
          if (log.logged_at) fileContent += `Logged: ${log.logged_at}\n`;
          if (log.updated_at) {
            fileContent += `Last Edited: ${log.updated_at}\n`;
            const dateEdits = editsByDate.get(log.date) ?? [];
            dateEdits.forEach((e) => {
              const parts: string[] = [];
              if (e.changed_hours)
                parts.push(`hours ${e.prev_hours} → ${e.new_hours}`);
              if (e.changed_mood)
                parts.push(`mood ${e.prev_mood} → ${e.new_mood}`);
              if (e.changed_comment) parts.push("comment");
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

        const rows: string[][] = [header];

        filteredLogs.forEach((log) => {
          rows.push([
            "log",
            log.date,
            String(log.hours),
            String(log.mood),
            log.comment ?? "",
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
          rows.push([
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

        filteredBodyCareLogs.forEach((bodyCare) => {
          rows.push([
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

        fileContent = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
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
      }

      setExportType(null);
    } catch (e) {
      console.error(e);
      showInfo("Failed to export your data file.");
    }
  };

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const fileUri = result.assets[0].uri;
      const response = await fetch(fileUri);
      const content = await response.text();
      const parsed = JSON.parse(content);

      if (Array.isArray(parsed)) {
        await importLogs(parsed);
      } else if (parsed && Array.isArray(parsed.logs)) {
        const edits = Array.isArray(parsed.edits) ? parsed.edits : [];

        const bodyCareLogs = Array.isArray(parsed.bodyCareLogs)
          ? parsed.bodyCareLogs
          : [];

        await importBackup(parsed.logs, edits, bodyCareLogs);
      } else {
        throw new Error("Invalid format");
      }

      showInfo("Data has been successfully imported!");
      DeviceEventEmitter.emit("refreshCalendarGrid");
    } catch (e) {
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
            { color: colors.text, fontFamily: "Redaction20-Bold" },
          ]}
        >
          settings
        </Text>
        {loaded && (
          <View style={styles.gridRow}>
            <View style={styles.gridColumn}>
              <Text
                style={[
                  styles.gridLabel,
                  {
                    color: colors.textSecondary,
                    fontFamily: "Redaction20-Italic",
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
                  { color: colors.text, fontFamily: "Redaction35-Bold" },
                ]}
                lockRef={gridLockRef}
                lockKey="rows"
              />
            </View>

            <Text
              style={[
                styles.xSign,
                { color: colors.text, fontFamily: "Redaction35-Bold" },
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
                    fontFamily: "Redaction20-Italic",
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
                  { color: colors.text, fontFamily: "Redaction35-Bold" },
                ]}
                lockRef={gridLockRef}
                lockKey="columns"
              />
            </View>
          </View>
        )}

        <Text
          style={[
            styles.sectionLabel,
            { color: colors.textSecondary, fontFamily: "Redaction20-Italic" },
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
                left: SWITCH_PADDING,
                transform: [
                  {
                    translateX: switchTranslate.interpolate({
                      inputRange: [0, 1, 2],
                      outputRange: [0, slotWidth, slotWidth * 2],
                    }),
                  },
                ],
              },
            ]}
          />
          {switchOptions.map((opt, i) => (
            <Pressable
              key={opt.key}
              onPress={() => setColorSchemePref(opt.key)}
              style={styles.switchOption}
            >
              <Ionicons
                name={opt.icon}
                size={18}
                color={
                  switchIndex === i ? colors.background : colors.textSecondary
                }
              />
            </Pressable>
          ))}
        </View>

        <Text
          style={[
            styles.creditsLabel,
            { color: colors.textSecondary, fontFamily: "Redaction20-Italic" },
          ]}
        >
          font credits
        </Text>
        <Text
          style={[
            styles.creditRole,
            { color: colors.textSecondary, fontFamily: "Redaction35-Regular" },
          ]}
        >
          typeface design
        </Text>
        <Text
          style={[
            styles.creditName,
            { color: colors.text, fontFamily: "Redaction35-Regular" },
          ]}
        >
          Jeremy Mickel
        </Text>

        <Text
          style={[
            styles.creditRole,
            { color: colors.textSecondary, fontFamily: "Redaction35-Regular" },
          ]}
        >
          creative direction
        </Text>
        <Text
          style={[
            styles.creditName,
            { color: colors.text, fontFamily: "Redaction35-Regular" },
          ]}
        >
          Forest Young
        </Text>

        <Text
          style={[
            styles.creditRole,
            { color: colors.textSecondary, fontFamily: "Redaction35-Regular" },
          ]}
        >
          the redaction
        </Text>
        <View style={styles.redactionBlock}>
          <Text
            style={[
              styles.creditName,
              { color: colors.text, fontFamily: "Redaction35-Regular" },
            ]}
          >
            Titus Kaphar
          </Text>
          <Text
            style={[
              styles.creditName,
              { color: colors.text, fontFamily: "Redaction35-Regular" },
            ]}
          >
            Reginald Dwayne Betts
          </Text>
          <Pressable
            onPress={() => Linking.openURL("https://www.redaction.us/")}
          >
            <Text
              style={[
                styles.redactionLink,
                { color: colors.text, fontFamily: "Redaction35-Regular" },
              ]}
            >
              redaction.us
            </Text>
          </Pressable>
        </View>

        <Text
          style={[
            styles.madeByLabel,
            { color: colors.textSecondary, fontFamily: "Redaction20-Italic" },
          ]}
        >
          app made by
        </Text>
        <Pressable onPress={() => Linking.openURL("https://kvvz.xyz")}>
          <Text
            style={[
              styles.madeByName,
              { color: colors.text, fontFamily: "Redaction35-Regular" },
            ]}
          >
            kvvzie
          </Text>
        </Pressable>

        <Text
          style={[
            styles.dataLabel,
            { color: colors.textSecondary, fontFamily: "Redaction20-Italic" },
          ]}
        >
          data management
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
              style={[styles.actionButtonText, { color: colors.background }]}
            >
              export
            </Text>
          </Pressable>

          <Pressable
            onPressIn={handleImport}
            style={[styles.actionButton, { backgroundColor: colors.text }]}
          >
            <Text
              style={[styles.actionButtonText, { color: colors.background }]}
            >
              import
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
                    { color: colors.text, fontFamily: "Redaction20-Regular" },
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
                        { color: colors.background },
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
                    onPress={() => openExportSetup("txt")}
                  >
                    <Text
                      style={[
                        styles.dialogButtonText,
                        { color: colors.background },
                      ]}
                    >
                      Readable Report (TXT)
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
                        { color: colors.background },
                      ]}
                    >
                      Full Data (CSV)
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text
                  style={[
                    styles.message,
                    {
                      color: colors.text,
                      fontFamily: "Redaction20-Bold",
                      marginBottom: 12,
                    },
                  ]}
                >
                  Configure Export File
                </Text>

                <Text
                  style={[
                    styles.inputLabel,
                    {
                      color: colors.textSecondary,
                      fontFamily: "Redaction20-Italic",
                    },
                  ]}
                >
                  Filename
                </Text>
                <TextInput
                  style={[
                    styles.inputField,
                    {
                      color: colors.text,
                      borderColor: colors.textSecondary,
                      fontFamily: "Redaction20-Regular",
                    },
                  ]}
                  value={fileName}
                  onChangeText={setFileName}
                  placeholder="Enter name"
                  placeholderTextColor={colors.textSecondary}
                />

                {exportType === "txt" && (
                  <>
                    <Text
                      style={[
                        styles.inputLabel,
                        {
                          color: colors.textSecondary,
                          fontFamily: "Redaction20-Italic",
                        },
                      ]}
                    >
                      Start Date (YYYY-MM-DD)
                    </Text>
                    <TextInput
                      style={[
                        styles.inputField,
                        {
                          color: colors.text,
                          borderColor: colors.textSecondary,
                          fontFamily: "Redaction20-Regular",
                        },
                      ]}
                      value={startDate}
                      onChangeText={setStartDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.textSecondary}
                    />

                    <Text
                      style={[
                        styles.inputLabel,
                        {
                          color: colors.textSecondary,
                          fontFamily: "Redaction20-Italic",
                        },
                      ]}
                    >
                      End Date (YYYY-MM-DD)
                    </Text>
                    <TextInput
                      style={[
                        styles.inputField,
                        {
                          color: colors.text,
                          borderColor: colors.textSecondary,
                          fontFamily: "Redaction20-Regular",
                        },
                      ]}
                      value={endDate}
                      onChangeText={setEndDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </>
                )}

                <View style={[styles.dialogActionsColumn, { marginTop: 12 }]}>
                  <Pressable
                    style={[
                      styles.dialogButton,
                      { backgroundColor: colors.text },
                    ]}
                    onPress={executeExport}
                  >
                    <Text
                      style={[
                        styles.dialogButtonText,
                        { color: colors.background },
                      ]}
                    >
                      Confirm & Save
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.dialogButton,
                      {
                        backgroundColor: "transparent",
                        borderWidth: 1,
                        borderColor: colors.textSecondary,
                      },
                    ]}
                    onPress={() => setExportType(null)}
                  >
                    <Text
                      style={[styles.dialogButtonText, { color: colors.text }]}
                    >
                      Back
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={infoDialog.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoDialog({ ...infoDialog, visible: false })}
      >
        <View
          style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}
        >
          <View
            style={[styles.box, { backgroundColor: colors.modalBackground }]}
          >
            <Text
              style={[
                styles.message,
                { color: colors.text, fontFamily: "Redaction20-Regular" },
              ]}
            >
              {infoDialog.message}
            </Text>
            <View style={styles.dialogActionsColumn}>
              <Pressable
                style={[styles.dialogButton, { backgroundColor: colors.text }]}
                onPress={() => setInfoDialog({ ...infoDialog, visible: false })}
              >
                <Text
                  style={[
                    styles.dialogButtonText,
                    { color: colors.background },
                  ]}
                >
                  OK
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default memo(Settings);
