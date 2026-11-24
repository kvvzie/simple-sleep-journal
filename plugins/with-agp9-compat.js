const { withGradleProperties, withProjectBuildGradle } = require("@expo/config-plugins");

const ASYNC_STORAGE_PATCH_MARKER = "react-native-async-storage_async-storage";
const ASYNC_STORAGE_SUBPROJECT_PATCH = `
subprojects { sub ->
  if (sub.name == 'react-native-async-storage_async-storage') {
    sub.afterEvaluate {
      def useNext = sub.ext.has('AsyncStorageConfig') && sub.ext.AsyncStorageConfig.useNextStorage
      if (!useNext) {
        sub.android.sourceSets.main.java.exclude('**/next/**')
        if (sub.android.sourceSets.main.hasProperty('kotlin')) {
          sub.android.sourceSets.main.kotlin.exclude('**/next/**')
        }
        sub.tasks.matching { it.name.contains('Kotlin') }.configureEach { task ->
          if (task.respondsTo('exclude')) {
            task.exclude('**/next/**')
          }
        }
      }
    }
  }
}
`;

module.exports = function withAgp9Compat(config) {
  config = withGradleProperties(config, (cfg) => {
    const existing = cfg.modResults.find(
      (item) => item.type === "property" && item.key === "android.newDsl",
    );
    if (existing) {
      existing.value = "false";
    } else {
      cfg.modResults.push({
        type: "property",
        key: "android.newDsl",
        value: "false",
      });
    }
    return cfg;
  });

  config = withProjectBuildGradle(config, (cfg) => {
    if (
      cfg.modResults.language === "groovy" &&
      !cfg.modResults.contents.includes(ASYNC_STORAGE_PATCH_MARKER)
    ) {
      cfg.modResults.contents = `${cfg.modResults.contents.trimEnd()}\n${ASYNC_STORAGE_SUBPROJECT_PATCH}`;
    }
    return cfg;
  });

  return config;
};
