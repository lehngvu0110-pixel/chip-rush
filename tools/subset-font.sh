#!/usr/bin/env bash
# Subset font Be Vietnam Pro (OFL) chỉ giữ ký tự Latin + tiếng Việt + vài ký hiệu dùng trong game.
# Cách dùng: tools/subset-font.sh <thư mục chứa BeVietnamPro-*.ttf>
# Cần: pip install fonttools brotli
set -euo pipefail
SRC="${1:?Thiếu thư mục chứa file .ttf gốc (tải từ github.com/google/fonts/tree/main/ofl/bevietnampro)}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/src/assets/fonts"
mkdir -p "$OUT"

# Dải Unicode theo subset "latin" + "vietnamese" của Google Fonts, cộng mũi tên và dấu ✓ ✕.
UNICODES="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2190-2195,U+2212,U+2215,U+FEFF,U+FFFD,\
U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB,U+2713,U+2715"

# tnum: số đều độ rộng cho bảng điểm; ccmp/mark/mkmk: ghép dấu tiếng Việt đúng vị trí.
FEATURES="kern,liga,calt,tnum,ccmp,mark,mkmk,locl"

for W in Regular Bold; do
  pyftsubset "$SRC/BeVietnamPro-$W.ttf" \
    --unicodes="$UNICODES" \
    --layout-features="$FEATURES" \
    --flavor=woff2 \
    --output-file="$OUT/BeVietnamPro-$W.subset.woff2"
done
ls -l "$OUT"
