#!/bin/bash
# Startet den Schriftkasten im Hintergrund und öffnet ihn im Browser.
# Läuft er schon, wird nur das Browserfenster geöffnet.

APP_RES="$(cd "$(dirname "$0")/../Resources/app" && pwd)"
SUP="$HOME/Library/Application Support/Schriftkasten"
LOG="$SUP/server.log"
PORT="${SK_PORT:-8737}"
URL="http://127.0.0.1:$PORT/"
mkdir -p "$SUP"
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.pyenv/shims:/usr/bin:/bin:/usr/sbin:/sbin"

note() { /usr/bin/osascript -e "display notification \"$1\" with title \"Schriftkasten\"" >/dev/null 2>&1; }
fail() {
  /usr/bin/osascript -e "display dialog \"$1\" with title \"Schriftkasten\" buttons {\"Protokoll zeigen\", \"OK\"} default button \"OK\" with icon caution" \
    -e 'if button returned of result is "Protokoll zeigen" then do shell script "open -a Console " & quoted form of "'"$LOG"'"' >/dev/null 2>&1
  exit 1
}
running() { /usr/bin/curl -s -m 1 "${URL}api/ping" 2>/dev/null | grep -q schriftkasten; }

# Läuft schon? Bei gleicher Version nur öffnen, sonst alte Version beenden.
WANT="$(grep -m1 '^APP_VERSION' "$APP_RES/serve.py" | cut -d'"' -f2)"
if running; then
  HAVE="$(/usr/bin/curl -s -m 1 "${URL}api/ping" | sed -n 's/.*"version": *"\([^"]*\)".*/\1/p')"
  if [ "$HAVE" = "$WANT" ]; then open "$URL"; exit 0; fi
  /usr/bin/curl -s -m 2 -X POST -H "X-Schriftkasten: 1" -H "Content-Type: application/json" -d '{}' "${URL}api/quit" >/dev/null 2>&1
  for i in $(seq 1 20); do running || break; sleep 0.3; done
  if running; then
    PID="$(/usr/bin/curl -s -m 1 "${URL}api/ping" | sed -n 's/.*"pid": *\([0-9]*\).*/\1/p')"
    [ -n "$PID" ] && kill "$PID" 2>/dev/null; sleep 1
  fi
fi

# Python-Umgebung einmalig einrichten
VENV="$SUP/venv"
if [ ! -x "$VENV/bin/python" ] || ! "$VENV/bin/python" -c "import fontTools, brotli" 2>/dev/null; then
  PY=""
  for c in /opt/homebrew/bin/python3 /usr/local/bin/python3 "$HOME/.pyenv/shims/python3" /usr/bin/python3; do
    if [ -x "$c" ] && "$c" -c "import venv, sys; assert sys.version_info >= (3, 8)" 2>/dev/null; then PY="$c"; break; fi
  done
  [ -z "$PY" ] && fail "Kein Python 3 gefunden. Bitte Python über Homebrew installieren (brew install python) und erneut starten."
  note "Einmalige Einrichtung, dauert etwa eine Minute …"
  {
    echo "== Einrichtung $(date) mit $PY"
    rm -rf "$VENV"
    "$PY" -m venv "$VENV" && "$VENV/bin/pip" install -q --upgrade pip && "$VENV/bin/pip" install -q fonttools brotli
  } >> "$LOG" 2>&1 || fail "Die Einrichtung ist fehlgeschlagen. Details stehen im Protokoll."
fi

note "Lese Schriften ein …"
export SK_DATA="$SUP"
cd "$APP_RES" || fail "App-Dateien nicht gefunden."
echo "== Start $(date)" >> "$LOG"
nohup "$VENV/bin/python" serve.py --scan --no-browser --port "$PORT" >> "$LOG" 2>&1 &

for i in $(seq 1 120); do
  if running; then open "$URL"; exit 0; fi
  sleep 0.5
done
fail "Der Schriftkasten ist nicht angesprungen. Details stehen im Protokoll."
