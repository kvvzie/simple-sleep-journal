#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  discoverThemes,
  resolveBackgroundSpec,
  resolveThemeChoice,
} from "./wizard-themes.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const BUILD_CONFIG_PATH = path.join(ROOT_DIR, "src/constants/build-config.json");
const APP_JSON_PATH = path.join(ROOT_DIR, "app.json");
const STRINGS_XML_PATH = path.join(ROOT_DIR, "android/app/src/main/res/values/strings.xml");
const BUILD_GRADLE_PATH = path.join(ROOT_DIR, "android/app/build.gradle");
const CUSTOM_FONTS_DIR = path.join(ROOT_DIR, "assets/fonts/custom");
const THEMES_DIR = path.join(ROOT_DIR, "themes");

const NEUTRAL_DARK_DEFAULTS = {
  background: "#000000",
  text: "#ffffff",
  backgroundElement: "#212225",
  backgroundSelected: "#2E3135",
  textSecondary: "#B0B4BA",
};

const NEUTRAL_LIGHT_DEFAULTS = {
  background: "#ffffff",
  text: "#000000",
  backgroundElement: "#F0F0F3",
  backgroundSelected: "#E0E1E6",
  textSecondary: "#60646C",
};

function parseArgs() {
  const args = {};
  for (const rawArg of process.argv.slice(2)) {
    if (rawArg.startsWith("--")) {
      const eq = rawArg.indexOf("=");
      if (eq > 0) {
        const key = rawArg.slice(2, eq);
        const val = rawArg.slice(eq + 1);
        args[key] = val;
      } else {
        args[rawArg.slice(2)] = true;
      }
    } else if (rawArg.startsWith("-")) {
      args[rawArg.slice(1)] = true;
    }
  }
  return args;
}

function getArg(args, ...keys) {
  for (const k of keys) {
    if (args[k] !== undefined) return args[k];
    const kebab = k.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
    if (args[kebab] !== undefined) return args[kebab];
  }
  return undefined;
}

function getBoolArg(args, defaultValue, ...keys) {
  for (const k of keys) {
    const val = getArg(args, k);
    if (val !== undefined) {
      if (typeof val === "boolean") return val;
      const s = String(val).trim().toLowerCase();
      if (s === "true" || s === "1" || s === "y" || s === "yes") return true;
      if (s === "false" || s === "0" || s === "n" || s === "no") return false;
    }
    const noKey = "no-" + k.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
    if (args[noKey] !== undefined) return false;
  }
  return defaultValue;
}

