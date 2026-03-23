#!/usr/bin/env zsh
# Bundle a Next.js static export into a single self-contained HTML file.
# Usage: ./bundle-html.sh <theme-dir> [output-file]
# Example: ./bundle-html.sh html-output/glassmorphism glassmorphism.html
set -e

THEME_DIR="${1:?Usage: bundle-html.sh <theme-dir> [output-file]}"
THEME_NAME="$(basename "$THEME_DIR")"
OUTPUT_FILE="${2:-${THEME_NAME}.html}"

if [ ! -f "$THEME_DIR/index.html" ]; then
  echo "Error: $THEME_DIR/index.html not found"
  exit 1
fi

echo "Bundling $THEME_DIR → $OUTPUT_FILE"

# Read index.html
HTML=$(cat "$THEME_DIR/index.html")

# 1. Find and inline all CSS files
for CSS_LINK in $(echo "$HTML" | grep -oE 'href="[^"]*\.css"' | sed 's/href="//;s/"//'); do
  # Resolve relative path
  CSS_PATH="$THEME_DIR/$CSS_LINK"
  if [ -f "$CSS_PATH" ]; then
    CSS_CONTENT=$(cat "$CSS_PATH")
    echo "  Inlined CSS: $CSS_LINK ($(wc -c < "$CSS_PATH" | tr -d ' ') bytes)"
    # Replace the <link rel="stylesheet" ...> with <style>...</style>
    # First escape special chars for sed
    ESCAPED_LINK=$(echo "$CSS_LINK" | sed 's/[.[\/*^$]/\\&/g')
    HTML=$(echo "$HTML" | sed "s|<link rel=\"stylesheet\" href=\"${ESCAPED_LINK}\"[^/]*/>\?||")
  fi
done

# 2. Convert images to base64 data URIs
for IMG_REF in $(echo "$HTML" | grep -oE 'src="\./images/[^"]*"' | sed 's/src="\.//;s/"//'); do
  IMG_PATH="$THEME_DIR$IMG_REF"
  if [ -f "$IMG_PATH" ]; then
    EXT="${IMG_PATH##*.}"
    MIME="image/png"
    [ "$EXT" = "jpg" ] || [ "$EXT" = "jpeg" ] && MIME="image/jpeg"
    [ "$EXT" = "svg" ] && MIME="image/svg+xml"
    [ "$EXT" = "gif" ] && MIME="image/gif"
    [ "$EXT" = "webp" ] && MIME="image/webp"
    B64=$(base64 < "$IMG_PATH" | tr -d '\n')
    DATA_URI="data:${MIME};base64,${B64}"
    SIZE=$(wc -c < "$IMG_PATH" | tr -d ' ')
    echo "  Inlined image: $IMG_REF ($SIZE bytes)"
    # Replace src="./images/xxx" with data URI
    ESCAPED_REF=$(echo ".$IMG_REF" | sed 's/[.[\/*^$]/\\&/g')
    HTML=$(echo "$HTML" | sed "s|src=\"${ESCAPED_REF}\"|src=\"${DATA_URI}\"|g")
  fi
done

# 3. Remove all <script> tags (React hydration not needed for static display)
HTML=$(echo "$HTML" | sed 's|<script[^>]*>.*</script>||g' | sed 's|<script[^>]*/>||g')

# 4. Remove <link rel="preload" as="script" ...> tags
HTML=$(echo "$HTML" | sed 's|<link rel="preload" as="script"[^/]*/>\?||g')

