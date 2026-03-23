#!/usr/bin/env python3
"""
Bundle a Next.js static export into a single self-contained HTML file.
All CSS inlined, images converted to base64, scripts removed.
Usage: python3 bundle-html.py <theme-dir> [output-file]
"""
import sys, os, re, base64, glob, urllib.request

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 bundle-html.py <theme-dir> [output-file]")
        sys.exit(1)

    theme_dir = sys.argv[1]
    theme_name = os.path.basename(theme_dir.rstrip("/"))
    output_file = sys.argv[2] if len(sys.argv) > 2 else f"{theme_name}.html"

    index_path = os.path.join(theme_dir, "index.html")
    if not os.path.exists(index_path):
        print(f"Error: {index_path} not found")
        sys.exit(1)

    print(f"Bundling {theme_dir} → {output_file}")

    html = open(index_path, "r").read()

    # 1. Collect all CSS
    css_parts = []

    # Download Google Fonts CSS
    font_match = re.search(r'href="(https://fonts\.googleapis\.com/css2[^"]*)"', html)
    if font_match:
        try:
            url = font_match.group(1).replace("&amp;", "&")
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"})
            font_css = urllib.request.urlopen(req, timeout=10).read().decode()
            css_parts.append(font_css)
            print(f"  Inlined Google Fonts ({len(font_css):,} bytes)")
        except Exception as e:
            print(f"  Warning: Could not fetch Google Fonts: {e}")
    # Remove font link tags
    html = re.sub(r'<link[^>]*href="https://fonts\.googleapis\.com/css2[^"]*"[^>]*/?\s*>', '', html)
    html = re.sub(r'<link[^>]*rel="preload"[^>]*href="https://fonts\.googleapis\.com[^>]*/?\s*>', '', html)

    # Read local CSS files
    for css_file in sorted(glob.glob(os.path.join(theme_dir, "_next/static/chunks/*.css"))):
        css_content = open(css_file).read()
        css_parts.append(css_content)
        print(f"  Inlined CSS: {os.path.basename(css_file)} ({len(css_content):,} bytes)")

    combined_css = "\n".join(css_parts)

    # Remove external CSS link tags
    html = re.sub(r'<link[^>]*rel="stylesheet"[^>]*href="[^"]*\.css"[^>]*/?\s*>', '', html)

    # 2. Inline images as base64
    def replace_img(m):
        rel_path = m.group(1)
        # Handle both ./images/ and images/ paths
        clean_path = rel_path.lstrip("./")
        full_path = os.path.join(theme_dir, clean_path)
        if os.path.exists(full_path):
            ext = full_path.rsplit(".", 1)[-1].lower()
            mime_map = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
                       "svg": "image/svg+xml", "gif": "image/gif", "webp": "image/webp"}
            mime = mime_map.get(ext, "image/png")
            b64 = base64.b64encode(open(full_path, "rb").read()).decode()
            size = os.path.getsize(full_path)
            print(f"  Inlined image: {rel_path} ({size:,} bytes)")
            return f'src="data:{mime};base64,{b64}"'
        return m.group(0)

    html = re.sub(r'src="(\./images/[^"]*)"', replace_img, html)
    html = re.sub(r'src="(images/[^"]*)"', replace_img, html)

    # 3. Remove all script tags and preloads
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
    html = re.sub(r'<script[^>]*/\s*>', '', html)
    html = re.sub(r'<link[^>]*rel="preload"[^>]*as="script"[^>]*/?\s*>', '', html)

    # 4. Remove React hidden div
    html = re.sub(r'<div hidden="">.*?</div>', '', html, count=1, flags=re.DOTALL)

    # 5. Make reveal elements visible (no JS observer in static HTML)
    html = html.replace('class="bold-reveal', 'class="bold-reveal visible')
    html = html.replace('class="reveal', 'class="reveal visible')

    # 6. Clean up empty lines
    html = re.sub(r'\n\s*\n\s*\n', '\n\n', html)

    # 7. Insert combined <style> in <head>
    style_tag = f"<style>\n{combined_css}\n</style>"
    html = html.replace("</head>", f"{style_tag}\n</head>")

    # Write output
    with open(output_file, "w") as f:
        f.write(html)

    size = os.path.getsize(output_file)
    print(f"\n  Output: {output_file} ({size:,} bytes)")
    print("  Done!")

if __name__ == "__main__":
    main()
