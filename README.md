# simple-sleep-journal

A minimalist, privacy-first, offline sleep, mood, and weekly reflection journal built with **React Native (0.88.1)**, **Expo SDK 58**, **Expo Router**, a local **SQLite** database, and a **Three-Tier Build & Runtime Customization System**.

Zero cloud sync, zero analytics, and zero telemetry. Every entry, task, weekly note, and custom theme stays strictly on your device.

---

## Key Features

### 1. Interactive Paged Calendar Grid
- **Adaptive Grid Sizes**: 5 customizable calendar aspect ratios (`4x8`, `5x7`, `6x6`, `7x5`, `8x4`) with independent responsive persistence for standard vs. wide screens (phones, foldables, tablets).
- **Three-Level Synchronized Pagination**:
  - Powered by a custom `SmoothHorizontalPager` built on React Native Gesture Handler (`PanGestureHandler` + `Animated.event(..., { useNativeDriver: true })` + velocity-carrying `Animated.spring`) with windowed rendering (`radius = 2`), delivering native UI-thread 120fps tracking and seamless spring momentum without `ScrollView` snap pauses or Jetpack Compose `uiMode` dark/light freezes.
  - Year slider with pre-measured dynamic container width.
  - Month slider with pre-measured width scaling and overflow protection for custom fonts.
  - Windowed day grid (`GRID_RENDER_RADIUS = 2`) with immediate logged-state rendering, spring feedback (`0.98 -> 1`), and a forgiving center reversal band (`SWIPE_TRIGGER_THRESHOLD = 0.18`, `SWIPE_RETURN_THRESHOLD = 0.12`) so pulling a partial swipe back snaps cleanly to the current month.
- **5 Semantic Day States**: `today` (bold), `logged` (regular), `unlogged` (italic), `future` (dimmed), and `otherMonth` (boundary filler).
- **Redaction Typography**: Full family of weights and degradation grades (Redaction 20, 35, 50, 70).

### 2. Weekly Recaps (Zoomable Multi-Week View)
- **Optional Dedicated Tab**: Toggleable directly in Settings, providing a structured space for longer reflections and topics beyond daily entries.
- **Three Zoom Levels (`Half` / `Quarter` / `Month`)**:
  - Switch via header controls or two-finger pinch-to-zoom anywhere on the grid.
  - **Half-Year (`Half`)**: Compact overview of ~28 ISO weeks per half with month hints.
  - **Quarter (`Quarter`)**: 3-column monthly breakdown showing every ISO week and its compact date range.
  - **Month (`Month`)**: Rich quincunx card layout per ISO week (using the ISO Thursday rule) displaying full Monday-Sunday date ranges, open/done topic counts, and topic previews.
- **Week Detail Sheet (`WeekDiscussModal`)**:
  - Add, edit, complete, and delete structured topics with both titles and multi-line descriptions.
  - **One-Tap Carry-Over**: Move unfinished topics forward to the next week or pull past open topics into the current week with instant feedback (`moved to WXX`).
  - Clear an entire week cleanly with confirmation prompts.

### 3. Day & Sleep Logging Sheet
- **Gesture-Driven Hours Wheel Picker**: Smooth vertical `Animated` + `PanResponder` cyclical wheel (`0h` to `24h`) with velocity flick projection, rubber-band bounds, and automatic scroll locking inside the sheet.
- **Scrubbable 10-Star Mood Rating**: Tap or drag horizontally across 10 stars for instant rating updates.
- **Fast Daily Notes / Comments**: Isolated memoized comment section with a bounded scrollable input (`maxHeight: 240`) and a memoized animated dotted focus border that runs continuously while typing without re-rendering the modal.
- **Daily To-Do List**: Centered task checklist with 3-day carry-over (`created_date + 3 days`), inline add (`+ new task`) and multi-line edit modes, elapsed-hour timestamps (`(<1 hours ago)` up to `(>96 hours ago)`), and deletion confirmation dialogs.
- **Chronological Audit History**: Expandable edit trail inside each logged day recording previous vs. new values for hours, mood, and comments.
- **Optional Self-Harm Tracker**: Disabled by default in vanilla builds and toggleable at build time or runtime (in `dynamic` mode). Provides a 4-quadrant razor blade usage counter (`top-left`, `top-right`, `bottom-left`, `bottom-right`) with visual overlays for Astra Superior Platinum, Gillette Platinum, and Isana Men Classic.

