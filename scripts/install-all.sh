#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Checking connected device..."
adb devices

install_apk() {
  local apk_path="$1"
  local name="$2"
  echo "Installing $name..."
  adb push "$apk_path" /data/local/tmp/app_install.apk
  adb shell pm install -r /data/local/tmp/app_install.apk
  adb shell rm -f /data/local/tmp/app_install.apk
}

install_apk "$DIR/apks/mood-journal-default.apk" "Default Build (com.shittyassapps.sleepinapp.default)"
install_apk "$DIR/apks/mood-journal-dynamic.apk" "Dynamic Build (com.shittyassapps.sleepinapp.dynamic)"
install_apk "$DIR/apks/mood-journal-baked.apk" "Baked Custom Build (com.shittyassapps.sleepinapp.baked)"

echo "All 3 dev APKs installed successfully side-by-side on your device!"
