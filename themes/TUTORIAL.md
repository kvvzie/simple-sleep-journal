# Creating Custom Themes (`themes/`)

The Build Wizard (`scripts/build-wizard.mjs`) automatically scans this directory for any `.json` or `.moodtheme` file.

Every valid theme file you place in `themes/` appears automatically in interactive mode (`npm run wizard`) and can be selected directly via CLI with `--theme=<filename-without-extension>`.

---

## Quick Start

1. Copy `themes/default.json` to a new file, for example `themes/midnight.json`.
2. Change `"name"`, `"description"`, and any colors, font, or background images you want.
3. Run the wizard:
   ```bash
   # Interactive mode (pick your new theme from the list)
   npm run wizard

   # Headless CLI mode (pass filename without extension)
   node scripts/build-wizard.mjs --mode=baked --theme=midnight
   ```

Tip: You can also design a look directly on your phone in **Settings -> Appearance Studio**, export it as a `.moodtheme` file, and drop that `.moodtheme` file straight into `themes/` — the wizard reads `.moodtheme` files natively (including embedded base64 wallpapers).

---

## Theme File Structure

```json
{
  "format": "simple-sleep-journal-theme",
  "version": 1,
  "name": "Midnight Slate",
  "description": "Deep navy dark theme with crisp ice text",
  "palette": {
    "dark": {
      "background": "#0B1020",
      "text": "#EAF0FF",
      "backgroundElement": "#161E36",
      "backgroundSelected": "#253359",
      "textSecondary": "#8B98B8",
      "modalBackground": "#12192E",
      "modalOverlay": "rgba(0,0,0,0.65)"
    },
    "light": {
      "background": "#F6F8FC",
      "text": "#121826",
      "backgroundElement": "#E8EEF8",
      "backgroundSelected": "#D4E0F4",
      "textSecondary": "#5C6882",
      "modalBackground": "#FFFFFF",
      "modalOverlay": "rgba(0,0,0,0.4)"
    }
  },
  "font": null,
  "backgrounds": {
    "calendar": null,
    "toDiscuss": null,
    "settings": null
  }
}
```

---

## Field Reference

### Top-Level Fields
| Field | Required | Description |
| --- | --- | --- |
| `format` | Recommended | `"simple-sleep-journal-theme"` (compatible with in-app `.moodtheme` import/export) |
| `version` | Recommended | `1` |
| `name` | Optional | Display name shown in the wizard and Appearance Studio (defaults to filename) |
| `description` | Optional | Short one-line summary displayed next to the theme in the wizard menu |
| `palette` | Optional | Object containing optional `dark` and/or `light` color overrides |
| `font` | Optional | `null` (default Redaction font) or `{ "name": "...", "dataUriOrPath": "..." }` |
| `backgrounds` | Optional | Screen wallpaper paths or base64 data URIs for `calendar`, `toDiscuss`, `settings` |

### `palette.dark` and `palette.light`
All color keys are optional. Any omitted key automatically falls back to the app's default palette (`src/constants/default-theme.ts`).

| Key | Purpose |
| --- | --- |
| `background` | Main screen background color |
| `text` | Primary text color (also inherited by `calendarDayLogged` and `calendarToday` if not overridden) |
| `backgroundElement` | Cards, pills, inputs, and secondary containers |
| `backgroundSelected` | Active selection highlight and focused elements |
| `textSecondary` | Muted labels, dates, hints, and unlogged days (`calendarDayUnlogged` inherits this if not overridden) |
| `modalBackground` | Background of bottom sheets (`SleepModal`, `WeekDiscussModal`, dialogs) |
| `modalOverlay` | Dimmed backdrop behind modals (usually `rgba(0,0,0,0.4)` to `rgba(0,0,0,0.65)`) |
| `calendarDayLogged` | Optional explicit override for logged days on the calendar grid |
| `calendarDayUnlogged` | Optional explicit override for unlogged past days |
| `calendarDayFuture` | Optional explicit override for future days |
| `calendarDayOtherMonth` | Optional explicit override for overflow days from adjacent months |
| `calendarToday` | Optional explicit override for today's date |

Note: If you only customize `dark` (or only `light`), the other mode stays on the clean default monochrome palette.

### `font`
- **Default Redaction family**:
  ```json
  "font": null
  ```
- **Pre-bundled Comic Sans**:
  ```json
  "font": {
    "name": "ComicSans",
    "dataUriOrPath": null
  }
  ```
- **Custom `.ttf` or `.otf` file** (copied automatically into `assets/fonts/custom/` by the wizard):
  ```json
  "font": {
    "name": "MyCustomFont",
    "dataUriOrPath": "assets/fonts/custom/MyCustomFont.ttf"
  }
  ```

### `backgrounds`
Each screen has its own independent wallpaper slot:
- `calendar`: Calendar screen (`CalendarGrid`)
- `toDiscuss` (alias `weeklyRecaps`): Weekly Recaps screen (`ToDiscuss`)
- `settings`: Settings screen (`Settings`)

Each value can be:
- `null` — solid `palette.*.background` color (no image)
- A relative path from the repository root (e.g. `"assets/images/my-bg.png"`) or relative to `themes/` — automatically resized and base64-encoded by the wizard
- An absolute path on your machine
- A `data:image/...;base64,...` data URI (used automatically in exported `.moodtheme` files)

---

## Overriding a Theme via CLI Flags

You can load any theme from `themes/` as a base and override individual values on the command line:

```bash
node scripts/build-wizard.mjs \
  --mode=baked \
  --theme=midnight \
  --text="#FFFFFF" \
  --weekly-recaps-bg="assets/images/recaps-bg.jpg"
```

Pass `--calendar-bg=none`, `--weekly-recaps-bg=none`, or `--settings-bg=none` to disable a wallpaper defined inside a theme file for a specific build.
