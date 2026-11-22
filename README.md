# simple-sleep-journal

A minimalist, privacy-first, offline sleep and mood journal with an optional razor blade usage counter (**Body Care / Self-Harm Tracker**). Built with **React Native (0.88.1)**, **Expo SDK 58**, **Expo Router**, a local **SQLite** database, and a **Three-Tier Build & Runtime Customization System**.

---

## Key Features

### 1. Interactive Paged Calendar Grid
- **Adaptive Grid Sizes**: 5 customizable aspect ratios (`4x8`, `5x7`, `6x6`, `7x5`, `8x4`) with independent responsive persistence for standard vs. wide screens (phones, foldables, tablets).
- **Three-Level Synchronized Pagination**:
  - Year slider with pre-measured dynamic container width.
  - Month slider with pre-measured width scaling and overflow protection for custom fonts.
  - Preloaded day grid (`GRID_RENDER_RADIUS = 2`) with immediate logged-state rendering and spring transition (`0.98 -> 1`) triggered at swipe start.
- **5 Semantic Day States**: `today` (bold), `logged` (regular), `unlogged` (italic), `future` (dimmed), and `otherMonth` (boundary filler).
- **Redaction Typography**: Full family of 8 weights and degradation grades (Redaction 20, 35, 50, 70).

### 2. Day & Sleep Logging Modal
- **Hours Cyclical Wheel Picker**: Infinite vertical pager cycling from 0h to 24h.
- **Mood Star Rating**: Scrubbable 10-star rating row.
- **Daily Notes / Comments**: Auto-saving note box with custom placeholder formatting.
- **Body Care / Razor Blade Tracker**:
  - Track 4 quadrants per blade (`top-left`, `top-right`, `bottom-left`, `bottom-right`).
  - Supported brands: Astra Superior Platinum, Gillette Platinum, Isana Men Classic.
  - Visual touch-active overlays with usage counters.
- **Audit History**: Complete chronological log of changes (previous vs. new values for hours, mood, and comments).

### 3. Modular Customization Architecture (Three Modes)
`simple-sleep-journal` supports 3 distinct distribution and usage modes:
1. **`default` (Pure/Vanilla)**: Minimalist interface, Redaction font, standard light/dark modes. Appearance Studio is hidden. Theme export is disabled, but users can import `.moodtheme` files. Resetting restores vanilla defaults.
2. **`baked` (Static Custom Build)**: Created via the Build Wizard with baked branding, custom fonts, tailored color palettes, custom background graphics, and compile-time disabled feature flags (e.g. blades disabled, stars disabled). Can export its active look as `.moodtheme`, can import `.moodtheme`, and resetting restores to the **baked** configuration.
3. **`dynamic` (In-App Customizable)**: Unlocks the full Appearance Studio in Settings:
   - Load arbitrary `.ttf` / `.otf` fonts directly from phone storage.
   - Choose from quick color palettes (Vanilla, Cyberpunk, Mocha, Matcha, Twilight) or full hex/HSV color picking.
   - Set custom photos as background wallpapers for the Calendar and Settings screens.
   - Toggle individual feature flags directly in Settings.
   - Export and import `.moodtheme` portable files.

### 4. Portable Looks (`.moodtheme`)
Theme looks are self-contained in `.moodtheme` JSON files:
- Color palette overrides for light and dark modes.
- Font metadata.
- Embedded base64 data URIs for background images.
- Feature flag presets.
- 100% portable across Android, iOS, and devices without network dependencies.

### 5. Data Export & Storage Access Framework (SAF)
- **Export formats**: JSON Backup (full database dump), CSV Spreadsheet (RFC 4180 compliant), and Plain Text Summary.
- **Android SAF Compliant**: Uses `@react-native-documents/picker` with an automatic 4-tier fallback cascade to handle transient intent URIs, remembered directory permissions, and system share sheet.

---

## Build Wizard CLI

Configure and brand custom builds before compiling APK or iOS binaries:

```bash
# Launch interactive terminal wizard
node scripts/build-wizard.mjs
# or
npm run wizard
```

### Headless / Automated Build Flags (with custom hex colors)
```bash
node scripts/build-wizard.mjs \
  --mode=baked \
  --name="mood journal (baked)" \
  --packageId="com.shittyassapps.sleepinapp.baked" \
  --bodyCare=false \
  --bg="#1E0538" \
  --text="#FFE600" \
  --element="#6B1D99" \
  --selected="#00FF99" \
  --textSecondary="#FF70C5" \
  --calendarBg="assets/images/custom-cat-bg.png" \
  --settingsBg="assets/images/custom-cat-bg.png"
```

The wizard automatically updates:
- `src/constants/build-config.json`
- `app.json` (`name`, `scheme`, `android.package`)
- `android/app/build.gradle` (`applicationId`)
- `android/app/src/main/res/values/strings.xml` (`app_name`)

---

## Testing & Verification

```bash
# Run unit tests (native Node.js runner, ~90ms)
npm test

# Run TypeScript type checking
npm run typecheck

# Run Expo doctor
npm run doctor
```

---

## Building Android APKs Locally

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export ANDROID_HOME=$HOME/Android/Sdk

# Compile Debug APK
cd android && ./gradlew assembleDebug

# Compile Standalone Release APK
cd android && ./gradlew assembleRelease -x lint
```

APKs are generated in:
- Debug: `android/app/build/outputs/apk/debug/app-debug.apk`
- Release: `android/app/build/outputs/apk/release/app-release.apk`

---

## Deep Technical Documentation

For an exhaustive technical breakdown of every component, database tables, SAF mechanics, theme engine internals, and architectural decisions, refer to [DOCS.md](DOCS.md).

---

## License

This software is free to use, modify, and share for personal, educational, and non-commercial purposes.

- **Commercial / For-Profit Use**: Not permitted without prior consultation and explicit written permission from the copyright owner (`kvvzie`, [kvvz.xyz](https://kvvz.xyz), `kvvzieart@gmail.com`).
- **Advertising & Monetization**: Placing ads, ad SDKs, or monetization paywalls in the app or any derivative version is not permitted without prior consultation and explicit written permission from the copyright owner.

See [LICENSE](LICENSE) for full terms.
