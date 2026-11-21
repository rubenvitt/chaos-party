#!/usr/bin/env bash
# Archiviert den nativen Apple-Host (ADR-019) für tvOS signiert und lädt ihn zu TestFlight hoch
# (CHAOS-151, vorher der RealityKit-Spike seit CHAOS-119). Aufbau wie
# apps/controller-ios/scripts/testflight.sh (CHAOS-115).
#
# Die App erscheint als „Chaos Party“ mit der Bundle-ID dev.rubeen.chaosparty.tv; der App-Eintrag
# muss in App Store Connect existieren. project.yml signiert nur lokal (dev.rubeen.chaosparty.host);
# Bundle-ID, Team und Signatur überschreibt dieses Skript auf der Kommandozeile.
#
# Die Nutzlast (JS-Kern, Havok, Lizenztexte, Browser-Controller) legt ../prepare.sh an. Fehlt ein
# Teil, bricht das Skript ab, damit keine App ohne Spiel bei TestFlight landet.
#
# Umgebung:
#   ASC_KEY_ID, ASC_ISSUER_ID   Pflicht (CI); lokal mit XCODE_ACCOUNT=1 nicht nötig
#   XCODE_ACCOUNT=1             mit dem in Xcode angemeldeten Account signieren und hochladen
#   ASC_KEY_PATH                Standard ~/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8
#   BUILD_NUMBER                Standard UTC-Zeitstempel JJJJMMTT.HHMM (steigt mit jedem Lauf)
#   UPLOAD=0                    nur archivieren und exportieren (.ipa), nicht hochladen
#   SKIP_PREPARE=1              vorhandenes payload/ nehmen, prepare.sh nicht aufrufen
#   SKIP_BUILD=1                an prepare.sh durchgereicht: vorhandene Builds statt neu bauen
set -euo pipefail

cd "$(dirname "$0")/.."

BUNDLE_ID="dev.rubeen.chaosparty.tv"
TEAM_ID="H95J852PKP"

XCODE_ACCOUNT="${XCODE_ACCOUNT:-0}"
UPLOAD="${UPLOAD:-1}"
if [[ "$XCODE_ACCOUNT" != 1 ]]; then
  : "${ASC_KEY_ID:?ASC_KEY_ID fehlt}"
  : "${ASC_ISSUER_ID:?ASC_ISSUER_ID fehlt}"
  ASC_KEY_PATH="${ASC_KEY_PATH:-$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8}"
  [[ -f "$ASC_KEY_PATH" ]] || { echo "API-Key nicht gefunden: $ASC_KEY_PATH" >&2; exit 1; }
fi
# Zwei Zahlen statt einer, damit jede Komponente in 32 Bit passt.
BUILD_NUMBER="${BUILD_NUMBER:-$(date -u +%Y%m%d.%H%M)}"

if [[ "${SKIP_PREPARE:-0}" != 1 ]]; then
  ./prepare.sh
fi

# Ohne diese Dateien startet die App, hostet aber kein Spiel (HostRuntime lädt sie aus dem Bundle).
missing=0
for f in chaos-host.js HavokPhysics.wasm LICENSE.txt THIRD-PARTY-NOTICES.txt controller/index.html sounds/tick-1.mp3; do
  [[ -s "payload/$f" ]] || { echo "Nutzlast unvollständig: payload/$f fehlt" >&2; missing=1; }
done
if [[ "$missing" == 1 ]]; then
  echo "Erzeugen: apps/apple-host/prepare.sh" >&2
  exit 1
fi

OUT="build/testflight"
ARCHIVE="$OUT/ChaosHost.xcarchive"
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

echo "Build $BUILD_NUMBER ($BUNDLE_ID), Nutzlast $(du -sh payload | cut -f1)"

xcodegen generate

# Nur für tvOS (Gerät); die Mac-App kommt mit Notarisierung in CHAOS-118.
xcodebuild -project ChaosHost.xcodeproj -scheme ChaosHost -configuration Release \
  -destination 'generic/platform=tvOS' -archivePath "$ARCHIVE" \
  PRODUCT_BUNDLE_IDENTIFIER="$BUNDLE_ID" \
  DEVELOPMENT_TEAM="$TEAM_ID" CODE_SIGN_STYLE=Automatic CODE_SIGN_IDENTITY="Apple Development" \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
  "${AUTH[@]}" archive

# Die Nutzlast muss im Archiv stecken; ein leerer Ordner fiele sonst erst auf der Apple TV auf.
APP="$ARCHIVE/Products/Applications/ChaosHost.app"
for f in payload/chaos-host.js payload/HavokPhysics.wasm payload/controller/index.html payload/sounds/tick-1.mp3; do
  [[ -s "$APP/$f" ]] || { echo "Archiv ohne $f: $APP" >&2; exit 1; }
done

# Der Export lädt bei destination=upload direkt zu App Store Connect hoch; die Plattform
# (appletvos) kommt aus dem Archiv, ein eigenes `altool --type appletvos` ist nicht nötig.
xcodebuild -exportArchive -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$OUT/ExportOptions.plist" -exportPath "$OUT/export" \
  "${AUTH[@]}"

if [[ "$UPLOAD" == 1 ]]; then
  echo "Hochgeladen: Build $BUILD_NUMBER"
else
  echo "Exportiert (nicht hochgeladen): $OUT/export"
fi
