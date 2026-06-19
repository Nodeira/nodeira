// Expo config plugin: emit one APK per ABI instead of a single ~115 MB universal
// APK, so the self-hosted F-Droid repo can serve the right native build per
// device. Runs during `expo prebuild`, so it applies to both local and CI builds.
//
// Each split needs a unique, monotonically increasing versionCode. We offset the
// base versionCode (set from the release tag in CI) by a per-ABI index, following
// the standard React Native pattern. F-Droid serves the highest versionCode whose
// nativecode matches the device.
const { withAppBuildGradle } = require("@expo/config-plugins");

const MARKER = "withAbiSplits";

// Order matters only for tie-breaking; the values must be stable across releases.
const SPLITS_BLOCK = `
// --- injected by ${MARKER}: per-ABI APKs for F-Droid distribution ---
android {
    splits {
        abi {
            reset()
            enable true
            universalApk false
            include "armeabi-v7a", "arm64-v8a", "x86_64"
        }
    }
}
android.applicationVariants.all { variant ->
    variant.outputs.each { output ->
        def abiCodes = ["armeabi-v7a": 1, "x86_64": 2, "arm64-v8a": 3]
        // Fully-qualified to avoid a top-of-file import in this appended block.
        def abi = output.getFilter(com.android.build.OutputFile.ABI)
        if (abi != null) {
            // Qualify with the android extension: this block runs at script scope,
            // where a bare defaultConfig resolves against the variant, not android.
            output.versionCodeOverride =
                android.defaultConfig.versionCode * 10 + abiCodes.get(abi)
        }
    }
}
// --- end ${MARKER} ---
`;

module.exports = function withAbiSplits(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      throw new Error(
        `${MARKER}: expected app/build.gradle to be groovy, got ${config.modResults.language}`,
      );
    }
    if (!config.modResults.contents.includes(MARKER)) {
      config.modResults.contents += SPLITS_BLOCK;
    }
    return config;
  });
};
