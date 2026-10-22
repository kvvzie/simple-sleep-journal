import { File, Paths } from "expo-file-system";
import { readAsStringAsync, EncodingType, StorageAccessFramework } from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, TurboModuleRegistry } from "react-native";

export async function readTextFileFromUri(uri: string): Promise<string> {
  try {
    return await readAsStringAsync(uri, { encoding: EncodingType.UTF8 });
  } catch {
    const res = await fetch(uri);
    return await res.text();
  }
}

export type SaveFileOptions = {
  fileName: string;
  content: string;
  mimeType: string;
};

export type SaveFileResult = {
  success: boolean;
  canceled?: boolean;
  uri?: string;
  method?: "native-picker" | "saf-remembered" | "saf-picker" | "sharing";
};

export const SAVED_EXPORT_DIR_KEY = "@export_directory_uri";

export function isNativeDocumentPickerAvailable(): boolean {
  if (Platform.OS === "android") {
    return TurboModuleRegistry.get("RNDocumentPicker") != null;
  }
  return false;
}

export async function clearSavedExportDirectory(): Promise<void> {
  await AsyncStorage.removeItem(SAVED_EXPORT_DIR_KEY);
}

export async function getSavedExportDirectory(): Promise<string | null> {
  return await AsyncStorage.getItem(SAVED_EXPORT_DIR_KEY);
}

export async function saveFileToDevice({
  fileName,
  content,
  mimeType,
}: SaveFileOptions): Promise<SaveFileResult> {
  if (Platform.OS === "android") {
    if (isNativeDocumentPickerAvailable()) {
      const { saveDocuments, errorCodes } = require("@react-native-documents/picker");
      const tempFile = new File(Paths.cache, fileName);
      tempFile.create({ overwrite: true });
      tempFile.write(content);

      try {
        const response = await saveDocuments({
          sourceUris: [tempFile.uri],
          fileName,
          mimeType,
        });

        const savedUri = response?.[0]?.uri;
        return { success: true, uri: savedUri, method: "native-picker" };
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string };
        if (
          error?.code === errorCodes?.OPERATION_CANCELED ||
          error?.message?.toLowerCase().includes("cancel")
        ) {
          return { success: false, canceled: true };
        }
        throw err;
      } finally {
        try {
          tempFile.delete();
        } catch {}
      }
    }

    let dirUri = await AsyncStorage.getItem(SAVED_EXPORT_DIR_KEY);

    if (!dirUri) {
      const permissions =
        await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permissions.granted) {
        return { success: false, canceled: true };
      }
      dirUri = permissions.directoryUri;
      await AsyncStorage.setItem(SAVED_EXPORT_DIR_KEY, dirUri);
    }

    let destUri: string;
    try {
      destUri = await StorageAccessFramework.createFileAsync(
        dirUri,
        fileName,
        mimeType,
      );
    } catch {
      const permissions =
        await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permissions.granted) {
        return { success: false, canceled: true };
      }
      dirUri = permissions.directoryUri;
      await AsyncStorage.setItem(SAVED_EXPORT_DIR_KEY, dirUri);
      destUri = await StorageAccessFramework.createFileAsync(
        dirUri,
        fileName,
        mimeType,
      );
    }

    await StorageAccessFramework.writeAsStringAsync(destUri, content, {
      encoding: EncodingType.UTF8,
    });

    return { success: true, uri: destUri, method: "saf-remembered" };
  }

  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(content);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      dialogTitle: `Save ${fileName}`,
      mimeType,
    });
    return { success: true, uri: file.uri, method: "sharing" };
  }

  return { success: true, uri: file.uri };
}
