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
# Eingebautes Python samt Bibliotheken: kein Python auf dem Mac und kein Internet beim ersten Start nötig.
# Die Laufzeit stammt von python-build-standalone und wird nur beim ersten Bauen geladen.
PYTAG="20261110"; PYVER="3.12.16"
case "$(uname -m)" in arm64) PYARCH=aarch64;; *) PYARCH=x86_64;; esac
PYTAR="cpython-$PYVER+$PYTAG-$PYARCH-apple-darwin-install_only.tar.gz"
CACHE="$HOME/Library/Caches/Schriftkasten-build"
mkdir -p "$CACHE"
if [ ! -f "$CACHE/$PYTAR" ]; then
  echo "Lade Python-Laufzeit …"
  gh release download "$PYTAG" -R astral-sh/python-build-standalone -p "$PYTAR" -D "$CACHE"
fi
tar -xzf "$CACHE/$PYTAR" -C "$APP/Contents/Resources"
PYB="$APP/Contents/Resources/python/bin/python3"
# Pakete mit dem Python des Build-Rechners laden, aber für die eingebaute Laufzeit (cp312, passende Architektur)
case "$PYARCH" in aarch64) PLAT=macosx_11_0_arm64;; *) PLAT=macosx_10_13_x86_64;; esac
SP="$APP/Contents/Resources/python/lib/python3.12/site-packages"
python3 -m pip install -q --disable-pip-version-check --target "$SP" --only-binary=:all: \
  --platform "$PLAT" --python-version 3.12 --implementation cp --abi cp312 \
  fonttools brotli pyobjc-framework-Cocoa
# Verkleinern und vorab übersetzen, damit zur Laufzeit nichts in die App geschrieben wird
P="$APP/Contents/Resources/python"
rm -rf "$P/include" "$P/share" "$P"/lib/python3*/test "$P"/lib/python3*/idlelib "$P"/lib/python3*/turtledemo \
       "$P"/lib/python3*/site-packages/pip "$P"/lib/python3*/site-packages/pip-* \
       "$P"/lib/python3*/site-packages/setuptools* "$P"/lib/python3*/site-packages/PyObjCTest "$P"/lib/python3*/ensurepip "$P"/lib/python3*/site-packages/_distutils_hack
"$PYB" -m compileall -q "$P/lib" >/dev/null 2>&1 || true

# Ohne Signatur nimmt macOS dem Mitteilungshelfer die Berechtigung nicht ab
codesign --force --deep -s - "$APP" 2>&1 | grep -v "replacing existing signature" || true
echo "Gebaut: $APP"
