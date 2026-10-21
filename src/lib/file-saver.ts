import { File, Paths } from "expo-file-system";
import { EncodingType, StorageAccessFramework } from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

export type SaveFileOptions = {
  fileName: string;
  content: string;
  mimeType: string;
};

export type SaveFileResult = {
  success: boolean;
  canceled?: boolean;
  uri?: string;
};

export function extractUriFromIntentData(raw: string): string {
  if (raw.startsWith("content://") || raw.startsWith("file://")) {
    return raw;
  }
  const match = raw.match(/dat=([^\s}]+)/);
  if (match) {
    let uri = match[1];
    if (uri.startsWith("content:/") && !uri.startsWith("content://")) {
      uri = "content://" + uri.slice("content:/".length);
    }
    return uri;
  }
  return raw;
}

export async function saveFileToDevice({
  fileName,
  content,
  mimeType,
}: SaveFileOptions): Promise<SaveFileResult> {
  if (Platform.OS === "android") {
    const result = await IntentLauncher.startActivityAsync(
      "android.intent.action.CREATE_DOCUMENT",
      {
        category: "android.intent.category.OPENABLE",
        type: mimeType,
        extra: {
          "android.intent.extra.TITLE": fileName,
        },
        flags: 3,
      },
    );

    if (result.resultCode === IntentLauncher.ResultCode.Success && result.data) {
      const targetUri = extractUriFromIntentData(result.data);

      try {
        await StorageAccessFramework.writeAsStringAsync(targetUri, content, {
          encoding: EncodingType.UTF8,
        });
      } catch {
        const destinationFile = new File(targetUri);
        destinationFile.write(content);
      }

      return { success: true, uri: targetUri };
    }

    return { success: false, canceled: true };
  }

  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(content);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      dialogTitle: `Save ${fileName}`,
      mimeType,
    });
    return { success: true, uri: file.uri };
  }

  return { success: false };
}
