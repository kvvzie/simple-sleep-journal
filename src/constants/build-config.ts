import { BuildConfig } from "@/types/appearance";
import rawBuildConfig from "./build-config.json";
import { DEFAULT_BUILD_CONFIG } from "./default-theme";

export const buildConfig: BuildConfig = {
  mode: (rawBuildConfig.mode as BuildConfig["mode"]) || DEFAULT_BUILD_CONFIG.mode,
  appName: rawBuildConfig.appName || DEFAULT_BUILD_CONFIG.appName,
  packageId: rawBuildConfig.packageId || DEFAULT_BUILD_CONFIG.packageId,
  features: {
    ...DEFAULT_BUILD_CONFIG.features,
    ...(rawBuildConfig.features || {}),
  },
  lockedGrid: rawBuildConfig.lockedGrid || null,
  bakedTheme: {
    ...DEFAULT_BUILD_CONFIG.bakedTheme,
    ...(rawBuildConfig.bakedTheme || {}),
  },
};
