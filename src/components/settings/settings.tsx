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
  getAllTodos,
  importBackup,
  importLogs,
} from "@/lib/db";
import {
  buildCsvExportContent,
  buildJsonExportPayload,
  buildTxtExportContent,
} from "@/lib/export-utils";
import { readTextFileFromUri, saveFileToDevice } from "@/lib/file-saver";
import { ThemePaletteColors } from "@/types/appearance";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as Linking from "expo-linking";
import { memo, useEffect, useRef, useState } from "react";
import {
  Animated,
  DeviceEventEmitter,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { GoogleColorPicker } from "../color-picker/google-color-picker";
import AnimatedRadioDot from "../animated-radio-dot";
import ConfirmDialog from "../confirm-dialog";
import { getLocalTodayIsoDate } from "../sleep-modal/todo.utils";
import WheelPicker, { WheelPickerHandle } from "../wheel-picker";
import { styles } from "./settings.styles";

const MAX_STEP = GRID_STEPS.length - 1;
const SWITCH_PADDING = 4;
const SWITCH_BORDER = 1.5;

const columnsPageForStep = (idx: number) => MAX_STEP - idx;
const columnsStepForPage = (page: number) => MAX_STEP - page;

function Settings() {
  const scheme = useAppColorScheme();
  const {
    mode,
    canExportTheme,
    isModified,
    colors,
    theme,
    features,
    backgrounds,
    customFont,
    resolveFont,
    updateTheme,
    updateFeatures,
    updateColorOverride,
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
    toDiscussEnabled,
    setToDiscussEnabled,
    loaded,
  } = useSettings();

  const rowsRef = useRef<WheelPickerHandle>(null);
  const columnsRef = useRef<WheelPickerHandle>(null);
  const gridLockRef = useRef<string | null>(null);

  const [studioModalVisible, setStudioModalVisible] = useState(false);
  const [activeColorTab, setActiveColorTab] = useState<keyof ThemePaletteColors>("background");
  const [exportFormatDialogVisible, setExportFormatDialogVisible] = useState(false);
  const [importChoiceDialogVisible, setImportChoiceDialogVisible] = useState(false);
  const [exportType, setExportType] = useState<"json" | "txt" | "csv" | "theme" | null>(null);
  const [fileName, setFileName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [themeExportName, setThemeExportName] = useState("");
  const [infoDialog, setInfoDialog] = useState({ visible: false, message: "" });
  const [resetConfirmVisible, setResetConfirmVisible] = useState(false);

  const showInfo = (message: string) => {
    setInfoDialog({ visible: true, message });
  };

  const canIncreaseRows = stepIndex < MAX_STEP;
  const canDecreaseRows = stepIndex > 0;
  const canIncreaseColumns = stepIndex > 0;
  const canDecreaseColumns = stepIndex < MAX_STEP;

  useEffect(() => {
    if (loaded && features.gridPickerEnabled) {
      rowsRef.current?.syncTo(stepIndex);
      columnsRef.current?.syncTo(columnsPageForStep(stepIndex));
    }
  }, [stepIndex, loaded, features.gridPickerEnabled]);

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

  useEffect(() => {
    Animated.spring(switchTranslate, {
      toValue: switchIndex,
      useNativeDriver: true,
      damping: 16,
      stiffness: 180,
    }).start();
  }, [switchIndex]);

  const swipePan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderRelease: (_, g) => {
      const order: ColorSchemePref[] = ["light", "automatic", "dark"];
      const currentIdx = order.indexOf(colorSchemePref);
      if (g.dx > 20 && currentIdx < 2) setColorSchemePref(order[currentIdx + 1]);
      else if (g.dx < -20 && currentIdx > 0)
        setColorSchemePref(order[currentIdx - 1]);
    },
  });

  const handlePickFont = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const asset = res.assets[0];
      const fontName = asset.name
        ? asset.name.replace(/\.[^/.]+$/, "")
        : "CustomFont";

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

  const handlePickBackground = async (targetScreen: "calendar" | "settings") => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "*/*"],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const asset = res.assets[0];

      const manipulated = await manipulateAsync(
        asset.uri,
        [{ resize: { width: 1080 } }],
        { compress: 0.75, format: SaveFormat.JPEG, base64: true },
      );

      const compressedDataUri = `data:image/jpeg;base64,${manipulated.base64}`;
      updateBackground(targetScreen, compressedDataUri);
      showInfo(`${targetScreen} background updated!`);
    } catch {
      showInfo("Failed to load image file.");
    }
  };

  const handleClearBackground = (targetScreen: "calendar" | "settings") => {
    updateBackground(targetScreen, null);
    showInfo(`${targetScreen} background removed.`);
  };

  const openExportSetup = (type: "json" | "txt" | "csv" | "theme") => {
    setExportFormatDialogVisible(false);
    setExportType(type);
    const today = new Date().toISOString().split("T")[0];
    if (type === "theme") {
      setThemeExportName(theme.name || "My Theme");
    } else {
      setFileName(`sleepinapp_${type}_${today}`);
      setStartDate("");
      setEndDate("");
    }
  };

  const handleExportConfirm = async () => {
    if (!exportType) return;

    if (exportType === "theme") {
      setExportType(null);
      const res = await exportTheme(themeExportName || "My Theme");
      if (res.success) {
        showInfo("App look exported successfully (.moodtheme)!");
      } else if (!res.canceled) {
        showInfo(res.error || "Failed to export look.");
      }
      return;
    }

    setExportType(null);

    try {
      const logs = await getAllLogs();
      const bodyCareLogs = features.bodyCareEnabled
        ? await getAllBodyCareLogs()
        : [];
      const todos = await getAllTodos();
      const todayDate = getLocalTodayIsoDate();

      let fileContent = "";
      let mimeType = "application/json";
      let fileExtension = ".json";

      const sanitizedName =
        fileName.trim() ||
        `sleepinapp_export_${todayDate}`;

      if (exportType === "json") {
        const allEdits = await getAllEdits();
        const exportPayload = buildJsonExportPayload({
          exportedAt: new Date().toISOString(),
          logs,
          edits: allEdits,
          bodyCareLogs,
          todos,
          bodyCareEnabled: features.bodyCareEnabled,
        });
        fileContent = JSON.stringify(exportPayload, null, 2);
        mimeType = "application/json";
        fileExtension = ".json";
      } else if (exportType === "txt") {
        const allEdits = await getAllEdits();
        fileContent = buildTxtExportContent({
          logs,
          edits: allEdits,
          bodyCareLogs,
          todos,
          startDate,
          endDate,
          moodStarsEnabled: features.moodStarsEnabled,
          bodyCareEnabled: features.bodyCareEnabled,
          commentsEnabled: features.commentsEnabled,
          todoListEnabled: features.todoListEnabled !== false,
          todayDate,
        });
        mimeType = "text/plain";
        fileExtension = ".txt";
      } else if (exportType === "csv") {
        const allEdits = await getAllEdits();
        fileContent = buildCsvExportContent({
          logs,
          edits: allEdits,
          bodyCareLogs,
          todos,
          startDate,
          endDate,
          moodStarsEnabled: features.moodStarsEnabled,
          bodyCareEnabled: features.bodyCareEnabled,
          commentsEnabled: features.commentsEnabled,
          todoListEnabled: features.todoListEnabled !== false,
          todayDate,
        });
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
    } catch {
      showInfo("An error occurred during export.");
    }
  };

  const handleImportDataBackup = async () => {
    setImportChoiceDialogVisible(false);
    try {
      const pickerRes = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/*", "*/*"],
        copyToCacheDirectory: true,
      });

      if (pickerRes.canceled || !pickerRes.assets || pickerRes.assets.length === 0) {
        return;
      }

      const fileUri = pickerRes.assets[0].uri;
      const content = await readTextFileFromUri(fileUri);
      const parsed = JSON.parse(content);

      if (Array.isArray(parsed)) {
        await importLogs(parsed);
      } else if (parsed && (Array.isArray(parsed.logs) || Array.isArray(parsed.todos))) {
        const importedLogs = Array.isArray(parsed.logs) ? parsed.logs : [];
        const edits = Array.isArray(parsed.edits) ? parsed.edits : [];
        const importedBodyCareLogs = Array.isArray(parsed.bodyCareLogs)
          ? parsed.bodyCareLogs
          : [];
        const importedTodos = Array.isArray(parsed.todos) ? parsed.todos : [];
        await importBackup(
          importedLogs,
          edits,
          importedBodyCareLogs,
          importedTodos,
        );
      } else {
        throw new Error("Invalid format");
      }

      showInfo("Data has been successfully imported!");
      DeviceEventEmitter.emit("refreshCalendarGrid");
    } catch {
      showInfo("Please select a valid sleepinapp backup file (JSON).");
    }
  };

  const handleImportAppLook = async () => {
    setImportChoiceDialogVisible(false);
    const res = await importThemeFromFile();
    if (res.success) {
      showInfo("App look successfully imported!");
      DeviceEventEmitter.emit("refreshCalendarGrid");
    } else if (!res.canceled) {
      showInfo(res.error || "Failed to import theme file.");
    }
  };

  const handleResetThemeConfirm = async () => {
    setResetConfirmVisible(false);
    setStudioModalVisible(false);
    await resetTheme();
    showInfo(
      mode === "baked"
        ? "Appearance reset to baked build defaults!"
        : "Appearance reset to vanilla defaults!",
    );
    DeviceEventEmitter.emit("refreshCalendarGrid");
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: backgrounds.settings ? "transparent" : colors.background },
      ]}
    >
      {features.inAppCustomizationEnabled ? (
        <Pressable
          onPress={() => setStudioModalVisible(true)}
          hitSlop={16}
          style={styles.topRightFloatingButton}
        >
          <Ionicons name="color-wand-outline" size={24} color={colors.text} />
        </Pressable>
      ) : isModified ? (
        <Pressable
          onPress={() => setResetConfirmVisible(true)}
          hitSlop={16}
          style={styles.topRightFloatingButton}
        >
          <Ionicons
            name="arrow-undo-outline"
            size={22}
            color={colors.textSecondary}
          />
        </Pressable>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text
            style={[
              styles.title,
              { color: colors.text, fontFamily: resolveFont("bold") },
            ]}
          >
            settings
          </Text>
        </View>

        {features.gridPickerEnabled && loaded && (
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
        )}

        {features.colorSchemeToggleEnabled && (
          <>
            <Text
              style={[
                styles.sectionLabel,
                { color: colors.textSecondary, fontFamily: resolveFont("italic") },
              ]}
            >
              color scheme
            </Text>
            <View
              style={[
                styles.switchTrack,
                { borderColor: colors.textSecondary },
                features.toDiscussToggleEnabled !== false && {
                  marginBottom: 14,
                },
              ]}
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
                      switchIndex === i
                        ? colors.background
                        : colors.textSecondary
                    }
                  />
                </Pressable>
              ))}
            </View>
          </>
        )}

        {features.toDiscussToggleEnabled !== false && (
          <Pressable
            onPress={() => setToDiscussEnabled(!toDiscussEnabled)}
            hitSlop={10}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              marginBottom: 14,
              paddingVertical: 2,
            }}
          >
            <AnimatedRadioDot
              checked={toDiscussEnabled}
              size={22}
              color={toDiscussEnabled ? colors.text : colors.textSecondary}
            />
            <Text
              style={{
                fontSize: 18,
                color: toDiscussEnabled ? colors.text : colors.textSecondary,
                fontFamily: resolveFont("regular"),
              }}
            >
              to discuss
            </Text>
          </Pressable>
        )}

        {(!theme.font || !theme.font.name || theme.font.name === "Redaction") && (
          <>
            <Text
              style={[
                styles.creditsLabel,
                { color: colors.textSecondary, fontFamily: resolveFont("italic") },
              ]}
            >
              font credits
            </Text>
            <Text
              style={[
                styles.creditRole,
                { color: colors.textSecondary, fontFamily: resolveFont("regular") },
              ]}
            >
              typeface design
            </Text>
            <Text
              style={[
                styles.creditName,
                { color: colors.text, fontFamily: resolveFont("regular") },
              ]}
            >
              Jeremy Mickel
            </Text>

            <Text
              style={[
                styles.creditRole,
                { color: colors.textSecondary, fontFamily: resolveFont("regular") },
              ]}
            >
              creative direction
            </Text>
            <Text
              style={[
                styles.creditName,
                { color: colors.text, fontFamily: resolveFont("regular") },
              ]}
            >
              Forest Young
            </Text>

            <Text
              style={[
                styles.creditRole,
                { color: colors.textSecondary, fontFamily: resolveFont("regular") },
              ]}
            >
              the redaction
            </Text>
            <View style={styles.redactionBlock}>
              <Text
                style={[
                  styles.creditName,
                  { color: colors.text, fontFamily: resolveFont("regular") },
                ]}
              >
                Titus Kaphar
              </Text>
              <Text
                style={[
                  styles.creditName,
                  { color: colors.text, fontFamily: resolveFont("regular") },
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
                    { color: colors.text, fontFamily: resolveFont("regular") },
                  ]}
                >
                  redaction.us
                </Text>
              </Pressable>
            </View>
          </>
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
          data management
        </Text>

        <View style={styles.actionRow}>
          <Pressable
            onPressIn={() => setExportFormatDialogVisible(true)}
            style={[styles.actionButton, { backgroundColor: colors.text }]}
          >
            <Text
              style={[
                styles.actionButtonText,
                { color: colors.background, fontFamily: resolveFont("bold") },
              ]}
            >
              export
            </Text>
          </Pressable>

          <Pressable
            onPressIn={() => setImportChoiceDialogVisible(true)}
            style={[styles.actionButton, { backgroundColor: colors.text }]}
          >
            <Text
              style={[
                styles.actionButtonText,
                { color: colors.background, fontFamily: resolveFont("bold") },
              ]}
            >
              import
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={exportFormatDialogVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExportFormatDialogVisible(false)}
      >
        <Pressable
          style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}
          onPress={() => setExportFormatDialogVisible(false)}
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
              Choose export format
            </Text>
            <View style={styles.dialogActionsColumn}>
              <Pressable
                style={[styles.dialogButton, { backgroundColor: colors.text }]}
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
                style={[styles.dialogButton, { backgroundColor: colors.text }]}
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
              <Pressable
                style={[styles.dialogButton, { backgroundColor: colors.text }]}
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
              {canExportTheme && (
                <Pressable
                  style={[styles.dialogButton, { backgroundColor: colors.text }]}
                  onPress={() => openExportSetup("theme")}
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
                    App Look (.moodtheme)
                  </Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={importChoiceDialogVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImportChoiceDialogVisible(false)}
      >
        <Pressable
          style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}
          onPress={() => setImportChoiceDialogVisible(false)}
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
              Choose what to import
            </Text>
            <View style={styles.dialogActionsColumn}>
              <Pressable
                style={[styles.dialogButton, { backgroundColor: colors.text }]}
                onPress={handleImportDataBackup}
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
                  Data Backup (JSON)
                </Text>
              </Pressable>
              <Pressable
                style={[styles.dialogButton, { backgroundColor: colors.text }]}
                onPress={handleImportAppLook}
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
                  App Look (.moodtheme)
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={exportType !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setExportType(null)}
      >
        <Pressable
          style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}
          onPress={() => setExportType(null)}
        >
          <Pressable
            style={[styles.box, { backgroundColor: colors.modalBackground }]}
            onPress={() => {}}
          >
            {exportType === "theme" ? (
              <>
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
              </>
            ) : (
              <>
                <Text
                  style={[
                    styles.message,
                    { color: colors.text, fontFamily: resolveFont("bold") },
                  ]}
                >
                  Export {exportType?.toUpperCase()}
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
                  Cancel
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
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={studioModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStudioModalVisible(false)}
      >
        <View style={styles.overlay}>
          <Pressable
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.modalOverlay },
            ]}
            onPress={() => setStudioModalVisible(false)}
          />
          <View
            style={[
              styles.studioModalContainer,
              {
                backgroundColor: colors.background,
                borderColor: colors.textSecondary,
              },
            ]}
          >
            <View
              style={[
                styles.studioModalHeader,
                { borderBottomColor: colors.textSecondary },
              ]}
            >
              <Text
                style={[
                  styles.studioModalTitle,
                  { color: colors.text, fontFamily: resolveFont("bold") },
                ]}
              >
                appearance studio
              </Text>
              <Pressable
                onPress={() => setStudioModalVisible(false)}
                hitSlop={12}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              contentContainerStyle={{ paddingBottom: 36 }}
            >
              <Text
                style={[
                  styles.studioSectionHeader,
                  { color: colors.textSecondary, fontFamily: resolveFont("italic") },
                ]}
              >
                typography
              </Text>
              <View
                style={[
                  styles.studioCard,
                  {
                    backgroundColor: colors.backgroundElement,
                    borderColor: colors.textSecondary,
                  },
                ]}
              >
                <View style={styles.studioRow}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.studioLabel,
                        { color: colors.text, fontFamily: resolveFont("bold") },
                      ]}
                    >
                      {customFont?.name || "Redaction"}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.textSecondary,
                        fontFamily: resolveFont("italic"),
                        marginTop: 2,
                      }}
                    >
                      the quick brown fox jumps over the lazy dog
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <Pressable
                    onPress={handlePickFont}
                    style={[
                      styles.studioSmallBtn,
                      {
                        backgroundColor: colors.text,
                        flex: 1,
                        alignItems: "center",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.studioSmallBtnText,
                        {
                          color: colors.background,
                          fontFamily: resolveFont("bold"),
                        },
                      ]}
                    >
                      choose .ttf/.otf
                    </Text>
                  </Pressable>
                  {customFont && (
                    <Pressable
                      onPress={handleResetFont}
                      style={[
                        styles.studioSmallBtn,
                        {
                          backgroundColor: colors.background,
                          flex: 1,
                          alignItems: "center",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.studioSmallBtnText,
                          {
                            color: colors.text,
                            fontFamily: resolveFont("regular"),
                          },
                        ]}
                      >
                        reset font
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>

              <Text
                style={[
                  styles.studioSectionHeader,
                  { color: colors.textSecondary, fontFamily: resolveFont("italic") },
                ]}
              >
                wallpapers
              </Text>
              <View
                style={[
                  styles.studioCard,
                  {
                    backgroundColor: colors.backgroundElement,
                    borderColor: colors.textSecondary,
                  },
                ]}
              >
                <View style={styles.wallpaperPreviewRow}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.studioLabel,
                        { color: colors.text, fontFamily: resolveFont("bold") },
                      ]}
                    >
                      calendar wallpaper
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.textSecondary,
                        fontFamily: resolveFont("italic"),
                      }}
                    >
                      {backgrounds.calendar ? "custom image active" : "none"}
                    </Text>
                  </View>
                  {backgrounds.calendar && (
                    <Image
                      source={{ uri: backgrounds.calendar }}
                      style={styles.wallpaperThumb}
                      contentFit="cover"
                    />
                  )}
                </View>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                  <Pressable
                    onPress={() => handlePickBackground("calendar")}
                    style={[
                      styles.studioSmallBtn,
                      {
                        backgroundColor: colors.text,
                        flex: 1,
                        alignItems: "center",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.studioSmallBtnText,
                        {
                          color: colors.background,
                          fontFamily: resolveFont("bold"),
                        },
                      ]}
                    >
                      {backgrounds.calendar ? "replace" : "choose photo"}
                    </Text>
                  </Pressable>
                  {backgrounds.calendar && (
                    <Pressable
                      onPress={() => handleClearBackground("calendar")}
                      style={[
                        styles.studioSmallBtn,
                        {
                          backgroundColor: colors.background,
                          flex: 1,
                          alignItems: "center",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.studioSmallBtnText,
                          {
                            color: colors.text,
                            fontFamily: resolveFont("regular"),
                          },
                        ]}
                      >
                        remove
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>

              <View
                style={[
                  styles.studioCard,
                  {
                    backgroundColor: colors.backgroundElement,
                    borderColor: colors.textSecondary,
                  },
                ]}
              >
                <View style={styles.wallpaperPreviewRow}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.studioLabel,
                        { color: colors.text, fontFamily: resolveFont("bold") },
                      ]}
                    >
                      settings wallpaper
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.textSecondary,
                        fontFamily: resolveFont("italic"),
                      }}
                    >
                      {backgrounds.settings ? "custom image active" : "none"}
                    </Text>
                  </View>
                  {backgrounds.settings && (
                    <Image
                      source={{ uri: backgrounds.settings }}
                      style={styles.wallpaperThumb}
                      contentFit="cover"
                    />
                  )}
                </View>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                  <Pressable
                    onPress={() => handlePickBackground("settings")}
                    style={[
                      styles.studioSmallBtn,
                      {
                        backgroundColor: colors.text,
                        flex: 1,
                        alignItems: "center",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.studioSmallBtnText,
                        {
                          color: colors.background,
                          fontFamily: resolveFont("bold"),
                        },
                      ]}
                    >
                      {backgrounds.settings ? "replace" : "choose photo"}
                    </Text>
                  </Pressable>
                  {backgrounds.settings && (
                    <Pressable
                      onPress={() => handleClearBackground("settings")}
                      style={[
                        styles.studioSmallBtn,
                        {
                          backgroundColor: colors.background,
                          flex: 1,
                          alignItems: "center",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.studioSmallBtnText,
                          {
                            color: colors.text,
                            fontFamily: resolveFont("regular"),
                          },
                        ]}
                      >
                        remove
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>

              <Text
                style={[
                  styles.studioSectionHeader,
                  { color: colors.textSecondary, fontFamily: resolveFont("italic") },
                ]}
              >
                color customization ({scheme} mode)
              </Text>
              <View style={styles.colorTabRow}>
                {(
                  [
                    { key: "background", label: "bg" },
                    { key: "text", label: "text" },
                    { key: "backgroundElement", label: "card" },
                    { key: "backgroundSelected", label: "select" },
                    { key: "textSecondary", label: "muted" },
                  ] as const
                ).map((tab) => {
                  const isSelected = activeColorTab === tab.key;
                  const tabColor = colors[tab.key] || "#FFFFFF";
                  return (
                    <Pressable
                      key={tab.key}
                      onPress={() => setActiveColorTab(tab.key)}
                      style={[
                        styles.colorTab,
                        {
                          backgroundColor: isSelected
                            ? colors.text
                            : colors.backgroundElement,
                          borderColor: isSelected
                            ? colors.text
                            : colors.textSecondary,
                        },
                      ]}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <View
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: tabColor,
                            borderWidth: 1,
                            borderColor: isSelected
                              ? colors.background
                              : colors.textSecondary,
                          }}
                        />
                        <Text
                          style={[
                            styles.colorTabText,
                            {
                              color: isSelected
                                ? colors.background
                                : colors.text,
                              fontFamily: resolveFont(
                                isSelected ? "bold" : "regular",
                              ),
                            },
                          ]}
                        >
                          {tab.label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <GoogleColorPicker
                key={`${scheme}-${activeColorTab}`}
                color={colors[activeColorTab] || "#FFFFFF"}
                onChange={(hex) => updateColorOverride(scheme, activeColorTab, hex)}
                textColor={colors.text}
                borderColor={colors.textSecondary}
                fontFamily={resolveFont("regular")}
              />

              <Text
                style={[
                  styles.studioSectionHeader,
                  { color: colors.textSecondary, fontFamily: resolveFont("italic") },
                ]}
              >
                feature toggles
              </Text>

              <Pressable
                onPress={() =>
                  updateFeatures({
                    colorSchemeToggleEnabled: !features.colorSchemeToggleEnabled,
                  })
                }
                style={styles.studioRow}
              >
                <Text
                  style={[
                    styles.studioLabel,
                    { color: colors.text, fontFamily: resolveFont("regular") },
                  ]}
                >
                  color scheme switcher
                </Text>
                <Ionicons
                  name={
                    features.colorSchemeToggleEnabled
                      ? "checkbox"
                      : "square-outline"
                  }
                  size={22}
                  color={colors.text}
                />
              </Pressable>

              <Pressable
                onPress={() =>
                  updateFeatures({
                    bodyCareEnabled: !features.bodyCareEnabled,
                  })
                }
                style={styles.studioRow}
              >
                <Text
                  style={[
                    styles.studioLabel,
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
                style={styles.studioRow}
              >
                <Text
                  style={[
                    styles.studioLabel,
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
                style={styles.studioRow}
              >
                <Text
                  style={[
                    styles.studioLabel,
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
                    todoListEnabled: features.todoListEnabled === false,
                  })
                }
                style={styles.studioRow}
              >
                <Text
                  style={[
                    styles.studioLabel,
                    { color: colors.text, fontFamily: resolveFont("regular") },
                  ]}
                >
                  to-do list
                </Text>
                <Ionicons
                  name={
                    features.todoListEnabled !== false
                      ? "checkbox"
                      : "square-outline"
                  }
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
                style={styles.studioRow}
              >
                <Text
                  style={[
                    styles.studioLabel,
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

              {!features.gridPickerEnabled && (
                <View
                  style={[
                    styles.studioCard,
                    {
                      backgroundColor: colors.backgroundElement,
                      borderColor: colors.textSecondary,
                      marginTop: 4,
                      marginBottom: 12,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.studioLabel,
                      { color: colors.text, fontFamily: resolveFont("bold") },
                    ]}
                  >
                    locked grid size ({GRID_STEPS[stepIndex].rows}x{GRID_STEPS[stepIndex].columns})
                  </Text>
                  <View style={styles.gridStepRow}>
                    {GRID_STEPS.map((step, idx) => {
                      const isSelected = idx === stepIndex;
                      return (
                        <Pressable
                          key={idx}
                          onPress={() => setStepIndex(idx)}
                          style={[
                            styles.gridStepChip,
                            {
                              backgroundColor: isSelected
                                ? colors.text
                                : colors.background,
                              borderColor: isSelected
                                ? colors.text
                                : colors.textSecondary,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.gridStepChipText,
                              {
                                color: isSelected
                                  ? colors.background
                                  : colors.text,
                                fontFamily: resolveFont(
                                  isSelected ? "bold" : "regular",
                                ),
                              },
                            ]}
                          >
                            {step.rows}x{step.columns}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              <Pressable
                onPress={() => {
                  const nextToggleVisible =
                    features.toDiscussToggleEnabled === false;
                  updateFeatures({
                    toDiscussToggleEnabled: nextToggleVisible,
                    toDiscussDefaultEnabled: toDiscussEnabled,
                  });
                }}
                style={styles.studioRow}
              >
                <Text
                  style={[
                    styles.studioLabel,
                    { color: colors.text, fontFamily: resolveFont("regular") },
                  ]}
                >
                  to discuss switch
                </Text>
                <Ionicons
                  name={
                    features.toDiscussToggleEnabled !== false
                      ? "checkbox"
                      : "square-outline"
                  }
                  size={22}
                  color={colors.text}
                />
              </Pressable>

              {features.toDiscussToggleEnabled === false && (
                <View
                  style={[
                    styles.studioCard,
                    {
                      backgroundColor: colors.backgroundElement,
                      borderColor: colors.textSecondary,
                      marginTop: 4,
                      marginBottom: 12,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.studioLabel,
                      { color: colors.text, fontFamily: resolveFont("bold") },
                    ]}
                  >
                    locked &quot;to discuss&quot; tab ({toDiscussEnabled ? "on" : "off"})
                  </Text>
                  <View style={styles.gridStepRow}>
                    {[false, true].map((val) => {
                      const isSelected = toDiscussEnabled === val;
                      return (
                        <Pressable
                          key={String(val)}
                          onPress={() => {
                            setToDiscussEnabled(val);
                            updateFeatures({ toDiscussDefaultEnabled: val });
                          }}
                          style={[
                            styles.gridStepChip,
                            {
                              backgroundColor: isSelected
                                ? colors.text
                                : colors.background,
                              borderColor: isSelected
                                ? colors.text
                                : colors.textSecondary,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.gridStepChipText,
                              {
                                color: isSelected
                                  ? colors.background
                                  : colors.text,
                                fontFamily: resolveFont(
                                  isSelected ? "bold" : "regular",
                                ),
                              },
                            ]}
                          >
                            {val ? "on" : "off"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              <View style={{ marginTop: 20 }}>
                <Pressable
                  onPress={() => setResetConfirmVisible(true)}
                  style={[
                    styles.dialogButton,
                    { backgroundColor: colors.backgroundElement },
                  ]}
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
                    Reset Appearance to Defaults
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={resetConfirmVisible}
        message={
          mode === "baked"
            ? "Reset all appearance settings back to baked build defaults?"
            : "Reset all appearance settings back to vanilla defaults?"
        }
        onConfirm={handleResetThemeConfirm}
        onCancel={() => setResetConfirmVisible(false)}
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