function printHelp(discoveredThemes) {
  const themeLines =
    discoveredThemes.length > 0
      ? discoveredThemes
          .map(
            (t) =>
              `      ${t.id.padEnd(12)} - ${t.name}${t.description ? ` (${t.description})` : ""} [themes/${t.fileName}]`,
          )
          .join("\n")
      : "      (no theme files found in ./themes)";

  console.log(`
======================================================================
   SIMPLE SLEEP JOURNAL - BUILD WIZARD CLI REFERENCE
======================================================================

Usage:
  node scripts/build-wizard.mjs [options]

Modes:
  --mode=<default|baked|dynamic> (alias: -m)
      default  - Vanilla minimal Redaction styling, no Appearance Studio
      baked    - Compile-time custom theme, branding and features baked into build
      dynamic  - Full in-app customization (Appearance Studio with magic wand)

App Identity:
  --name="<AppName>"          (alias: --app-name, --appName)
                              Display name shown in Android launcher and title
  --package-id="<PackageId>"  (alias: --packageId, --pkg)
                              Android applicationId (e.g. com.shittyassapps.sleepinapp.baked)

Feature Toggles:
  --body-care=<true|false>           (alias: --bodyCare, --blades, --razor-blades, --no-blades)
                                     Enable razor blade self-harm tracker (default: dynamic=true, baked/default=false)
  --mood-stars=<true|false>          (alias: --moodStars, --stars, --no-stars)
                                     Enable 1-10 star ratings on daily logs (default: true)
  --comments=<true|false>            (alias: --comments, --notes, --daily-comments, --no-comments)
                                     Enable daily text notes and comments (default: true)
  --todo-list=<true|false>           (alias: --todoList, --todos, --todo, --no-todo-list)
                                     Enable to-do list with 3-day carryover (default: true)
  --to-discuss-toggle=<true|false>   (alias: --toDiscussToggle, --weekly-recaps-toggle, --no-to-discuss-toggle)
                                     Show "weekly recaps" switch in Settings (default: true)
  --to-discuss-default=<true|false>  (alias: --toDiscussDefault, --weekly-recaps, --to-discuss)
                                     Enable/disable the "weekly recaps" nav tab by default (default: true)
  --grid-picker=<true|false>         (alias: --gridPicker, --grid, --flexible-grid, --no-grid-picker)
                                     Enable flexible rows/cols stepper in settings (default: true)
  --color-scheme-toggle=<true|false> (alias: --colorSchemeToggle, --scheme-toggle, --no-color-scheme-toggle)
                                     Enable dark/light appearance switcher (default: true)
  --icon=<path>                      (alias: --app-icon, --appIcon)
                                     Custom launcher icon PNG for baked builds (default: assets/images/cat-icon.png)

Themes Directory (./themes/*.json or ./themes/*.moodtheme):
  Add your own JSON or exported .moodtheme files into ./themes/ to make
  them selectable in interactive mode or via --theme=<name>.
  --theme=<name|path|custom>         (alias: --palette)
${themeLines}
      custom       - Custom hex palette configured manually via flags

Dark Mode / Base Color Hex Flags:
  --color-bg=<#hex>         (alias: --bg, --background, --colorBg)
                            Main background color
  --color-text=<#hex>       (alias: --text, --colorText)
                            Primary text and logged calendar day color
  --color-element=<#hex>    (alias: --element, --colorElement, --card, --card-bg)
                            Card / dialog / element background color
  --color-selected=<#hex>   (alias: --selected, --colorSelected, --accent, --colorAccent)
                            Selected cell / accent highlight color
  --color-secondary=<#hex>  (alias: --secondary, --colorSecondary, --text-secondary, --textSecondary)
                            Muted secondary text and unlogged day color

Light Mode Color Hex Flags:
  --light-bg=<#hex>         (alias: --lightBg, --color-light-bg)
                            Light mode background color
  --light-text=<#hex>       (alias: --lightText, --color-light-text)
                            Light mode primary text color
  --light-element=<#hex>    (alias: --lightElement, --color-light-element, --light-card)
                            Light mode element / card background color
  --light-selected=<#hex>   (alias: --lightSelected, --color-light-selected, --light-accent)
                            Light mode selected / accent color
  --light-secondary=<#hex>  (alias: --lightSecondary, --color-light-secondary, --light-text-secondary)
                            Light mode muted secondary text color

Typography & Custom Fonts:
  --font-name=<name>        (alias: --fontName)
                            Pre-bundled font: "Redaction" or "ComicSans"
  --font-path=<path>        (alias: --fontPath, --font, --custom-font)
                            File path to custom .ttf or .otf font file

Background Images (Calendar, Weekly Recaps & Settings):
  --calendar-bg=<path|none>       (alias: --calendarBg, --calendar-image, --calendarImage)
                                  File path to calendar screen wallpaper (set "none" to disable)
  --weekly-recaps-bg=<path|none>  (alias: --weeklyRecapsBg, --to-discuss-bg, --toDiscussBg, --weekly-recaps-image, --to-discuss-image)
                                  File path to weekly recaps screen wallpaper (set "none" to disable)
  --settings-bg=<path|none>       (alias: --settingsBg, --settings-image, --settingsImage)
                                  File path to settings screen wallpaper (set "none" to disable)

Help & Miscellaneous:
  -h, --help                Display this manual and exit
  --non-interactive         (alias: --ci)
                            Run without interactive prompts (defaults to interactive only if 0 flags given)

Examples:
  # 1. Baked build using a theme file from ./themes/ with custom wallpapers:
  node scripts/build-wizard.mjs --mode=baked --name="My Journal" \\
    --theme=default --calendar-bg="assets/images/custom-cat-bg.png" \\
    --weekly-recaps-bg="assets/images/custom-cat-bg.png" --settings-bg=none

  # 2. Baked build with manually specified hex colors:
  node scripts/build-wizard.mjs --mode=baked --name="Custom Colors" \\
    --bg="#12131A" --text="#F4F4F8" --element="#1E202B" --selected="#2F3347" --secondary="#9499B3"

  # 3. Vanilla default build without razor blades tracker:
  node scripts/build-wizard.mjs --mode=default --body-care=false

  # 4. Dynamic build with all features enabled:
  node scripts/build-wizard.mjs --mode=dynamic --body-care=true --grid-picker=true
======================================================================
`);
}

