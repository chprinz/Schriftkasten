#!/bin/bash
# Baut dist/Schriftkasten.app aus dem aktuellen Stand des Repos.
set -e
cd "$(dirname "$0")/.."
APP="dist/Schriftkasten.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/app/web" "$APP/Contents/Resources/app/data"
cp macos/Info.plist "$APP/Contents/"
cp macos/launcher.sh "$APP/Contents/MacOS/Schriftkasten"
chmod +x "$APP/Contents/MacOS/Schriftkasten"
cp macos/AppIcon.icns "$APP/Contents/Resources/"
# Mitteilungen mit App-Symbol, die sich selbst wieder zurücknehmen (eigene Mini-App,
# weil macOS Mitteilungen nur an Apps vergibt, die über LaunchServices gestartet werden)
N="$APP/Contents/Helpers/Notify.app"
mkdir -p "$N/Contents/MacOS" "$N/Contents/Resources"
if swiftc -O macos/notify.swift -o "$N/Contents/MacOS/notify" 2>/dev/null; then
  cp macos/Notify-Info.plist "$N/Contents/Info.plist"
  cp macos/AppIcon.icns "$N/Contents/Resources/"
  echo "Mitteilungshelfer gebaut"
else
  rm -rf "$APP/Contents/Helpers"
  echo "Hinweis: swiftc fehlt, Mitteilungen laufen über osascript (ohne App-Symbol)"
fi
cp scan.py serve.py fontbook.py curated.json "$APP/Contents/Resources/app/"
cp web/index.html web/app.css web/app.js "$APP/Contents/Resources/app/web/"
cp data/google-fonts-meta.json "$APP/Contents/Resources/app/data/"
# Ohne Signatur nimmt macOS dem Mitteilungshelfer die Berechtigung nicht ab
codesign --force --deep -s - "$APP" >/dev/null 2>&1 || true
echo "Gebaut: $APP"
