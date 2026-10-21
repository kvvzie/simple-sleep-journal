#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Checking connected device..."
adb devices

echo "Installing Default Build (com.shittyassapps.sleepinapp.default)..."
adb install -r "$DIR/apks/mood-journal-default.apk"

echo "Installing Dynamic In-App Build (com.shittyassapps.sleepinapp.dynamic)..."
adb install -r "$DIR/apks/mood-journal-dynamic.apk"

echo "Installing Baked Custom Build (com.shittyassapps.sleepinapp.baked)..."
adb install -r "$DIR/apks/mood-journal-baked.apk"

echo "All 3 dev APKs installed successfully side-by-side on your device!"
