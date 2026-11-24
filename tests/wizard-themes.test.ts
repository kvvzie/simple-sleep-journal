import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  discoverThemes,
  resolveBackgroundSpec,
  resolveThemeChoice,
} from "../scripts/wizard-themes.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

test("discoverThemes loads repository themes/default.json with full default palette", () => {
  const themes = discoverThemes(path.join(ROOT_DIR, "themes"));
  assert.ok(themes.length >= 1);
  assert.equal(themes[0].id, "default");
  assert.equal(themes[0].palette.dark?.background, "#000000");
  assert.equal(themes[0].palette.light?.background, "#ffffff");
  assert.equal(themes[0].backgrounds.toDiscuss, null);
});

test("discoverThemes dynamically discovers user-added .json and .moodtheme files", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sleep-themes-"));
  try {
    fs.writeFileSync(
      path.join(tmpDir, "default.json"),
      JSON.stringify({ name: "Default", palette: { dark: { background: "#000000" } } }),
    );
    fs.writeFileSync(
      path.join(tmpDir, "midnight.json"),
      JSON.stringify({
        name: "Midnight Custom",
        description: "Deep slate blue",
        palette: { dark: { background: "#0B1020", text: "#E8F0FF" } },
        backgrounds: { weeklyRecaps: "assets/images/bg.png" },
      }),
    );
    fs.writeFileSync(
      path.join(tmpDir, "exported.moodtheme"),
      JSON.stringify({
        format: "simple-sleep-journal-theme",
        version: 1,
        name: "Exported Look",
        palette: { light: { background: "#FAF7F2" } },
        backgrounds: {
          toDiscussBase64: "data:image/jpeg;base64,ABCD",
        },
      }),
    );

    const themes = discoverThemes(tmpDir);
    assert.deepEqual(
      themes.map((t) => t.id),
      ["default", "exported", "midnight"],
    );

    const byId = resolveThemeChoice("midnight", themes, ROOT_DIR);
    assert.equal(byId?.name, "Midnight Custom");
    assert.equal(byId?.backgrounds.toDiscuss, "assets/images/bg.png");

    const byName = resolveThemeChoice("Exported Look", themes, ROOT_DIR);
    assert.equal(byName?.id, "exported");
    assert.equal(byName?.backgrounds.toDiscuss, "data:image/jpeg;base64,ABCD");

    assert.equal(resolveThemeChoice("custom", themes, ROOT_DIR), null);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("resolveBackgroundSpec distinguishes none, data URIs, and file paths", () => {
  assert.equal(resolveBackgroundSpec(null, ROOT_DIR), null);
  assert.equal(resolveBackgroundSpec("none", ROOT_DIR), null);
  assert.deepEqual(
    resolveBackgroundSpec("data:image/jpeg;base64,XYZ", ROOT_DIR),
    { type: "dataUri", value: "data:image/jpeg;base64,XYZ" },
  );
  const fileSpec = resolveBackgroundSpec("assets/images/icon.png", ROOT_DIR);
  assert.equal(fileSpec?.type, "file");
  assert.equal(fileSpec?.value, path.join(ROOT_DIR, "assets/images/icon.png"));
});
