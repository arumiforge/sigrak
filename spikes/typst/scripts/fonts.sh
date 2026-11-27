#!/usr/bin/env bash
# Fill spikes/typst/fonts/ with the exact font set the spike renders with.
# The CLI and the browser test both load fonts only from this folder
# (--ignore-system-fonts --ignore-embedded-fonts), so server and phone
# render with identical fonts. The folder is not committed.
#
# Sources (pinned versions):
#   Liberation Sans/Serif/Mono 2.1.5  package fonts-liberation (OFL 1.1)
#   Noto Naskh Arabic 2.021           release of notofonts/arabic (OFL 1.1)
#   Amiri 1.003                       release of aliftype/amiri (OFL 1.1)
#   New Computer Modern Math          typst-assets v0.15.1 (GUST Font License)
#
# Do not use the distribution's Noto Naskh Arabic: Debian/Ubuntu's
# fonts-noto-core 20201225 ships 2.004, which draws the end-of-ayah sign
# (U+06DD) over the preceding word. 2.021 draws it correctly.
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
out="$here/fonts"
mkdir -p "$out"
download() { node "$here/scripts/download.mjs" "$1" "$2"; }

liberation=(
  LiberationSans-Regular LiberationSans-Bold LiberationSans-Italic LiberationSans-BoldItalic
  LiberationSerif-Regular LiberationSerif-Bold LiberationSerif-Italic LiberationSerif-BoldItalic
  LiberationMono-Regular
)
for f in "${liberation[@]}"; do
  src="/usr/share/fonts/truetype/liberation/$f.ttf"
  if [[ ! -f "$src" ]]; then
    echo "Missing $src (install the fonts-liberation package)" >&2
    exit 1
  fi
  cp "$src" "$out/"
done

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

naskh="2.021"
if [[ ! -f "$out/NotoNaskhArabic-Regular.ttf" ]]; then
  download "https://github.com/notofonts/arabic/releases/download/NotoNaskhArabic-v$naskh/NotoNaskhArabic-v$naskh.zip" \
    "$tmp/naskh.zip"
  unzip -q "$tmp/naskh.zip" -d "$tmp/naskh"
  cp "$tmp/naskh/NotoNaskhArabic/hinted/ttf/NotoNaskhArabic-Regular.ttf" \
    "$tmp/naskh/NotoNaskhArabic/hinted/ttf/NotoNaskhArabic-Bold.ttf" "$out/"
fi

amiri="1.003"
if [[ ! -f "$out/Amiri-Regular.ttf" ]]; then
  download "https://github.com/aliftype/amiri/releases/download/$amiri/Amiri-$amiri.zip" "$tmp/amiri.zip"
  unzip -q "$tmp/amiri.zip" -d "$tmp/amiri"
  cp "$tmp/amiri/Amiri-$amiri/Amiri-Regular.ttf" "$tmp/amiri/Amiri-$amiri/Amiri-Bold.ttf" "$out/"
fi

# Math: New Computer Modern Math, the font the Typst CLI embeds. The browser
# compiler embeds no fonts, so the file comes from typst-assets at the Typst
# version in use. Its Computer Modern look matches KaTeX on screen.
typst_assets="v0.15.1"
if [[ ! -f "$out/NewCMMath-Regular.otf" ]]; then
  download "https://raw.githubusercontent.com/typst/typst-assets/$typst_assets/files/fonts/NewCMMath-Regular.otf" \
    "$out/NewCMMath-Regular.otf"
fi

ls -1 "$out"