# 5. Inject the CSS inline in <head>
# Find all CSS files and create a combined <style> block
COMBINED_CSS=""
for CSS_FILE in "$THEME_DIR"/_next/static/chunks/*.css; do
  if [ -f "$CSS_FILE" ]; then
    COMBINED_CSS="${COMBINED_CSS}$(cat "$CSS_FILE")"
  fi
done

# Also inline Google Fonts CSS (download it)
FONT_URL=$(echo "$HTML" | grep -oE 'href="https://fonts\.googleapis\.com/css2[^"]*"' | head -1 | sed 's/href="//;s/"//')
if [ -n "$FONT_URL" ]; then
  # Replace &amp; with & for curl
  CLEAN_URL=$(echo "$FONT_URL" | sed 's/\&amp;/\&/g')
  FONT_CSS=$(curl -s -A "Mozilla/5.0" "$CLEAN_URL" 2>/dev/null || echo "")
  if [ -n "$FONT_CSS" ]; then
    COMBINED_CSS="${FONT_CSS}${COMBINED_CSS}"
    echo "  Inlined Google Fonts CSS"
    # Remove the font <link> tag
    ESCAPED_FONT=$(echo "$FONT_URL" | sed 's/[.[\/*^$&]/\\&/g')
    HTML=$(echo "$HTML" | sed "s|<link href=\"${ESCAPED_FONT}\" rel=\"stylesheet\"/>||")
  fi
fi

# Insert <style> block right before </head>
STYLE_TAG="<style>${COMBINED_CSS}</style>"
# Use a temp file to handle large content
TMPFILE=$(mktemp)
echo "$HTML" | sed "s|</head>|${STYLE_TAG}</head>|" > /dev/null 2>&1 || true

# Write using Python for reliability with large strings
python3 << PYEOF
import re

html = open("$THEME_DIR/index.html", "r").read()

# Read all CSS
css_parts = []
import glob
for f in sorted(glob.glob("$THEME_DIR/_next/static/chunks/*.css")):
    css_parts.append(open(f).read())
combined_css = "\n".join(css_parts)

# Download Google Fonts
font_url_match = re.search(r'href="(https://fonts\.googleapis\.com/css2[^"]*)"', html)
if font_url_match:
    import urllib.request
    try:
        url = font_url_match.group(1).replace("&amp;", "&")
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        font_css = urllib.request.urlopen(req).read().decode()
        combined_css = font_css + "\n" + combined_css
        print("  Inlined Google Fonts")
        # Remove font link tag
        html = html.replace(font_url_match.group(0).replace(font_url_match.group(1), font_url_match.group(1)), "")
        html = re.sub(r'<link href="https://fonts\.googleapis\.com/css2[^"]*" rel="stylesheet"/>', '', html)
    except:
        pass

# Remove external CSS link tags
html = re.sub(r'<link rel="stylesheet" href="[^"]*\.css"[^/]*/>', '', html)

# Inline images as base64
import base64, os
def replace_img(m):
    rel_path = m.group(1)
    full_path = os.path.join("$THEME_DIR", rel_path.lstrip("./"))
    if os.path.exists(full_path):
        ext = full_path.rsplit(".", 1)[-1].lower()
        mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "svg": "image/svg+xml", "gif": "image/gif", "webp": "image/webp"}.get(ext, "image/png")
        b64 = base64.b64encode(open(full_path, "rb").read()).decode()
        print(f"  Inlined image: {rel_path} ({os.path.getsize(full_path)} bytes)")
        return f'src="data:{mime};base64,{b64}"'
    return m.group(0)

html = re.sub(r'src="(\./images/[^"]*)"', replace_img, html)

# Remove all script tags
html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
html = re.sub(r'<script[^>]*/>', '', html)
html = re.sub(r'<link rel="preload" as="script"[^/]*/>', '', html)

# Remove hidden div and React internals
html = re.sub(r'<div hidden="">.*?</div>', '', html, count=1, flags=re.DOTALL)

# Make reveal elements visible
html = html.replace('class="bold-reveal', 'class="bold-reveal visible')
html = html.replace('class="reveal', 'class="reveal visible')

# Insert style in head
html = html.replace("</head>", f"<style>\n{combined_css}\n</style>\n</head>")

with open("$OUTPUT_FILE", "w") as f:
    f.write(html)

size = os.path.getsize("$OUTPUT_FILE")
print(f"\n  Output: $OUTPUT_FILE ({size:,} bytes)")
PYEOF
