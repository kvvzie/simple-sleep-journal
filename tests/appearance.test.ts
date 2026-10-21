import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveEffectiveColors,
  serializeMoodTheme,
  parseAndValidateMoodTheme,
  getResetDefaults,
  isThemeExportAllowed,
  isThemeImportAllowed,
  resolveFontFamily,
} from "../src/lib/theme-utils.ts";
import { DEFAULT_FEATURE_FLAGS, DEFAULT_THEME } from "../src/constants/default-theme.ts";
import type { AppTheme, FeatureFlags } from "../src/types/appearance.ts";

describe("Theme & Appearance Utilities", () => {
  it("resolveEffectiveColors merges overrides onto base theme", () => {
    const lightEffective = resolveEffectiveColors("light", {
      light: {
        background: "#112233",
        text: "#FFFFFF",
      },
    });

    assert.equal(lightEffective.background, "#112233");
    assert.equal(lightEffective.text, "#FFFFFF");
    // Unoverridden keys should keep default values
    assert.equal(lightEffective.backgroundElement, "#F0F0F3");

    const darkEffective = resolveEffectiveColors("dark", {
      dark: {
        background: "#050505",
      },
    });
    assert.equal(darkEffective.background, "#050505");
    assert.equal(darkEffective.text, "#ffffff");
  });

  it("serializeMoodTheme creates compliant MoodThemeFile", () => {
    const theme: AppTheme = {
      name: "Cyberpunk Mocha",
      version: 1,
      palette: {
        dark: { background: "#0D0E15", text: "#00FFCC" },
      },
      font: { name: "PixelFont" },
      backgrounds: {
        calendar: "data:image/png;base64,ABCDEF1234==",
        settings: "data:image/png;base64,XYZ98765==",
      },
      features: {
        bodyCareEnabled: false,
        moodStarsEnabled: true,
      },
    };

    const serialized = serializeMoodTheme(theme, { createdAt: "2026-10-21T12:00:00Z" });

    assert.equal(serialized.format, "simple-sleep-journal-theme");
    assert.equal(serialized.version, 1);
    assert.equal(serialized.createdAt, "2026-10-21T12:00:00Z");
    assert.equal(serialized.name, "Cyberpunk Mocha");
    assert.equal(serialized.palette.dark?.background, "#0D0E15");
    assert.equal(serialized.backgrounds.calendarBase64, "data:image/png;base64,ABCDEF1234==");
    assert.equal(serialized.backgrounds.settingsBase64, "data:image/png;base64,XYZ98765==");
    assert.equal(serialized.features.bodyCareEnabled, false);
    assert.equal(serialized.features.moodStarsEnabled, true);
  });

  it("parseAndValidateMoodTheme parses valid theme payload", () => {
    const payload = {
      format: "simple-sleep-journal-theme",
      version: 1,
      name: "Cat Cozy",
      palette: {
        light: { background: "#FFF8F0", text: "#332211" },
      },
      font: { name: "CatFont" },
      backgrounds: {
        calendarBase64: "data:image/png;base64,CAT123",
        settingsBase64: null,
      },
      features: {
        bodyCareEnabled: false,
      },
    };

    const res = parseAndValidateMoodTheme(payload);
    assert.equal(res.valid, true);
    if (!res.valid) return;

    assert.equal(res.theme.name, "Cat Cozy");
    assert.equal(res.theme.palette.light?.background, "#FFF8F0");
    assert.equal(res.theme.font?.name, "CatFont");
    assert.equal(res.theme.backgrounds.calendar, "data:image/png;base64,CAT123");
    assert.equal(res.theme.backgrounds.settings, null);
    assert.equal(res.theme.features?.bodyCareEnabled, false);
  });

  it("parseAndValidateMoodTheme rejects non-object or corrupt payloads", () => {
    const nullRes = parseAndValidateMoodTheme(null);
    assert.equal(nullRes.valid, false);

    const emptyRes = parseAndValidateMoodTheme({});
    assert.equal(emptyRes.valid, false);

    const stringRes = parseAndValidateMoodTheme("hello world");
    assert.equal(stringRes.valid, false);
  });

  it("getResetDefaults returns baked theme for baked mode, and vanilla for default/dynamic", () => {
    const bakedTheme: AppTheme = {
      name: "Baked Custom Look",
      version: 1,
      palette: {
        dark: { background: "#1a1a2e" },
      },
      font: { name: "BakedFont" },
      backgrounds: { calendar: null, settings: null },
      features: { bodyCareEnabled: false },
    };

    const bakedFeatures: FeatureFlags = {
      bodyCareEnabled: false,
      moodStarsEnabled: true,
      commentsEnabled: false,
      gridPickerEnabled: false,
      inAppCustomizationEnabled: false,
    };

    // In baked mode, reset must restore baked values
    const bakedReset = getResetDefaults("baked", bakedTheme, bakedFeatures);
    assert.equal(bakedReset.theme.name, "Baked Custom Look");
    assert.equal(bakedReset.features.bodyCareEnabled, false);
    assert.equal(bakedReset.features.commentsEnabled, false);

    // In default mode, reset must restore pure default
    const defaultReset = getResetDefaults("default", bakedTheme, bakedFeatures);
    assert.equal(defaultReset.theme.name, DEFAULT_THEME.name);
    assert.equal(defaultReset.features.bodyCareEnabled, DEFAULT_FEATURE_FLAGS.bodyCareEnabled);

    // In dynamic mode, reset must restore pure default
    const dynamicReset = getResetDefaults("dynamic", bakedTheme, bakedFeatures);
    assert.equal(dynamicReset.theme.name, DEFAULT_THEME.name);
    assert.equal(dynamicReset.features.bodyCareEnabled, DEFAULT_FEATURE_FLAGS.bodyCareEnabled);
  });

  it("isThemeExportAllowed adheres strictly to mode rules", () => {
    assert.equal(isThemeExportAllowed("default"), false);
    assert.equal(isThemeExportAllowed("baked"), true);
    assert.equal(isThemeExportAllowed("dynamic"), true);
  });

  it("isThemeImportAllowed allows all modes to import", () => {
    assert.equal(isThemeImportAllowed("default"), true);
    assert.equal(isThemeImportAllowed("baked"), true);
    assert.equal(isThemeImportAllowed("dynamic"), true);
  });

  it("resolveFontFamily falls back to Redaction weights or respects custom font", () => {
    assert.equal(resolveFontFamily("display"), "Redaction70-Bold");
    assert.equal(resolveFontFamily("title"), "Redaction50-Bold");
    assert.equal(resolveFontFamily("bold"), "Redaction35-Bold");
    assert.equal(resolveFontFamily("regular"), "Redaction35-Regular");
    assert.equal(resolveFontFamily("italic"), "Redaction35-Italic");

    assert.equal(resolveFontFamily("display", "MyCustomFont"), "MyCustomFont");
    assert.equal(resolveFontFamily("regular", "MyCustomFont"), "MyCustomFont");
    assert.equal(resolveFontFamily("italic", "MyCustomFont"), "MyCustomFont");
  });
});
