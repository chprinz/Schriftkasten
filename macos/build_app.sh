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
cp scan.py serve.py curated.json "$APP/Contents/Resources/app/"
cp web/index.html web/app.css web/app.js "$APP/Contents/Resources/app/web/"
cp data/google-fonts-meta.json "$APP/Contents/Resources/app/data/"
echo "Gebaut: $APP"
