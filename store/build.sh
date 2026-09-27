#!/bin/sh
# Builds the zip to upload to the Chrome Web Store.
cd "$(dirname "$0")/.." || exit 1
v=$(sed -n 's/.*"version": "\(.*\)".*/\1/p' manifest.json)
rm -f "store/focus-feed-$v.zip"
zip -qr "store/focus-feed-$v.zip" manifest.json shared.js focus.js focus.css popup.html popup.css popup.js icons fonts LICENSE -x icons/icon.svg
echo "store/focus-feed-$v.zip"
