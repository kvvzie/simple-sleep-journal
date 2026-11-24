import { ThemePaletteColors } from "@/types/appearance";
import type { DateRangeSelection } from "@expo/ui/jetpack-compose";
import { Platform, View } from "react-native";

type ComposeUiModule = typeof import("@expo/ui/jetpack-compose");

type Props = {
  visible: boolean;
  startDate: string;
  endDate: string;
  colorScheme: "light" | "dark";
  colors: ThemePaletteColors;
  isoStartDate: string | null;
  isoEndDate: string | null;
  onSelectRange: (startDate: string, endDate: string) => void;
  onDismiss: () => void;
  extractIsoDate: (date: Date | null | undefined) => string;
};

/**
 * Checks at runtime whether the native binary includes Jetpack Compose
 * DateRangePickerDialogView (`@expo/ui` >= SDK 58), so older dev-client APKs
 * never crash with missing native ViewManager errors.
 */
export function isNativeDateRangePickerAvailable(): boolean {
  if (Platform.OS !== "android") return false;
  const expoGlobal = (globalThis as {
    expo?: { getViewConfig?: (moduleName: string, viewName?: string) => unknown };
  }).expo;
  if (typeof expoGlobal?.getViewConfig !== "function") return false;
  try {
    return Boolean(
      expoGlobal.getViewConfig("ExpoUI", "HostView") &&
        expoGlobal.getViewConfig("ExpoUI", "DateRangePickerDialogView"),
    );
  } catch {
    return false;
  }
}

export default function NativeDateRangePicker({
  visible,
  colorScheme,
  colors,
  isoStartDate,
  isoEndDate,
  onSelectRange,
  onDismiss,
  extractIsoDate,
}: Props) {
  if (!visible || !isNativeDateRangePickerAvailable()) {
    return null;
  }

  let composeUi: ComposeUiModule | null = null;
  try {
    // Lazy-require inside runtime capability guard so binaries without ExpoUI
    // DateRangePickerDialogView never load the native view manager adapter.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    composeUi = require("@expo/ui/jetpack-compose") as ComposeUiModule;
  } catch {
    return null;
  }

  if (!composeUi?.Host || !composeUi?.DateRangePickerDialog) {
    return null;
  }

  const { Host, DateRangePickerDialog } = composeUi;

  return (
    <View style={{ position: "absolute", width: 1, height: 1 }}>
      <Host colorScheme={colorScheme}>
        <DateRangePickerDialog
          initialStartDate={isoStartDate}
          initialEndDate={isoEndDate}
          variant="picker"
          showVariantToggle={true}
          confirmButtonLabel="apply"
          dismissButtonLabel="cancel"
          color={colors.text}
          elementColors={{
            containerColor: colors.modalBackground,
            titleContentColor: colors.textSecondary,
            headlineContentColor: colors.text,
            weekdayContentColor: colors.textSecondary,
            subheadContentColor: colors.text,
            navigationContentColor: colors.text,
            yearContentColor: colors.text,
            currentYearContentColor: colors.text,
            selectedYearContentColor: colors.background,
            selectedYearContainerColor: colors.text,
            dayContentColor: colors.text,
            selectedDayContentColor: colors.background,
            selectedDayContainerColor: colors.text,
            todayContentColor: colors.text,
            todayDateBorderColor: colors.text,
            dayInSelectionRangeContainerColor: colors.backgroundElement,
            dayInSelectionRangeContentColor: colors.text,
            dividerColor: colors.textSecondary,
          }}
          onDateRangeSelected={({ start, end }: DateRangeSelection) => {
            onSelectRange(extractIsoDate(start), extractIsoDate(end));
            onDismiss();
          }}
          onDismissRequest={onDismiss}
        />
      </Host>
    </View>
  );
}
