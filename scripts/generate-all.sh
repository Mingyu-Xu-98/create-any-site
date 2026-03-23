#!/bin/bash
# Generate static HTML for all 5 resume themes from a workspace zip
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ZIP_FILE="${1:-$PROJECT_DIR/resume-test.zip}"
OUTPUT_BASE="$PROJECT_DIR/html-output"
OUTPUT_DIR="$PROJECT_DIR/output"
SERVER_URL="http://localhost:3000"

THEMES=("minimalist" "ghibli" "glassmorphism" "brutalist" "tpl-resume-bold")
THEME_NAMES=("极简主义" "吉卜力" "玻璃拟态" "暗码终端" "大胆简历")
LAYOUTS=("f-shape" "hero-media" "card-grid" "asymmetric" "card-grid")

echo "=== Batch Resume Generator ==="
echo "ZIP: $ZIP_FILE"
echo "Output: $OUTPUT_BASE"
echo ""

# Check zip exists
if [ ! -f "$ZIP_FILE" ]; then
  echo "Error: $ZIP_FILE not found"
  exit 1
fi

# Clean output base
rm -rf "$OUTPUT_BASE"
mkdir -p "$OUTPUT_BASE"

# Step 1: Upload zip and get workspace data
echo "[1/3] Analyzing workspace zip..."
WORKSPACE_DATA=$(curl -s -X POST "$SERVER_URL/api/analyze" \
  -F "file=@$ZIP_FILE" \
  --max-time 30 | tr -d '\000-\037')

# Check for errors
if echo "$WORKSPACE_DATA" | grep -q '"error"'; then
  echo "Error analyzing zip: $WORKSPACE_DATA"
  exit 1
fi

echo "  Workspace data extracted successfully"

# Step 2: Generate each theme
for i in "${!THEMES[@]}"; do
  THEME="${THEMES[$i]}"
  NAME="${THEME_NAMES[$i]}"
  LAYOUT="${LAYOUTS[$i]}"

  echo ""
  echo "[2/3] Generating theme $((i+1))/5: $NAME ($THEME)..."

  # Build selections JSON — enable all features
  SELECTIONS=$(cat <<JSONEOF
{
  "siteType": "portfolio",
  "theme": "$THEME",
  "layout": "$LAYOUT",
  "customSiteType": "",
  "customTheme": "",
  "customLayout": "",
  "features": {
    "chatbot": true,
    "i18n": true,
    "animations": true,
    "share": true
  }
}
JSONEOF
)

  # Build the full request body
  REQUEST_BODY=$(jq -n \
    --argjson data "$WORKSPACE_DATA" \
    --argjson selections "$SELECTIONS" \
    '{data: $data, selections: $selections}')

  # Call generate API
  RESULT=$(curl -s -X POST "$SERVER_URL/api/generate" \
    -H "Content-Type: application/json" \
    -d "$REQUEST_BODY" \
    --max-time 180)

  if echo "$RESULT" | grep -q '"error"'; then
    echo "  Error: $RESULT"
    continue
  fi

  echo "  Generated. Preparing for static build..."

  # Kill any dev server on 3001
  lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null || true
  sleep 1

  # Modify next.config.ts for static export
  cat > "$OUTPUT_DIR/next.config.ts" << 'CONFIGEOF'
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};
export default nextConfig;
CONFIGEOF

  # Remove API routes (not compatible with static export)
  rm -rf "$OUTPUT_DIR/src/app/api" 2>/dev/null || true

  # Add qrcode type declaration so SharePoster compiles
  mkdir -p "$OUTPUT_DIR/src"
  cat > "$OUTPUT_DIR/src/qrcode.d.ts" << 'DTSEOF'
declare module 'qrcode' {
  export function toDataURL(text: string, options?: Record<string, unknown>): Promise<string>;
  export function toCanvas(canvas: HTMLCanvasElement, text: string, options?: Record<string, unknown>): Promise<void>;
  export function toString(text: string, options?: Record<string, unknown>): Promise<string>;
}
DTSEOF

  # Build static site
  echo "  Building..."
  cd "$OUTPUT_DIR"
  npx next build 2>&1 | tail -8
  cd "$PROJECT_DIR"

  # Copy static output
  if [ -d "$OUTPUT_DIR/out" ]; then
    DEST="$OUTPUT_BASE/$THEME"
    cp -r "$OUTPUT_DIR/out" "$DEST"

    # Fix absolute paths to relative so HTML works when opened directly
    find "$DEST" -name "*.html" -exec sed -i '' 's|"/_next/|"./_next/|g' {} \;
    find "$DEST" -name "*.html" -exec sed -i '' "s|'/_next/|'./_next/|g" {} \;
    find "$DEST" -name "*.html" -exec sed -i '' 's|src="/images/|src="./images/|g' {} \;
    find "$DEST" -name "*.html" -exec sed -i '' 's|href="/images/|href="./images/|g' {} \;

    # Make reveal/scroll-animated elements visible in static HTML (no JS observer)
    find "$DEST" -name "*.html" -exec sed -i '' 's|class="bold-reveal|class="bold-reveal visible|g' {} \;
    find "$DEST" -name "*.html" -exec sed -i '' 's|class="reveal|class="reveal visible|g' {} \;

    # Count files
    FILE_COUNT=$(find "$DEST" -name "*.html" | wc -l | tr -d ' ')
    echo "  Done: $DEST ($FILE_COUNT HTML files)"
  else
    echo "  Warning: No static output generated for $THEME"
  fi
done

# Clean up
echo ""
echo "[3/3] Cleaning up..."
lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null || true

echo ""
echo "=== Complete! ==="
echo "Output directory: $OUTPUT_BASE"
echo ""
ls -la "$OUTPUT_BASE"