function imageFileToBase64DataUri(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const tmpOut = path.join(
    "/tmp",
    `build_opt_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`,
  );
  try {
    execSync(
      `ffmpeg -y -i "${filePath}" -vf "scale=1080:-2" -q:v 4 "${tmpOut}" 2>/dev/null`,
    );
    const buffer = fs.readFileSync(tmpOut);
    try {
      fs.unlinkSync(tmpOut);
    } catch {}
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  } catch {
    const ext = path.extname(filePath).toLowerCase();
    const mime =
      ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    const buffer = fs.readFileSync(filePath);
    return `data:${mime};base64,${buffer.toString("base64")}`;
  }
}

function resolveBackgroundDataUri(spec, themeDir) {
  const resolved = resolveBackgroundSpec(spec, ROOT_DIR, themeDir);
  if (!resolved) return null;
  if (resolved.type === "dataUri") return resolved.value;
  return imageFileToBase64DataUri(resolved.value);
}

async function run() {
  const discoveredThemes = discoverThemes(THEMES_DIR);
  const args = parseArgs();

  if (
    args.help ||
    args.h ||
    process.argv.includes("--help") ||
    process.argv.includes("-h") ||
    process.argv[2] === "help"
  ) {
    printHelp(discoveredThemes);
    process.exit(0);
  }

  const isInteractive = Object.keys(args).length === 0;

  let mode = getArg(args, "mode", "m") || "dynamic";
  let appName = getArg(args, "appName", "app-name", "name") || "";
  let packageId = getArg(args, "packageId", "package-id", "pkg", "package") || "";

  let colorSchemeToggleEnabled = getBoolArg(
    args,
    true,
    "colorSchemeToggle",
    "color-scheme-toggle",
    "schemeToggle",
    "scheme-toggle",
  );
  let bodyCareEnabled = getBoolArg(
    args,
    mode === "dynamic",
    "bodyCare",
    "body-care",
    "blades",
    "razorBlades",
    "razor-blades",
  );
  let moodStarsEnabled = getBoolArg(args, true, "moodStars", "mood-stars", "stars");
  let commentsEnabled = getBoolArg(
    args,
    true,
    "comments",
    "notes",
    "dailyComments",
    "daily-comments",
  );
  let todoListEnabled = getBoolArg(
    args,
    true,
    "todoList",
    "todo-list",
    "todos",
    "todo",
  );
  let toDiscussToggleEnabled = getBoolArg(
    args,
    true,
    "toDiscussToggle",
    "to-discuss-toggle",
    "weeklyRecapsToggle",
    "weekly-recaps-toggle",
  );
  let toDiscussDefaultEnabled = getBoolArg(
    args,
    true,
    "toDiscussDefault",
    "to-discuss-default",
    "toDiscuss",
    "to-discuss",
    "weeklyRecapsDefault",
    "weekly-recaps-default",
    "weeklyRecaps",
    "weekly-recaps",
  );
  let customIconArg = getArg(args, "icon", "appIcon", "app-icon") || null;
  let gridPickerEnabled = getBoolArg(
    args,
    true,
    "gridPicker",
    "grid-picker",
    "grid",
    "flexibleGrid",
    "flexible-grid",
  );

  const rawThemeArg = getArg(args, "theme", "palette");
  let selectedThemeFile =
    rawThemeArg && String(rawThemeArg).toLowerCase() !== "custom"
      ? resolveThemeChoice(String(rawThemeArg), discoveredThemes, ROOT_DIR)
      : !rawThemeArg && !isInteractive
        ? resolveThemeChoice("default", discoveredThemes, ROOT_DIR)
        : null;

  if (
    rawThemeArg &&
    String(rawThemeArg).toLowerCase() !== "custom" &&
    !selectedThemeFile
  ) {
    const available = discoveredThemes.map((t) => t.id).join(", ") || "none";
    throw new Error(
      `Unknown theme "${rawThemeArg}". Place a JSON/.moodtheme file in ./themes/ or pass --theme=custom. Available themes: ${available}`,
    );
  }

  let themeDisplayName = selectedThemeFile ? selectedThemeFile.name : "Baked Custom";

  let fontPath = getArg(args, "fontPath", "font-path", "customFont", "custom-font") || null;
  let fontNameChoice = getArg(args, "fontName", "font-name", "font") || null;
  if (fontPath && !fontNameChoice) {
    fontNameChoice = path.parse(fontPath).name;
  }

  let calBgSpec = getArg(args, "calendarBg", "calendar-bg", "calendarImage", "calendar-image");
  let toDiscussBgSpec = getArg(
    args,
    "weeklyRecapsBg",
    "weekly-recaps-bg",
    "toDiscussBg",
    "to-discuss-bg",
    "weeklyRecapsImage",
    "weekly-recaps-image",
    "toDiscussImage",
    "to-discuss-image",
  );
  let setBgSpec = getArg(args, "settingsBg", "settings-bg", "settingsImage", "settings-image");

  let customColors = null;
  let customColorsLight = null;

  const bgHex = getArg(args, "bg", "colorBg", "color-bg", "background", "colorBackground", "color-background");
  const textHex = getArg(args, "text", "colorText", "color-text");
  const elemHex = getArg(args, "element", "colorElement", "color-element", "card", "cardBg", "card-bg");
  const selHex = getArg(args, "selected", "colorSelected", "color-selected", "accent", "colorAccent", "color-accent");
  const secHex = getArg(args, "secondary", "colorSecondary", "color-secondary", "textSecondary", "text-secondary");

  if (bgHex || textHex || elemHex || selHex || secHex) {
    customColors = {
      ...(bgHex ? { background: bgHex } : {}),
      ...(textHex ? { text: textHex } : {}),
      ...(elemHex ? { backgroundElement: elemHex } : {}),
      ...(selHex ? { backgroundSelected: selHex } : {}),
      ...(secHex ? { textSecondary: secHex } : {}),
    };
  }

  const lightBgHex = getArg(args, "lightBg", "light-bg", "colorLightBg", "color-light-bg", "lightBackground");
  const lightTextHex = getArg(args, "lightText", "light-text", "colorLightText", "color-light-text");
  const lightElemHex = getArg(args, "lightElement", "light-element", "colorLightElement", "color-light-element", "lightCard", "light-card");
  const lightSelHex = getArg(args, "lightSelected", "light-selected", "colorLightSelected", "color-light-selected", "lightAccent", "light-accent");
  const lightSecHex = getArg(args, "lightSecondary", "light-secondary", "lightTextSecondary", "light-text-secondary");

  if (lightBgHex || lightTextHex || lightElemHex || lightSelHex || lightSecHex) {
    customColorsLight = {
      ...(lightBgHex ? { background: lightBgHex } : {}),
      ...(lightTextHex ? { text: lightTextHex } : {}),
      ...(lightElemHex ? { backgroundElement: lightElemHex } : {}),
      ...(lightSelHex ? { backgroundSelected: lightSelHex } : {}),
      ...(lightSecHex ? { textSecondary: lightSecHex } : {}),
    };
  }

  if (isInteractive) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\n=======================================================");
    console.log("   SIMPLE SLEEP JOURNAL - BUILD WIZARD");
    console.log("=======================================================\n");

    console.log("Choose build mode:");
    console.log("  1) default  - Pure vanilla, minimal Redaction styling");
    console.log("  2) baked    - Static custom theme/branding baked into build");
    console.log("  3) dynamic  - Fully customizable in-app (Appearance Studio)\n");

    const modeInput = (await rl.question("Select mode [1/2/3] (default: 3): ")).trim();
    if (modeInput === "1" || modeInput.toLowerCase() === "default") {
      mode = "default";
    } else if (modeInput === "2" || modeInput.toLowerCase() === "baked") {
      mode = "baked";
    } else {
      mode = "dynamic";
    }

    const defaultAppName =
      mode === "baked"
        ? "mood journal (baked)"
        : mode === "default"
          ? "mood journal (default)"
          : "mood journal (dynamic)";

    const defaultPackage =
      mode === "baked"
        ? "com.shittyassapps.sleepinapp.baked"
        : mode === "default"
          ? "com.shittyassapps.sleepinapp.default"
          : "com.shittyassapps.sleepinapp.dynamic";

    appName = (await rl.question(`App name [${defaultAppName}]: `)).trim() || defaultAppName;
    packageId = (await rl.question(`Package ID [${defaultPackage}]: `)).trim() || defaultPackage;

    console.log("\n--- Feature Toggles ---");
    const qSchemeToggle = (await rl.question("Enable color scheme switcher? [Y/n]: ")).trim().toLowerCase();
    colorSchemeToggleEnabled = qSchemeToggle !== "n" && qSchemeToggle !== "no";

    const qBodyCare = (await rl.question("Enable razor blade tracker? [y/N]: ")).trim().toLowerCase();
    bodyCareEnabled = qBodyCare === "y" || qBodyCare === "yes";

    const qMoodStars = (await rl.question("Enable mood star ratings? [Y/n]: ")).trim().toLowerCase();
    moodStarsEnabled = qMoodStars !== "n" && qMoodStars !== "no";

    const qComments = (await rl.question("Enable daily comments / notes? [Y/n]: ")).trim().toLowerCase();
    commentsEnabled = qComments !== "n" && qComments !== "no";

    const qTodoList = (await rl.question("Enable to-do list? [Y/n]: ")).trim().toLowerCase();
    todoListEnabled = qTodoList !== "n" && qTodoList !== "no";

    const qToDiscussToggle = (await rl.question('Show "weekly recaps" switch in Settings? [Y/n]: ')).trim().toLowerCase();
    toDiscussToggleEnabled = qToDiscussToggle !== "n" && qToDiscussToggle !== "no";
    if (!toDiscussToggleEnabled) {
      const qToDiscussDefault = (await rl.question('Enable "weekly recaps" tab when locked? [Y/n]: ')).trim().toLowerCase();
      toDiscussDefaultEnabled = qToDiscussDefault !== "n" && qToDiscussDefault !== "no";
    }

    const qGrid = (await rl.question("Enable flexible grid size picker? [Y/n]: ")).trim().toLowerCase();
    gridPickerEnabled = qGrid !== "n" && qGrid !== "no";

    if (mode === "baked") {
      console.log("\n--- Baked Appearance Customization ---");
      console.log("Themes discovered in ./themes:");
      console.log("  1) Custom (enter your own hex colors manually)");
      discoveredThemes.forEach((t, idx) => {
        const desc = t.description ? ` - ${t.description}` : "";
        console.log(`  ${idx + 2}) ${t.name} (themes/${t.fileName})${desc}`);
      });
      console.log("");

      const maxOption = discoveredThemes.length + 1;
      const defaultOpt = discoveredThemes.length > 0 ? "2" : "1";
      const palInput = (
        await rl.question(`Select theme [1-${maxOption}] (default: ${defaultOpt}): `)
      ).trim() || defaultOpt;

      const numericChoice = Number.parseInt(palInput, 10);
      if (
        Number.isFinite(numericChoice) &&
        numericChoice >= 2 &&
        numericChoice <= maxOption
      ) {
        selectedThemeFile = discoveredThemes[numericChoice - 2];
        themeDisplayName = selectedThemeFile.name;
      } else {
        selectedThemeFile = null;
        themeDisplayName = "Custom";
        console.log("\nEnter dark mode hex colors (press Enter to keep default monochrome):");
        const bg = (await rl.question(`Background color hex [${NEUTRAL_DARK_DEFAULTS.background}]: `)).trim() || NEUTRAL_DARK_DEFAULTS.background;
        const txt = (await rl.question(`Text color hex [${NEUTRAL_DARK_DEFAULTS.text}]: `)).trim() || NEUTRAL_DARK_DEFAULTS.text;
        const elem = (await rl.question(`Card / element background hex [${NEUTRAL_DARK_DEFAULTS.backgroundElement}]: `)).trim() || NEUTRAL_DARK_DEFAULTS.backgroundElement;
        const sel = (await rl.question(`Selected accent hex [${NEUTRAL_DARK_DEFAULTS.backgroundSelected}]: `)).trim() || NEUTRAL_DARK_DEFAULTS.backgroundSelected;
        const sec = (await rl.question(`Secondary / muted text hex [${NEUTRAL_DARK_DEFAULTS.textSecondary}]: `)).trim() || NEUTRAL_DARK_DEFAULTS.textSecondary;

        customColors = {
          background: bg,
          text: txt,
          backgroundElement: elem,
          backgroundSelected: sel,
          textSecondary: sec,
        };

        const qLight = (await rl.question("Configure custom light mode colors too? [y/N]: ")).trim().toLowerCase();
        if (qLight === "y" || qLight === "yes") {
          const lBg = (await rl.question(`Light background hex [${NEUTRAL_LIGHT_DEFAULTS.background}]: `)).trim() || NEUTRAL_LIGHT_DEFAULTS.background;
          const lTxt = (await rl.question(`Light text hex [${NEUTRAL_LIGHT_DEFAULTS.text}]: `)).trim() || NEUTRAL_LIGHT_DEFAULTS.text;
          const lElem = (await rl.question(`Light card / element hex [${NEUTRAL_LIGHT_DEFAULTS.backgroundElement}]: `)).trim() || NEUTRAL_LIGHT_DEFAULTS.backgroundElement;
          const lSel = (await rl.question(`Light selected accent hex [${NEUTRAL_LIGHT_DEFAULTS.backgroundSelected}]: `)).trim() || NEUTRAL_LIGHT_DEFAULTS.backgroundSelected;
          const lSec = (await rl.question(`Light secondary text hex [${NEUTRAL_LIGHT_DEFAULTS.textSecondary}]: `)).trim() || NEUTRAL_LIGHT_DEFAULTS.textSecondary;

          customColorsLight = {
            background: lBg,
            text: lTxt,
            backgroundElement: lElem,
            backgroundSelected: lSel,
            textSecondary: lSec,
          };
        }
      }

      const themeFontLabel = selectedThemeFile?.font?.name
        ? `Keep theme font (${selectedThemeFile.font.name})`
        : "Redaction (Default)";
      console.log("\nTypography:");
      console.log(`  1) ${themeFontLabel}`);
      console.log("  2) Comic Sans");
      console.log("  3) Custom .ttf/.otf file path\n");
      const fontOpt = (await rl.question("Select font [1-3] (default: 1): ")).trim();
      if (fontOpt === "2") {
        fontNameChoice = "ComicSans";
      } else if (fontOpt === "3") {
        const fPath = (await rl.question("Path to custom .ttf/.otf font file: ")).trim();
        if (fPath) {
          fontPath = path.isAbsolute(fPath) ? fPath : path.resolve(process.cwd(), fPath);
        }
      }

      const calHint = selectedThemeFile?.backgrounds?.calendar
        ? "theme default, or enter path / none"
        : "optional, default: none";
      const tdHint = selectedThemeFile?.backgrounds?.toDiscuss
        ? "theme default, or enter path / none"
        : "optional, default: none";
      const setHint = selectedThemeFile?.backgrounds?.settings
        ? "theme default, or enter path / none"
        : "optional, default: none";

      console.log("\nBackground Images (Calendar, Weekly Recaps & Settings):");
      const calBg = (await rl.question(`Path to calendar background image [${calHint}]: `)).trim();
      if (calBg) calBgSpec = calBg;

      const tdBg = (await rl.question(`Path to weekly recaps background image [${tdHint}]: `)).trim();
      if (tdBg) toDiscussBgSpec = tdBg;

      const setBg = (await rl.question(`Path to settings background image [${setHint}]: `)).trim();
      if (setBg) setBgSpec = setBg;
    }

    rl.close();
  } else {
    if (!appName) {
      appName =
        mode === "baked"
          ? "mood journal (baked)"
          : mode === "default"
            ? "mood journal (default)"
            : "mood journal (dynamic)";
    }
    if (!packageId) {
      packageId =
        mode === "baked"
          ? "com.shittyassapps.sleepinapp.baked"
          : mode === "default"
            ? "com.shittyassapps.sleepinapp.default"
            : "com.shittyassapps.sleepinapp.dynamic";
    }
  }

  const themeDir = selectedThemeFile ? path.dirname(selectedThemeFile.filePath) : THEMES_DIR;

  let bakedFont = null;
  const effectiveFontPath =
    fontPath ||
    (selectedThemeFile?.font?.dataUriOrPath &&
    !selectedThemeFile.font.dataUriOrPath.startsWith("data:")
      ? path.isAbsolute(selectedThemeFile.font.dataUriOrPath)
        ? selectedThemeFile.font.dataUriOrPath
        : path.resolve(ROOT_DIR, selectedThemeFile.font.dataUriOrPath)
      : null);

  if (effectiveFontPath && fs.existsSync(effectiveFontPath)) {
    if (!fs.existsSync(CUSTOM_FONTS_DIR)) {
      fs.mkdirSync(CUSTOM_FONTS_DIR, { recursive: true });
    }
    const fontFileName = path.basename(effectiveFontPath);
    const destFont = path.join(CUSTOM_FONTS_DIR, fontFileName);
    if (path.resolve(effectiveFontPath) !== path.resolve(destFont)) {
      fs.copyFileSync(effectiveFontPath, destFont);
    }
    const fontName = fontNameChoice || selectedThemeFile?.font?.name || path.parse(fontFileName).name;
    bakedFont = {
      name: fontName,
      dataUriOrPath: destFont,
    };
    console.log(`[build-wizard] Font configured from: ${destFont}`);
  } else if (fontNameChoice) {
    bakedFont = {
      name: fontNameChoice,
      dataUriOrPath: null,
    };
  } else if (selectedThemeFile?.font) {
    bakedFont = { ...selectedThemeFile.font };
  }

  const finalCalendarSpec =
    calBgSpec !== undefined ? calBgSpec : selectedThemeFile?.backgrounds?.calendar || null;
  const finalToDiscussSpec =
    toDiscussBgSpec !== undefined
      ? toDiscussBgSpec
      : selectedThemeFile?.backgrounds?.toDiscuss || null;
  const finalSettingsSpec =
    setBgSpec !== undefined ? setBgSpec : selectedThemeFile?.backgrounds?.settings || null;

  const calendarBase64 = resolveBackgroundDataUri(finalCalendarSpec, themeDir);
  const toDiscussBase64 = resolveBackgroundDataUri(finalToDiscussSpec, themeDir);
  const settingsBase64 = resolveBackgroundDataUri(finalSettingsSpec, themeDir);

  let selectedPalette = selectedThemeFile?.palette
    ? JSON.parse(JSON.stringify(selectedThemeFile.palette))
    : {};

  if (customColors) {
    selectedPalette.dark = {
      ...(selectedPalette.dark || {}),
      ...customColors,
    };
  }

  if (customColorsLight) {
    selectedPalette.light = {
      ...(selectedPalette.light || {}),
      ...customColorsLight,
    };
  }

  const inAppCustomizationEnabled = mode === "dynamic";

  const buildConfig = {
    mode,
    appName,
    packageId,
    features: {
      colorSchemeToggleEnabled,
      bodyCareEnabled,
      moodStarsEnabled,
      commentsEnabled,
      todoListEnabled,
      toDiscussToggleEnabled,
      toDiscussDefaultEnabled,
      gridPickerEnabled,
      inAppCustomizationEnabled,
    },
    lockedGrid: gridPickerEnabled ? null : { rows: 7, columns: 5 },
    bakedTheme: {
      name: themeDisplayName,
      version: 1,
      palette: selectedPalette,
      font: bakedFont,
      backgrounds: {
        calendar: calendarBase64,
        toDiscuss: toDiscussBase64,
        settings: settingsBase64,
      },
      features: {
        colorSchemeToggleEnabled,
        bodyCareEnabled,
        moodStarsEnabled,
        commentsEnabled,
        todoListEnabled,
        toDiscussToggleEnabled,
        toDiscussDefaultEnabled,
        gridPickerEnabled,
        inAppCustomizationEnabled,
      },
    },
  };

  fs.writeFileSync(BUILD_CONFIG_PATH, JSON.stringify(buildConfig, null, 2));
  console.log(`[build-wizard] Updated ${BUILD_CONFIG_PATH}`);

  if (fs.existsSync(APP_JSON_PATH)) {
    const rawApp = JSON.parse(fs.readFileSync(APP_JSON_PATH, "utf8"));
    rawApp.expo.name = appName;
    const cleanScheme =
      packageId === "com.shittyassapps.sleepinapp"
        ? "sleepinapp"
        : packageId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    rawApp.expo.scheme = cleanScheme;
    if (rawApp.expo.android) {
      rawApp.expo.android.package = packageId;
    }
    if (rawApp.expo.ios) {
      rawApp.expo.ios.bundleIdentifier = packageId;
    }
    const resolvedBakedIcon = (() => {
      if (customIconArg) {
        const p = path.isAbsolute(customIconArg)
          ? customIconArg
          : path.resolve(ROOT_DIR, customIconArg);
        if (fs.existsSync(p)) return p;
      }
      const candidates = [
        path.join(ROOT_DIR, "assets/images/cat-icon.png"),
        path.join(ROOT_DIR, "assets/images/icon-cat.png"),
      ];
      return candidates.find((c) => fs.existsSync(c)) || null;
    })();

    if (mode === "baked" && resolvedBakedIcon) {
      const relIcon = path.relative(ROOT_DIR, resolvedBakedIcon).replace(/\\/g, "/");
      rawApp.expo.icon = relIcon.startsWith(".") ? relIcon : `./${relIcon}`;
    } else {
      rawApp.expo.icon = "./assets/images/icon.png";
    }
    fs.writeFileSync(APP_JSON_PATH, JSON.stringify(rawApp, null, 2));
    console.log(`[build-wizard] Updated ${APP_JSON_PATH}`);

    try {
      if (mode === "baked" && resolvedBakedIcon) {
        const SIZES = [
          { dir: path.join(ROOT_DIR, "android/app/src/main/res/mipmap-mdpi"), legacy: 48, adaptive: 108 },
          { dir: path.join(ROOT_DIR, "android/app/src/main/res/mipmap-hdpi"), legacy: 72, adaptive: 162 },
          { dir: path.join(ROOT_DIR, "android/app/src/main/res/mipmap-xhdpi"), legacy: 96, adaptive: 216 },
          { dir: path.join(ROOT_DIR, "android/app/src/main/res/mipmap-xxhdpi"), legacy: 144, adaptive: 324 },
          { dir: path.join(ROOT_DIR, "android/app/src/main/res/mipmap-xxxhdpi"), legacy: 192, adaptive: 432 },
        ];
        for (const item of SIZES) {
          if (fs.existsSync(item.dir)) {
            const legacyFilter = `scale=${item.legacy}:${item.legacy}:force_original_aspect_ratio=increase,crop=${item.legacy}:${item.legacy}`;
            const adaptiveFilter = `scale=${item.adaptive}:${item.adaptive}:force_original_aspect_ratio=increase,crop=${item.adaptive}:${item.adaptive}`;
            execSync(
              `ffmpeg -y -i "${resolvedBakedIcon}" -vf "${legacyFilter}" "${path.join(item.dir, "ic_launcher.webp")}" 2>/dev/null`,
            );
            execSync(
              `ffmpeg -y -i "${resolvedBakedIcon}" -vf "${legacyFilter}" "${path.join(item.dir, "ic_launcher_round.webp")}" 2>/dev/null`,
            );
            execSync(
              `ffmpeg -y -i "${resolvedBakedIcon}" -vf "${adaptiveFilter}" "${path.join(item.dir, "ic_launcher_foreground.webp")}" 2>/dev/null`,
            );
            execSync(
              `ffmpeg -y -i "${resolvedBakedIcon}" -vf "${adaptiveFilter}" "${path.join(item.dir, "ic_launcher_background.webp")}" 2>/dev/null`,
            );
            execSync(
              `ffmpeg -y -i "${resolvedBakedIcon}" -vf "${adaptiveFilter},format=gray" "${path.join(item.dir, "ic_launcher_monochrome.webp")}" 2>/dev/null`,
            );
          }
        }
        console.log(`[build-wizard] Updated Android legacy & adaptive mipmap icons from ${path.basename(resolvedBakedIcon)}`);
      } else {
        const backupDir = path.join(ROOT_DIR, "android/app/src/main/res-vanilla-backup");
        if (fs.existsSync(backupDir)) {
          const entries = fs.readdirSync(backupDir);
          for (const entry of entries) {
            const src = path.join(backupDir, entry);
            const dest = path.join(ROOT_DIR, "android/app/src/main/res", entry);
            if (fs.existsSync(src) && fs.existsSync(dest)) {
              fs.cpSync(src, dest, { recursive: true });
            }
          }
          console.log("[build-wizard] Restored vanilla Android launcher mipmap icons");
        }
      }
    } catch (iconErr) {
      console.warn("[build-wizard] Icon update warning:", iconErr?.message || iconErr);
    }
  }

  if (fs.existsSync(STRINGS_XML_PATH)) {
    let stringsXml = fs.readFileSync(STRINGS_XML_PATH, "utf8");
    stringsXml = stringsXml.replace(
      /<string name="app_name">.*?<\/string>/,
      `<string name="app_name">${appName}</string>`,
    );
    fs.writeFileSync(STRINGS_XML_PATH, stringsXml);
    console.log(`[build-wizard] Updated ${STRINGS_XML_PATH} with app_name: "${appName}"`);
  }

  if (fs.existsSync(BUILD_GRADLE_PATH)) {
    let gradle = fs.readFileSync(BUILD_GRADLE_PATH, "utf8");
    gradle = gradle.replace(
      /applicationId\s+['"][^'"]+['"]/,
      `applicationId '${packageId}'`,
    );
    fs.writeFileSync(BUILD_GRADLE_PATH, gradle);
    console.log(`[build-wizard] Updated ${BUILD_GRADLE_PATH} with applicationId: '${packageId}'`);
  }

  try {
    const bundleOutputDir = path.join(ROOT_DIR, "android/app/build/generated/assets/react/release");
    const assetsOutputDir = path.join(ROOT_DIR, "android/app/build/intermediates/assets/release");
    if (fs.existsSync(bundleOutputDir)) {
      fs.rmSync(bundleOutputDir, { recursive: true, force: true });
    }
    if (fs.existsSync(assetsOutputDir)) {
      fs.rmSync(assetsOutputDir, { recursive: true, force: true });
    }
  } catch {}

  console.log("\n=======================================================");
  console.log("   BUILD CONFIGURATION APPLIED SUCCESSFULLY!");
  console.log(`   Mode:        ${mode}`);
  console.log(`   Theme:       ${themeDisplayName}`);
  console.log(`   App Name:    ${appName}`);
  console.log(`   Package ID:  ${packageId}`);
  console.log(`   Features:    blades=${bodyCareEnabled}, stars=${moodStarsEnabled}, comments=${commentsEnabled}, todos=${todoListEnabled}, toDiscussSwitch=${toDiscussToggleEnabled}(default=${toDiscussDefaultEnabled}), gridPicker=${gridPickerEnabled}`);
  console.log("=======================================================\n");
}

run().catch((err) => {
  console.error("[build-wizard] Error:", err);
  process.exit(1);
});
