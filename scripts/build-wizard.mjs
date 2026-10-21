#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
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
};

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq > 0) {
        const key = arg.slice(2, eq);
        const val = arg.slice(eq + 1);
        args[key] = val;
      } else {
        args[arg.slice(2)] = true;
      }
    }
  }
  return args;
}

function imageFileToBase64DataUri(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  const buffer = fs.readFileSync(filePath);
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function run() {
  const args = parseArgs();
  const isInteractive = Object.keys(args).length === 0;

  let mode = args.mode || "dynamic";
  let appName = args.name || "";
  let packageId = args.packageId || "";
  let colorSchemeToggleEnabled = args.colorSchemeToggle !== undefined ? args.colorSchemeToggle !== "false" : true;
  let bodyCareEnabled = args.bodyCare !== undefined ? args.bodyCare !== "false" : true;
  let moodStarsEnabled = args.moodStars !== undefined ? args.moodStars !== "false" : true;
  let commentsEnabled = args.comments !== undefined ? args.comments !== "false" : true;
  let gridPickerEnabled = args.gridPicker !== undefined ? args.gridPicker !== "false" : true;
  let themeChoice = args.theme || "default";
  let fontPath = args.font || null;
  let fontNameChoice = args.fontName || null;
  let calendarBgPath = args.calendarBg || null;
  let settingsBgPath = args.settingsBg || null;

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

    const qBodyCare = (await rl.question("Enable razor blade tracker? [y/N/Y]: ")).trim().toLowerCase();
    bodyCareEnabled = qBodyCare !== "n" && qBodyCare !== "no";

    const qMoodStars = (await rl.question("Enable mood star ratings? [Y/n]: ")).trim().toLowerCase();
    moodStarsEnabled = qMoodStars !== "n" && qMoodStars !== "no";

    const qComments = (await rl.question("Enable daily comments / notes? [Y/n]: ")).trim().toLowerCase();
    commentsEnabled = qComments !== "n" && qComments !== "no";

    const qGrid = (await rl.question("Enable flexible grid size picker? [Y/n]: ")).trim().toLowerCase();
    gridPickerEnabled = qGrid !== "n" && qGrid !== "no";

    if (mode === "baked") {
      console.log("\n--- Baked Appearance Customization ---");
      console.log("Available color palettes:");
      console.log("  1) default   - Classic monochrome");
      console.log("  2) cyberpunk - Neon cyan on dark");
      console.log("  3) mocha     - Warm coffee tones");
      console.log("  4) matcha    - Forest green accents");
      console.log("  5) twilight  - Deep lavender & purple\n");

      const palInput = (await rl.question("Select palette [1-5] (default: 1): ")).trim();
      const palMap = { "1": "default", "2": "cyberpunk", "3": "mocha", "4": "matcha", "5": "twilight" };
      themeChoice = palMap[palInput] || "default";

      console.log("\nTypography:");
      console.log("  1) Redaction (Default)");
      console.log("  2) Comic Sans");
      console.log("  3) Custom .ttf/.otf file path\n");
      const fontOpt = (await rl.question("Select font [1-3] (default: 1): ")).trim();
      if (fontOpt === "2") {
        fontNameChoice = "ComicSans";
      } else if (fontOpt === "3") {
        const fPath = (await rl.question("Path to custom .ttf/.otf font file: ")).trim();
        if (fPath) fontPath = fPath;
      }

      const calBg = (await rl.question("Path to calendar background image (optional): ")).trim();
      if (calBg) calendarBgPath = calBg;

      const setBg = (await rl.question("Path to settings background image (optional): ")).trim();
      if (setBg) settingsBgPath = setBg;
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

  const selectedPalette = PALETTES[themeChoice] || {};

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
    fs.writeFileSync(APP_JSON_PATH, JSON.stringify(rawApp, null, 2));
    console.log(`[build-wizard] Updated ${APP_JSON_PATH}`);
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

  console.log("\n=======================================================");
  console.log("   BUILD CONFIGURATION APPLIED SUCCESSFULLY!");
  console.log(`   Mode:        ${mode}`);
  console.log(`   App Name:    ${appName}`);
  console.log(`   Package ID:  ${packageId}`);
  console.log(`   Features:    blades=${bodyCareEnabled}, stars=${moodStarsEnabled}, comments=${commentsEnabled}, gridPicker=${gridPickerEnabled}`);
  console.log("=======================================================\n");
}

run().catch((err) => {
  console.error("[build-wizard] Error:", err);
  process.exit(1);
});
