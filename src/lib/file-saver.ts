import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

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
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(content);

  try {
    const { saveDocuments } = require("@react-native-documents/picker");
    const results = await saveDocuments({
      sourceUris: [file.uri],
      fileName,
      mimeType,
    });

    if (results && results.length > 0) {
      const first = results[0];
      if (first.error) {
        throw new Error(first.error);
      }
      if (first.uri) {
        return { success: true, uri: first.uri };
      }
    }
  } catch (err: any) {
    const msg = String(err?.message ?? err).toLowerCase();
    if (
      msg.includes("cancel") ||
      msg.includes("user") ||
      msg.includes("aborted")
    ) {
      return { success: false, canceled: true };
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        dialogTitle: `Save ${fileName}`,
        mimeType,
      });
      return { success: true, uri: file.uri };
    }

    throw err;
  }

  return { success: false };
}
