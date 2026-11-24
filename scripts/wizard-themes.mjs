import fs from "node:fs";
import path from "node:path";

const SUPPORTED_EXTENSIONS = new Set([".json", ".moodtheme"]);

function normalizeBackgroundValue(rawBg, keys) {
  if (!rawBg || typeof rawBg !== "object") return null;
  for (const key of keys) {
    if (typeof rawBg[key] === "string" && rawBg[key].trim().length > 0) {
      return rawBg[key].trim();
    }
  }
  return null;
}

export function parseThemeFile(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Theme file ${path.basename(filePath)} is not a JSON object`);
  }

  const target =
    raw.format === "simple-sleep-journal-theme" &&
    raw.theme &&
    typeof raw.theme === "object"
      ? raw.theme
      : raw;

  const id = path.parse(filePath).name;
  const name =
    typeof target.name === "string" && target.name.trim().length > 0
      ? target.name.trim()
      : id;
  const description =
    typeof target.description === "string" && target.description.trim().length > 0
      ? target.description.trim()
      : "";

  const palette = {};
  if (target.palette && typeof target.palette === "object") {
    if (target.palette.light && typeof target.palette.light === "object") {
      palette.light = { ...target.palette.light };
    }
    if (target.palette.dark && typeof target.palette.dark === "object") {
      palette.dark = { ...target.palette.dark };
    }
  }

  let font = null;
  if (target.font && typeof target.font === "object") {
    if (
      typeof target.font.name === "string" &&
      target.font.name.trim().length > 0
    ) {
      font = {
        name: target.font.name.trim(),
        dataUriOrPath:
          typeof target.font.dataUriOrPath === "string" &&
          target.font.dataUriOrPath.trim().length > 0
            ? target.font.dataUriOrPath.trim()
            : null,
      };
    }
  }

  const backgrounds = {
    calendar: normalizeBackgroundValue(target.backgrounds, [
      "calendarBase64",
      "calendar",
    ]),
    toDiscuss: normalizeBackgroundValue(target.backgrounds, [
      "toDiscussBase64",
      "toDiscuss",
      "weeklyRecapsBase64",
      "weeklyRecaps",
    ]),
    settings: normalizeBackgroundValue(target.backgrounds, [
      "settingsBase64",
      "settings",
    ]),
  };

  return {
    id,
    fileName: path.basename(filePath),
    filePath,
    name,
    description,
    palette,
    font,
    backgrounds,
  };
}

export function discoverThemes(themesDir) {
  if (!themesDir || !fs.existsSync(themesDir)) {
    return [];
  }

  const entries = fs.readdirSync(themesDir, { withFileTypes: true });
  const themes = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

    const fullPath = path.join(themesDir, entry.name);
    try {
      themes.push(parseThemeFile(fullPath));
    } catch {}
  }

  themes.sort((a, b) => {
    const aIsDefault = a.id.toLowerCase() === "default";
    const bIsDefault = b.id.toLowerCase() === "default";
    if (aIsDefault && !bIsDefault) return -1;
    if (!aIsDefault && bIsDefault) return 1;
    return a.id.localeCompare(b.id);
  });

  return themes;
}

export function resolveThemeChoice(choice, themes, rootDir) {
  if (!choice || typeof choice !== "string") return null;
  const trimmed = choice.trim();
  if (!trimmed || trimmed.toLowerCase() === "custom") return null;

  const lower = trimmed.toLowerCase();
  const byMeta = themes.find(
    (t) =>
      t.id.toLowerCase() === lower ||
      t.fileName.toLowerCase() === lower ||
      t.name.toLowerCase() === lower,
  );
  if (byMeta) return byMeta;

  const candidatePath = path.isAbsolute(trimmed)
    ? trimmed
    : path.resolve(rootDir, trimmed);
  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
    return parseThemeFile(candidatePath);
  }

  return null;
}

export function resolveBackgroundSpec(spec, rootDir, themeDir = rootDir) {
  if (!spec || typeof spec !== "string") return null;
  const trimmed = spec.trim();
  if (
    !trimmed ||
    trimmed.toLowerCase() === "none" ||
    trimmed.toLowerCase() === "null" ||
    trimmed.toLowerCase() === "false"
  ) {
    return null;
  }

  if (trimmed.startsWith("data:")) {
    return { type: "dataUri", value: trimmed };
  }

  const fromRoot = path.isAbsolute(trimmed)
    ? trimmed
    : path.resolve(rootDir, trimmed);
  if (fs.existsSync(fromRoot)) {
    return { type: "file", value: fromRoot };
  }

  const fromThemeDir = path.resolve(themeDir, trimmed);
  if (fs.existsSync(fromThemeDir)) {
    return { type: "file", value: fromThemeDir };
  }

  return { type: "file", value: fromRoot };
}
