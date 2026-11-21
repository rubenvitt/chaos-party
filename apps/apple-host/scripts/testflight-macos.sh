#!/usr/bin/env bash
# Archiviert die App-Store-Variante der Mac-App (Ziel ChaosHostAppStore, CHAOS-200) und lädt sie zu TestFlight
# hoch. Aufbau wie scripts/testflight.sh (tvOS, CHAOS-151); beide landen im selben App-Eintrag „Chaos Party Host“
# (dev.rubeen.chaosparty.tv, Universal Purchase).
#
# Anders als die Developer-ID-App (release-macos.sh, Sparkle) läuft diese Variante in der App Sandbox und ohne
# Selbst-Updater. Das Archiv ist ad hoc signiert, damit Xcode keinen Entwicklungs-Mac (wechselnde CI-Runner) im
# Konto registriert; erst der Export signiert mit „Apple Distribution“ und dem App-Store-Profil (Cloud-Signatur
# über den API-Key) und lädt hoch. Vorher prüft das Skript die gebaute App mit --selftest in der Sandbox.
#
# Umgebung:
#   ASC_KEY_ID, ASC_ISSUER_ID   Pflicht (CI); lokal mit XCODE_ACCOUNT=1 nicht nötig
#   XCODE_ACCOUNT=1             mit dem in Xcode angemeldeten Account signieren und hochladen
#   ASC_KEY_PATH                Standard ~/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8
#   BUILD_NUMBER                Standard UTC-Zeitstempel JJJJMMTT.HHMM (steigt mit jedem Lauf)
#   UPLOAD=0                    nur archivieren und exportieren (.pkg), nicht hochladen
#   SKIP_PREPARE=1              vorhandenes payload/ nehmen, prepare.sh nicht aufrufen
#   SKIP_SELFTEST=1             Selbsttest des Archivs auslassen
#   SKIP_BUILD=1                an prepare.sh durchgereicht: vorhandene Builds statt neu bauen
set -euo pipefail

cd "$(dirname "$0")/.."

TEAM_ID="H95J852PKP"
SCHEME="ChaosHostAppStore"
APP_NAME="Chaos Party"

XCODE_ACCOUNT="${XCODE_ACCOUNT:-0}"
UPLOAD="${UPLOAD:-1}"
if [[ "$XCODE_ACCOUNT" != 1 ]]; then
  : "${ASC_KEY_ID:?ASC_KEY_ID fehlt}"
  : "${ASC_ISSUER_ID:?ASC_ISSUER_ID fehlt}"
  ASC_KEY_PATH="${ASC_KEY_PATH:-$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8}"
  [[ -f "$ASC_KEY_PATH" ]] || { echo "API-Key nicht gefunden: $ASC_KEY_PATH" >&2; exit 1; }
fi
BUILD_NUMBER="${BUILD_NUMBER:-$(date -u +%Y%m%d.%H%M)}"

if [[ "${SKIP_PREPARE:-0}" != 1 ]]; then
  ./prepare.sh
fi

missing=0
for f in chaos-host.js HavokPhysics.wasm LICENSE.txt THIRD-PARTY-NOTICES.txt controller/index.html sounds/tick-1.mp3; do
  [[ -s "payload/$f" ]] || { echo "Nutzlast unvollständig: payload/$f fehlt" >&2; missing=1; }
done
if [[ "$missing" == 1 ]]; then
  echo "Erzeugen: apps/apple-host/prepare.sh" >&2
  exit 1
fi

OUT="build/testflight-macos"
ARCHIVE="$OUT/ChaosHostAppStore.xcarchive"
rm -rf "$OUT"
mkdir -p "$OUT"

AUTH=(-allowProvisioningUpdates)
if [[ "$XCODE_ACCOUNT" != 1 ]]; then
  AUTH+=(-authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
fi

DESTINATION="upload"
[[ "$UPLOAD" == 1 ]] || DESTINATION="export"

cat > "$OUT/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>$DESTINATION</string>
  <key>signingStyle</key><string>automatic</string>
  <key>teamID</key><string>$TEAM_ID</string>
  <key>manageAppVersionAndBuildNumber</key><false/>
  <key>uploadSymbols</key><true/>
</dict>
</plist>
PLIST

echo "Build $BUILD_NUMBER (macOS, App Store), Nutzlast $(du -sh payload | cut -f1)"

xcodegen generate

# Ad hoc archivieren (siehe oben); Release baut universal (arm64 + x86_64).
xcodebuild -project ChaosHost.xcodeproj -scheme "$SCHEME" -configuration Release \
  -destination 'generic/platform=macOS' -archivePath "$ARCHIVE" \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER" archive

APP="$ARCHIVE/Products/Applications/$APP_NAME.app"
for f in payload/chaos-host.js payload/HavokPhysics.wasm payload/controller/index.html payload/sounds/tick-1.mp3; do
  [[ -s "$APP/Contents/Resources/$f" ]] || { echo "Archiv ohne $f: $APP" >&2; exit 1; }
done
[[ ! -e "$APP/Contents/Frameworks/Sparkle.framework" ]] || { echo "Sparkle im App-Store-Build: $APP" >&2; exit 1; }
codesign -d --entitlements - --xml "$APP" 2>/dev/null | grep -q "com.apple.security.app-sandbox" \
  || { echo "App Sandbox fehlt in der Signatur: $APP" >&2; exit 1; }

# Die App, wie sie ausgeliefert wird, in der Sandbox: JS-Kern, Havok, HTTP und WebSocket (SelfTest.swift).
if [[ "${SKIP_SELFTEST:-0}" != 1 ]]; then
  "$APP/Contents/MacOS/$APP_NAME" --selftest
fi

# Export signiert mit „Apple Distribution“ und lädt bei destination=upload direkt zu App Store Connect hoch.
xcodebuild -exportArchive -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$OUT/ExportOptions.plist" -exportPath "$OUT/export" \
  "${AUTH[@]}"

if [[ "$UPLOAD" == 1 ]]; then
  echo "Hochgeladen: Build $BUILD_NUMBER"
else
  echo "Exportiert (nicht hochgeladen): $OUT/export"
fi
