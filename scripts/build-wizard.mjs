#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const BUILD_CONFIG_PATH = path.join(ROOT_DIR, "src/constants/build-config.json");
const APP_JSON_PATH = path.join(ROOT_DIR, "app.json");
const STRINGS_XML_PATH = path.join(ROOT_DIR, "android/app/src/main/res/values/strings.xml");
const BUILD_GRADLE_PATH = path.join(ROOT_DIR, "android/app/build.gradle");
const CUSTOM_FONTS_DIR = path.join(ROOT_DIR, "assets/fonts/custom");

const PALETTES = {
  default: {},
  cyberpunk: {
    dark: {
      background: "#090A0F",
      text: "#00FFCC",
      backgroundElement: "#141724",
      backgroundSelected: "#1F2538",
      textSecondary: "#5D707F",
    },
  },
  mocha: {
    dark: {
      background: "#1C1714",
      text: "#F5E2CF",
      backgroundElement: "#2A211D",
      backgroundSelected: "#3D302A",
      textSecondary: "#A38C7D",
    },
  },
  matcha: {
    dark: {
      background: "#101813",
      text: "#CBE8D0",
      backgroundElement: "#1A261F",
      backgroundSelected: "#273A2E",
      textSecondary: "#6E8B75",
    },
  },
  twilight: {
    dark: {
      background: "#18121E",
      text: "#F1D2FF",
      backgroundElement: "#271E30",
      backgroundSelected: "#3C2C4B",
      textSecondary: "#977CA8",
    },
  },
  playful: {
    dark: {
      background: "#1E0538",
      text: "#FFE600",
      backgroundElement: "#6B1D99",
      backgroundSelected: "#00FF99",
      textSecondary: "#FF70C5",
    },
    light: {
      background: "#FFF5FA",
      text: "#5A009D",
      backgroundElement: "#FFE0F0",
      backgroundSelected: "#00E5FF",
      textSecondary: "#FF1493",
    },
  },
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

function printHelp() {
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

Baked Theme & Color Palette Presets:
  --theme=<preset>                   (alias: --palette)
      playful   - Electric purple (#1E0538), neon yellow (#FFE600), pink (#FF70C5)
      cyberpunk - Neon cyan (#00FFCC) on deep dark (#090A0F)
      mocha     - Warm coffee tones (#1C1714 / #F5E2CF)
      matcha    - Forest green accents (#101813 / #CBE8D0)
      twilight  - Deep lavender & purple (#18121E / #F1D2FF)
      default   - Classic monochrome
      custom    - Custom hex palette configured via flags

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

Background Images (Divided into 2 separate options for Calendar and Settings):
  --calendar-bg=<path|none> (alias: --calendarBg, --calendar-image, --calendarImage)
                            File path to calendar screen wallpaper (set "none" to disable)
  --settings-bg=<path|none> (alias: --settingsBg, --settings-image, --settingsImage)
                            File path to settings screen wallpaper (set "none" to disable)

Help & Miscellaneous:
  -h, --help                Display this manual and exit
  --non-interactive         (alias: --ci)
                            Run without interactive prompts (defaults to interactive only if 0 flags given)

Examples:
  # 1. Custom baked build with custom hex colors, Comic Sans and cat calendar wallpaper:
  node scripts/build-wizard.mjs --mode=baked --name="Cat Journal" \\
    --bg="#1E0538" --text="#FFE600" --element="#6B1D99" --selected="#00FF99" --secondary="#FF70C5" \\
    --font-name=ComicSans --calendar-bg="assets/images/custom-cat-bg.png" --settings-bg=none

  # 2. Vanilla default build without razor blades tracker:
  node scripts/build-wizard.mjs --mode=default --body-care=false

  # 3. Dynamic build with all features enabled:
  node scripts/build-wizard.mjs --mode=dynamic --body-care=true --grid-picker=true
======================================================================
`);
}

function imageFileToBase64DataUri(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const tmpOut = path.join("/tmp", `build_opt_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`);
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

async function run() {
  const args = parseArgs();
  if (
    args.help ||
    args.h ||
    process.argv.includes("--help") ||
    process.argv.includes("-h") ||
    process.argv[2] === "help"
  ) {
    printHelp();
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

  let themeChoice =
    getArg(args, "theme", "palette") || (mode === "baked" ? "playful" : "default");

  let fontPath = getArg(args, "fontPath", "font-path", "customFont", "custom-font") || null;
  let fontNameChoice = getArg(args, "fontName", "font-name", "font") || (mode === "baked" ? "ComicSans" : null);
  if (fontPath && !fontNameChoice) {
    fontNameChoice = path.parse(fontPath).name;
  }

  let calArg = getArg(args, "calendarBg", "calendar-bg", "calendarImage", "calendar-image");
  let calendarBgPath = null;
  if (calArg !== undefined) {
    if (calArg !== "none" && calArg !== "null" && calArg !== "false") {
      calendarBgPath = path.isAbsolute(calArg) ? calArg : path.resolve(ROOT_DIR, calArg);
    }
  } else if (mode === "baked") {
    calendarBgPath = path.join(ROOT_DIR, "assets/images/custom-cat-bg.png");
  }

  let setArg = getArg(args, "settingsBg", "settings-bg", "settingsImage", "settings-image");
  let settingsBgPath = null;
  if (setArg !== undefined) {
    if (setArg !== "none" && setArg !== "null" && setArg !== "false") {
      settingsBgPath = path.isAbsolute(setArg) ? setArg : path.resolve(ROOT_DIR, setArg);
    }
  }

  let customColors = null;
  let customColorsLight = null;

  const bgHex = getArg(args, "bg", "colorBg", "color-bg", "background", "colorBackground", "color-background");
  const textHex = getArg(args, "text", "colorText", "color-text");
  const elemHex = getArg(args, "element", "colorElement", "color-element", "card", "cardBg", "card-bg");
  const selHex = getArg(args, "selected", "colorSelected", "color-selected", "accent", "colorAccent", "color-accent");
  const secHex = getArg(args, "secondary", "colorSecondary", "color-secondary", "textSecondary", "text-secondary");

  if (bgHex || textHex || elemHex || selHex || secHex) {
    themeChoice = "custom";
    customColors = {
      background: bgHex || "#1E0538",
      text: textHex || "#FFE600",
      backgroundElement: elemHex || "#6B1D99",
      backgroundSelected: selHex || "#00FF99",
      textSecondary: secHex || "#FF70C5",
    };
  }

  const lightBgHex = getArg(args, "lightBg", "light-bg", "colorLightBg", "color-light-bg", "lightBackground");
  const lightTextHex = getArg(args, "lightText", "light-text", "colorLightText", "color-light-text");
  const lightElemHex = getArg(args, "lightElement", "light-element", "colorLightElement", "color-light-element", "lightCard", "light-card");
  const lightSelHex = getArg(args, "lightSelected", "light-selected", "colorLightSelected", "color-light-selected", "lightAccent", "light-accent");
  const lightSecHex = getArg(args, "lightSecondary", "light-secondary", "lightTextSecondary", "light-text-secondary");

  if (lightBgHex || lightTextHex || lightElemHex || lightSelHex || lightSecHex) {
    customColorsLight = {
      background: lightBgHex || "#FFF5FA",
      text: lightTextHex || "#5A009D",
      backgroundElement: lightElemHex || "#FFE0F0",
      backgroundSelected: lightSelHex || "#00E5FF",
      textSecondary: lightSecHex || "#FF1493",
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
      console.log("Color palette configuration:");
      console.log("  1) Custom hex colors (type your own hex codes)");
      console.log("  2) Playful   - Electric purple, yellow & pink");
      console.log("  3) Cyberpunk - Neon cyan on dark");
      console.log("  4) Mocha     - Warm coffee tones");
      console.log("  5) Matcha    - Forest green accents");
      console.log("  6) Twilight  - Deep lavender & purple");
      console.log("  7) Default   - Classic monochrome\n");

      const palInput = (await rl.question("Select color source [1-7] (default: 1): ")).trim();
      const palMap = {
        "2": "playful",
        "3": "cyberpunk",
        "4": "mocha",
        "5": "matcha",
        "6": "twilight",
        "7": "default",
      };

      if (palMap[palInput]) {
        themeChoice = palMap[palInput];
      } else {
        themeChoice = "custom";
        console.log("\nEnter hex colors (press Enter for suggested vibrant defaults):");
        const bg = (await rl.question("Background color hex [#1E0538]: ")).trim() || "#1E0538";
        const txt = (await rl.question("Text color hex [#FFE600]: ")).trim() || "#FFE600";
        const elem = (await rl.question("Card / element background hex [#6B1D99]: ")).trim() || "#6B1D99";
        const sel = (await rl.question("Selected accent hex [#00FF99]: ")).trim() || "#00FF99";
        const sec = (await rl.question("Secondary / muted text hex [#FF70C5]: ")).trim() || "#FF70C5";

        customColors = {
          background: bg,
          text: txt,
          backgroundElement: elem,
          backgroundSelected: sel,
          textSecondary: sec,
        };
      }

      console.log("\nTypography:");
      console.log("  1) Redaction (Default)");
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

      console.log("\nBackground Images (Calendar & Settings):");
      const calBg = (await rl.question("Path to calendar background image [optional, default: cat]: ")).trim();
      if (calBg) {
        calendarBgPath = calBg === "none" ? null : (path.isAbsolute(calBg) ? calBg : path.resolve(process.cwd(), calBg));
      } else {
        calendarBgPath = path.join(ROOT_DIR, "assets/images/custom-cat-bg.png");
      }

      const setBg = (await rl.question("Path to settings background image [optional, default: none]: ")).trim();
      if (setBg && setBg !== "none") {
        settingsBgPath = path.isAbsolute(setBg) ? setBg : path.resolve(process.cwd(), setBg);
      } else {
        settingsBgPath = null;
      }
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

  let bakedFont = null;
  if (fontPath && fs.existsSync(fontPath)) {
    if (!fs.existsSync(CUSTOM_FONTS_DIR)) {
      fs.mkdirSync(CUSTOM_FONTS_DIR, { recursive: true });
    }
    const fontFileName = path.basename(fontPath);
    const destFont = path.join(CUSTOM_FONTS_DIR, fontFileName);
    fs.copyFileSync(fontPath, destFont);
    const fontName = path.parse(fontFileName).name;
    bakedFont = {
      name: fontName,
      dataUriOrPath: destFont,
    };
    console.log(`[build-wizard] Copied font to: ${destFont}`);
  } else if (fontNameChoice) {
    bakedFont = {
      name: fontNameChoice,
      dataUriOrPath: null,
    };
  }

  const calendarBase64 = imageFileToBase64DataUri(calendarBgPath);
  const settingsBase64 = imageFileToBase64DataUri(settingsBgPath);

  let selectedPalette = PALETTES[themeChoice]
    ? JSON.parse(JSON.stringify(PALETTES[themeChoice]))
    : {};
  if (customColors) {
    selectedPalette = {
      dark: {
        background: customColors.background,
        text: customColors.text,
        backgroundElement: customColors.backgroundElement,
        backgroundSelected: customColors.backgroundSelected,
        textSecondary: customColors.textSecondary,
      },
    };
    if (customColorsLight) {
      selectedPalette.light = {
        background: customColorsLight.background,
        text: customColorsLight.text,
        backgroundElement: customColorsLight.backgroundElement,
        backgroundSelected: customColorsLight.backgroundSelected,
        textSecondary: customColorsLight.textSecondary,
      };
    }
  }

  if (bgHex || textHex || elemHex || selHex || secHex) {
    if (!selectedPalette.dark) selectedPalette.dark = {};
    if (bgHex) selectedPalette.dark.background = bgHex;
    if (textHex) selectedPalette.dark.text = textHex;
    if (elemHex) selectedPalette.dark.backgroundElement = elemHex;
    if (selHex) selectedPalette.dark.backgroundSelected = selHex;
    if (secHex) selectedPalette.dark.textSecondary = secHex;
  }

  if (lightBgHex || lightTextHex || lightElemHex || lightSelHex || lightSecHex) {
    if (!selectedPalette.light) selectedPalette.light = {};
    if (lightBgHex) selectedPalette.light.background = lightBgHex;
    if (lightTextHex) selectedPalette.light.text = lightTextHex;
    if (lightElemHex) selectedPalette.light.backgroundElement = lightElemHex;
    if (lightSelHex) selectedPalette.light.backgroundSelected = lightSelHex;
    if (lightSecHex) selectedPalette.light.textSecondary = lightSecHex;
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
      name: themeChoice === "default" ? "Baked Custom" : `${themeChoice} Look`,
      version: 1,
      palette: selectedPalette,
      font: bakedFont,
      backgrounds: {
        calendar: calendarBase64,
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
    const cleanScheme = packageId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
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
  console.log(`   App Name:    ${appName}`);
  console.log(`   Package ID:  ${packageId}`);
  console.log(`   Features:    blades=${bodyCareEnabled}, stars=${moodStarsEnabled}, comments=${commentsEnabled}, todos=${todoListEnabled}, toDiscussSwitch=${toDiscussToggleEnabled}(default=${toDiscussDefaultEnabled}), gridPicker=${gridPickerEnabled}`);
  console.log("=======================================================\n");
}

run().catch((err) => {
  console.error("[build-wizard] Error:", err);
  process.exit(1);
});
