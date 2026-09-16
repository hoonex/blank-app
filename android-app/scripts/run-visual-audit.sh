#!/usr/bin/env bash
set -euo pipefail

APP_APK="app/build/outputs/apk/debug/app-debug.apk"
TEST_APK="$(find app/build/outputs/apk/androidTest/debug -type f -name '*.apk' -print -quit)"
OUT="build/visual-audit"
REMOTE="/sdcard/Android/data/io.github.hoonex.flow/files/visual-audit"

rm -rf "$OUT"
mkdir -p "$OUT"

gradle :app:assembleDebug :app:assembleDebugAndroidTest --stacktrace --no-daemon

test -s "$APP_APK"
test -n "$TEST_APK"
test -s "$TEST_APK"

adb install -r "$APP_APK"
adb install -r "$TEST_APK"

set +e
adb shell am instrument -w -r \
  -e class io.github.hoonex.flow.FlowVisualAuditTest \
  io.github.hoonex.flow.test/androidx.test.runner.AndroidJUnitRunner \
  | tee "$OUT/instrumentation.txt"
core_status=${PIPESTATUS[0]}

adb shell am instrument -w -r \
  -e class io.github.hoonex.flow.FlowCampusMapVisualTest \
  io.github.hoonex.flow.test/androidx.test.runner.AndroidJUnitRunner \
  | tee -a "$OUT/instrumentation.txt"
map_status=${PIPESTATUS[0]}

adb shell am instrument -w -r \
  -e class io.github.hoonex.flow.FlowWidgetGalleryVisualTest \
  io.github.hoonex.flow.test/androidx.test.runner.AndroidJUnitRunner \
  | tee -a "$OUT/instrumentation.txt"
widget_status=${PIPESTATUS[0]}

adb shell am instrument -w -r \
  -e class io.github.hoonex.flow.FlowPlannerVisualTest \
  io.github.hoonex.flow.test/androidx.test.runner.AndroidJUnitRunner \
  | tee -a "$OUT/instrumentation.txt"
planner_status=${PIPESTATUS[0]}

adb shell am instrument -w -r \
  -e class io.github.hoonex.flow.FlowThemeVisualTest \
  io.github.hoonex.flow.test/androidx.test.runner.AndroidJUnitRunner \
  | tee -a "$OUT/instrumentation.txt"
theme_status=${PIPESTATUS[0]}

adb shell am instrument -w -r \
  -e class io.github.hoonex.flow.FlowRecreationStateTest \
  io.github.hoonex.flow.test/androidx.test.runner.AndroidJUnitRunner \
  | tee -a "$OUT/instrumentation.txt"
recreation_status=${PIPESTATUS[0]}

# Shortcut navigation owns the task stack and intentionally runs last so it
# cannot perturb ActivityScenario-based recreation coverage above.
adb shell am instrument -w -r \
  -e class io.github.hoonex.flow.FlowShortcutNavigationTest \
  io.github.hoonex.flow.test/androidx.test.runner.AndroidJUnitRunner \
  | tee -a "$OUT/instrumentation.txt"
shortcut_status=${PIPESTATUS[0]}
set -e

adb pull "$REMOTE" "$OUT/screenshots" || true

if [ "$core_status" -ne 0 ] || [ "$map_status" -ne 0 ] || [ "$widget_status" -ne 0 ] || [ "$planner_status" -ne 0 ] || [ "$theme_status" -ne 0 ] || [ "$recreation_status" -ne 0 ] || [ "$shortcut_status" -ne 0 ] || \
   [ "$(grep -Ec 'OK \([0-9]+ test(s)?\)' "$OUT/instrumentation.txt")" -lt 7 ] || \
   grep -Eq 'FAILURES!!!|INSTRUMENTATION_FAILED|INSTRUMENTATION_ABORTED|Process crashed|shortMsg=' "$OUT/instrumentation.txt"; then
  exit 1
fi

count="$(find "$OUT/screenshots" -type f -name '*.png' | wc -l | tr -d ' ')"
test "$count" -eq 21
