#!/usr/bin/env zsh
# Generate style-matched avatar images for each theme in html-output
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_BASE="$PROJECT_DIR/html-output"
SERVER_URL="http://localhost:3000"

typeset -A AVATAR_PROMPTS
AVATAR_PROMPTS[minimalist]="A perfectly minimal geometric circle and line abstract icon, black on white, clean Swiss design aesthetic, mathematical precision, no person no face, absolutely no text, no letters, no words, no characters, no writing, no symbols, no watermarks"
AVATAR_PROMPTS[ghibli]="A cute Studio Ghibli style watercolor painting of an adorable fluffy orange tabby cat sitting upright with big expressive round eyes, wearing a tiny green leaf scarf, soft warm lighting, dreamy pastel background with floating dandelion seeds, Miyazaki watercolor illustration style, gentle and whimsical, circular portrait crop, absolutely no text, no letters, no words, no characters, no writing, no symbols, no watermarks"
AVATAR_PROMPTS[glassmorphism]="An abstract frosted glass orb icon with soft purple and blue gradients inside, bokeh light effects around it, translucent crystal sphere, dark background, no person no face, absolutely no text, no letters, no words, no characters, no writing, no symbols, no watermarks"
AVATAR_PROMPTS[brutalist]="A bold geometric abstract icon with thick black lines and red accent, stark minimalist composition, raw concrete texture background, brutalist design, no person no face, absolutely no text, no letters, no words, no characters, no writing, no symbols, no watermarks"
AVATAR_PROMPTS[tpl-resume-bold]="A bold geometric star shape icon with vivid pink and cyan halves, thick black outline, hard shadow, brutalist pop art style, no person no face, absolutely no text, no letters, no words, no characters, no writing, no symbols, no watermarks"

echo "=== Avatar Generator ==="
echo ""

for THEME in ${(k)AVATAR_PROMPTS}; do
  DEST="$OUTPUT_BASE/$THEME/images"
  if [ ! -d "$DEST" ]; then
    echo "  Skipping $THEME (no html-output directory)"
    continue
  fi

  PROMPT="${AVATAR_PROMPTS[$THEME]}"
  echo "[$THEME] Generating avatar..."

  # Call generate-image API
  RESULT=$(curl -s -X POST "$SERVER_URL/api/generate-image" \
    -H "Content-Type: application/json" \
    -d "{\"prompt\": $(echo "$PROMPT" | jq -Rs .), \"filename\": \"avatar-$THEME.png\", \"style\": \"$THEME\"}" \
    --max-time 60)

  if echo "$RESULT" | grep -q '"success"'; then
    SRC="$PROJECT_DIR/output/public/images/avatar-$THEME.png"
    if [ -f "$SRC" ]; then
      cp "$SRC" "$DEST/avatar.png"
      SIZE=$(stat -f%z "$DEST/avatar.png" 2>/dev/null || stat -c%s "$DEST/avatar.png" 2>/dev/null)
      echo "  Done: $DEST/avatar.png ($SIZE bytes)"
    else
      echo "  Warning: Generated but file not found at $SRC"
    fi
  else
    echo "  Error: $RESULT"
  fi
done

echo ""
echo "=== Complete! ==="
