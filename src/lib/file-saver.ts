import { File, Paths } from "expo-file-system";
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
      const destinationFile = new File(result.data);
      destinationFile.write(content);
      return { success: true, uri: result.data };
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
