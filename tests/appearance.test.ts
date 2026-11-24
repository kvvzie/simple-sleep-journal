import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveEffectiveColors,
  serializeMoodTheme,
  parseAndValidateMoodTheme,
  getResetDefaults,
  isThemeExportAllowed,
  isThemeImportAllowed,
  isThemeModifiedFromDefaults,
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
        toDiscuss: "data:image/png;base64,WEEKLY5678==",
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
    assert.equal(serialized.backgrounds.toDiscussBase64, "data:image/png;base64,WEEKLY5678==");
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
    assert.equal(res.theme.backgrounds.toDiscuss, null);
    assert.equal(res.theme.backgrounds.settings, null);
    assert.equal(res.theme.features?.bodyCareEnabled, false);
  });

  it("parses weekly recaps background aliases and detects modifications", () => {
    const parsed = parseAndValidateMoodTheme({
      format: "simple-sleep-journal-theme",
      version: 1,
      name: "Weekly Wallpaper Theme",
      palette: {},
      backgrounds: {
        weeklyRecaps: "data:image/jpeg;base64,RECAP_IMG",
      },
    });
    assert.equal(parsed.valid, true);
    if (!parsed.valid) return;
    assert.equal(parsed.theme.backgrounds.toDiscuss, "data:image/jpeg;base64,RECAP_IMG");
    assert.equal(
      isThemeModifiedFromDefaults("default", parsed.theme, DEFAULT_THEME),
      true,
    );
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
      colorSchemeToggleEnabled: false,
      bodyCareEnabled: false,
      moodStarsEnabled: true,
      commentsEnabled: false,
      todoListEnabled: false,
      toDiscussToggleEnabled: false,
      toDiscussDefaultEnabled: false,
      gridPickerEnabled: false,
      inAppCustomizationEnabled: false,
    };

    const bakedReset = getResetDefaults("baked", bakedTheme, bakedFeatures);
    assert.equal(bakedReset.theme.name, "Baked Custom Look");
    assert.equal(bakedReset.features.colorSchemeToggleEnabled, false);
    assert.equal(bakedReset.features.bodyCareEnabled, false);
    assert.equal(bakedReset.features.commentsEnabled, false);
    assert.equal(bakedReset.features.todoListEnabled, false);
    assert.equal(bakedReset.features.toDiscussToggleEnabled, false);
    assert.equal(bakedReset.features.toDiscussDefaultEnabled, false);
    assert.equal(bakedReset.features.inAppCustomizationEnabled, false);

    const defaultReset = getResetDefaults("default", bakedTheme, bakedFeatures);
    assert.equal(defaultReset.theme.name, DEFAULT_THEME.name);
    assert.equal(defaultReset.features.bodyCareEnabled, DEFAULT_FEATURE_FLAGS.bodyCareEnabled);
    assert.equal(defaultReset.features.inAppCustomizationEnabled, false);

    const dynamicReset = getResetDefaults("dynamic", bakedTheme, bakedFeatures);
    assert.equal(dynamicReset.theme.name, DEFAULT_THEME.name);
    assert.equal(dynamicReset.features.bodyCareEnabled, DEFAULT_FEATURE_FLAGS.bodyCareEnabled);
    assert.equal(dynamicReset.features.inAppCustomizationEnabled, true);
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

  it("isThemeModifiedFromDefaults identifies deviations from mode-specific baselines", () => {
    const bakedBaseline: AppTheme = {
      name: "Baked Look",
      version: 1,
      palette: { dark: { background: "#1E0538", text: "#FFE600" } },
      font: { name: "ComicSans" },
      backgrounds: { calendar: "data:image/jpeg;base64,CAT", settings: null },
    };

    assert.equal(isThemeModifiedFromDefaults("baked", bakedBaseline, bakedBaseline), false);

    const modifiedBaked: AppTheme = {
      ...bakedBaseline,
      palette: { dark: { background: "#000000", text: "#FFFFFF" } },
    };
    assert.equal(isThemeModifiedFromDefaults("baked", modifiedBaked, bakedBaseline), true);

    assert.equal(isThemeModifiedFromDefaults("default", DEFAULT_THEME, bakedBaseline), false);

    const modifiedDefault: AppTheme = {
      ...DEFAULT_THEME,
      font: { name: "ComicSans" },
    };
    assert.equal(isThemeModifiedFromDefaults("default", modifiedDefault, bakedBaseline), true);

    const defaultWithSelfHarm: AppTheme = {
      ...DEFAULT_THEME,
      features: { bodyCareEnabled: true },
    };
    assert.equal(
      isThemeModifiedFromDefaults(
        "default",
        defaultWithSelfHarm,
        bakedBaseline,
        defaultWithSelfHarm.features,
      ),
      true,
    );

    const defaultWithStarsDisabled: AppTheme = {
      ...DEFAULT_THEME,
      features: { moodStarsEnabled: false },
    };
    assert.equal(
      isThemeModifiedFromDefaults(
        "default",
        defaultWithStarsDisabled,
        bakedBaseline,
        defaultWithStarsDisabled.features,
      ),
      true,
    );

    assert.equal(DEFAULT_FEATURE_FLAGS.todoListEnabled, true);
    assert.equal(DEFAULT_FEATURE_FLAGS.toDiscussToggleEnabled, true);
    const defaultWithTodoDisabled: AppTheme = {
      ...DEFAULT_THEME,
      features: { todoListEnabled: false },
    };
    assert.equal(
      isThemeModifiedFromDefaults(
        "default",
        defaultWithTodoDisabled,
        bakedBaseline,
        defaultWithTodoDisabled.features,
      ),
      true,
    );

    const parsedLook = parseAndValidateMoodTheme({
      format: "simple-sleep-journal-theme",
      version: 1,
      name: "No Discuss Look",
      palette: {},
      backgrounds: {},
      features: {
        toDiscussToggleEnabled: false,
        toDiscussDefaultEnabled: false,
      },
    });
    assert.equal(parsedLook.valid, true);
    if (parsedLook.valid) {
      assert.equal(parsedLook.theme.features?.toDiscussToggleEnabled, false);
      assert.equal(parsedLook.theme.features?.toDiscussDefaultEnabled, false);
    }
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

  it("handles baked theme export payload with inAppCustomization disabled safely", () => {
    const rawExportFromBaked = serializeMoodTheme({
      name: "Baked Export",
      version: 1,
      palette: {
        dark: { background: "#1E0538", text: "#FFE600" },
      },
      font: null,
      backgrounds: { calendar: null, settings: null },
      features: {
        colorSchemeToggleEnabled: true,
        bodyCareEnabled: false,
        moodStarsEnabled: true,
        commentsEnabled: true,
        gridPickerEnabled: true,
        inAppCustomizationEnabled: false,
      },
    });
    const res = parseAndValidateMoodTheme(rawExportFromBaked);
    assert.equal(res.valid, true);
    if (res.valid) {
      assert.equal(res.theme.name, "Baked Export");
      assert.equal(res.theme.features?.inAppCustomizationEnabled, false);
      const dynamicModeEffectiveCustomization = true;
      const effectiveCustomization = dynamicModeEffectiveCustomization
        ? true
        : (res.theme.features?.inAppCustomizationEnabled ?? false);
      assert.equal(effectiveCustomization, true);
    }
  });
});