### 4. Top Toast Feedback & Native Date-Range Export
- **Slide-Down Top Toasts**: Lightweight, non-blocking top status pills for saving (`saved`), deleting (`entry deleted`, `task deleted`, `topic deleted`, `week deleted`), carrying over weekly topics (`moved to WXX`), and export/import confirmations.
- **Native Jetpack Compose Date Range Picker**: On Android builds with `@expo/ui` (`DateRangePickerDialog`), both TXT and CSV exports offer a native calendar date-range picker pre-populated with your first and last logged dates (falling back cleanly to manual date inputs on older binaries or other platforms).
- **Export Formats**:
  - **JSON Backup (`v1.3.0`)**: Full local database dump covering sleep logs, edit history, daily to-dos, weekly recaps, and optional self-harm logs.
  - **CSV Spreadsheet**: RFC 4180 compliant export including sleep data, edit summaries, to-do statuses/timestamps, and weekly recap rows.
  - **Plain Text Summary**: Readable narrative report grouping daily entries, tasks, and weekly recap topics.
- **Atomic Wipe-Before-Restore Import**: Importing a full JSON backup (or legacy array backup) runs inside a single SQLite transaction that cleanly clears existing user data before restoring the backup, preventing stale or duplicate records.
- **Android SAF Compliant**: Uses `@react-native-documents/picker` with a 4-tier fallback cascade handling Android Scoped Storage, remembered folder permissions, and the system share sheet.

### 5. Modular Customization Architecture (Three Modes)
`simple-sleep-journal` supports 3 distinct distribution and usage modes:
1. **`default` (Pure/Vanilla)**: Minimalist interface, Redaction font, standard light/dark modes. Appearance Studio is hidden. Theme export is disabled, while `.moodtheme` import remains available. Resetting restores vanilla defaults.
2. **`baked` (Static Custom Build)**: Created via the Build Wizard with compile-time branding, custom fonts, fixed palettes, background wallpapers, and compile-time feature flags. Can export and import `.moodtheme` files, and resetting restores the baked configuration.
3. **`dynamic` (In-App Customizable)**: Unlocks the full Appearance Studio in Settings:
   - Load custom `.ttf` / `.otf` fonts directly from phone storage.
   - Pick colors via quick palettes (Vanilla, Cyberpunk, Mocha, Matcha, Twilight) or the interactive HSV/Hex color picker.
   - Assign separate background wallpapers for the Calendar and Settings screens.
   - Toggle individual feature flags at runtime (Weekly Recaps, To-Do List, Mood Stars, Comments, Grid Picker, Color Scheme Switcher, Self-Harm Tracker).
   - Export and import self-contained `.moodtheme` files with embedded base64 wallpapers.

---

## Build Wizard CLI

Configure and brand custom builds before compiling Android APK or iOS binaries:

```bash
# Launch interactive terminal wizard
node scripts/build-wizard.mjs
# or
npm run wizard
```

### Headless / Automated Build Flags
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
  --settingsBg="none"
```

The wizard automatically updates:
- `src/constants/build-config.json`
- `app.json` (`name`, `scheme`, `android.package`)
- `android/app/build.gradle` (`applicationId`)
- `android/app/src/main/res/values/strings.xml` (`app_name`)

---

## Testing & Verification

```bash
# Run unit tests (native Node.js runner, 91 tests)
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

For a full technical breakdown of every component, the SQLite schema, Weekly Recaps zoom architecture, top toast lifecycle, SAF export cascade, theme engine internals, and build wizard flags, refer to [DOCS.md](DOCS.md).

---

## License

This software is free to use, modify, and share for personal, educational, and non-commercial purposes.

- **Commercial / For-Profit Use**: Not permitted without prior consultation and explicit written permission from the copyright owner (`kvvzie`, [kvvz.xyz](https://kvvz.xyz), `kvvzieart@gmail.com`).
- **Advertising & Monetization**: Placing ads, ad SDKs, or monetization paywalls in the app or any derivative version is not permitted without prior consultation and explicit written permission from the copyright owner.

See [LICENSE](LICENSE) for full terms.
