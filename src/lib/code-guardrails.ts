/**
 * Code guardrails — auto-detect and fix common issues in generated site code
 * before writing to disk and building.
 *
 * Runs after generateFileMap() and before writeFilesToSiteDir().
 * Fixes issues in-place and logs warnings.
 */

interface Logger {
  info: (scope: string, msg: string, meta?: unknown) => void;
  warn: (scope: string, msg: string, meta?: unknown) => void;
}

export function runCodeGuardrails(
  files: Record<string, string>,
  siteId: string,
  previewBaseUrl: string,
  logger: Logger,
): Record<string, string> {
  const fixes: string[] = [];

  // 1. Fix ChatBot API URL — static export doesn't support API routes
  fixChatBotApiUrl(files, siteId, previewBaseUrl, fixes);

  // 2. Fix SharePoster canvas text overflow
  fixSharePosterOverflow(files, fixes);

  // 3. Ensure project cards have click interaction
  fixProjectCardInteraction(files, fixes);

  // 4. Fix missing "use client" on interactive components
  fixMissingUseClient(files, fixes);

  // 5. Fix unresolved imports
  fixUnresolvedImports(files, fixes);

  // 6. Fix CSS overflow issues
  fixCssOverflow(files, fixes);

  // 7. Fix bare special chars in JSX text (>, <, {, })
  fixJsxBareSpecialChars(files, fixes);

  // 7b. Fix texture-overlay and other fullscreen overlays blocking clicks
  fixOverlayPointerEvents(files, fixes);

  // 8. Ensure SharePoster is imported and used
  fixMissingSharePoster(files, fixes);

  // 9. Ensure translations.ts exports Lang and Translations types
  fixTranslationsExports(files, fixes);

  // 10. Fix named import of LanguageProvider → default import
  fixLanguageProviderImport(files, fixes);

  if (fixes.length > 0) {
    logger.info("guardrails", `Applied ${fixes.length} auto-fixes for site ${siteId}`, { fixes });
  }

  return files;
}

/** Fix ChatBot / CartoonAssistant chat API URL for static export.
 *  Static exports can't use /api/chat — must proxy through the host app.
 *  Replace with a runtime resolver that works in both dev (cross-port) and prod (same origin). */
function fixChatBotApiUrl(
  files: Record<string, string>,
  siteId: string,
  _previewBaseUrl: string,
  fixes: string[],
) {
  const targets = [
    "src/components/ChatBot.tsx",
    "src/components/CartoonAssistant.tsx",
  ];

  // Runtime resolver: in production (same origin via nginx), uses relative path.
  // In dev (port 3002 preview), detects and proxies to port 3001.
  const resolverCode = [
    `const chatUrl = (() => {`,
    `  const siteId = "${siteId}";`,
    `  if (typeof window === "undefined") return "/api/site-chat/" + siteId;`,
    `  const port = window.location.port;`,
    `  if (port === "3002") return window.location.origin.replace(":3002", ":3001") + "/api/site-chat/" + siteId;`,
    `  return "/api/site-chat/" + siteId;`,
    `})();`,
  ].join("\n      ");

  for (const filePath of targets) {
    const content = files[filePath];
    if (!content) continue;

    let patched = content;
    let changed = false;

    // Pattern 1: dynamic URL resolution block (window.location.pathname...)
    const dynamicUrlRe = /const\s+(?:pp|pathParts)\s*=\s*window\.location\.pathname[\s\S]*?const\s+chatUrl\s*=\s*[^;]+;/g;
    if (dynamicUrlRe.test(patched)) {
      patched = patched.replace(dynamicUrlRe, resolverCode);
      changed = true;
    }

    // Pattern 2: previously hardcoded localhost URL
    const localhostRe = /const\s+chatUrl\s*=\s*"http:\/\/localhost:\d+\/api\/site-chat\/[^"]+";/g;
    if (localhostRe.test(patched)) {
      patched = patched.replace(localhostRe, resolverCode);
      changed = true;
    }

    // Pattern 3: hardcoded fetch("/api/chat", ...)
    if (patched.includes('fetch("/api/chat"')) {
      patched = patched.replace(
        /fetch\("\/api\/chat"/g,
        `fetch("/api/site-chat/${siteId}"`,
      );
      changed = true;
    }

    if (changed) {
      files[filePath] = patched;
      fixes.push(`${filePath.split("/").pop()}: patched chat API URL (runtime resolver, siteId=${siteId})`);
    }
  }
}

/** SharePoster overflow — disabled, too fragile to auto-patch generated canvas code */
function fixSharePosterOverflow(
  _files: Record<string, string>,
  _fixes: string[],
) {
  // Intentionally disabled: inserting truncateText helper and replacing fillText calls
  // is unreliable across different generated SharePoster variants.
  // The overflow is better fixed in the generator itself (genSharePoster).
}

/** Project card interaction — disabled, too fragile to auto-patch across different page generators */
function fixProjectCardInteraction(
  _files: Record<string, string>,
  _fixes: string[],
) {
  // Intentionally disabled: the map callback parameter name varies across generators
  // (p, i) vs (p, idx) vs (project, index), making regex replacement unreliable.
  // Progressive disclosure is handled in the generator itself (genSingleColumnPage).
}

/** Ensure "use client" directive on components that use hooks */
function fixMissingUseClient(
  files: Record<string, string>,
  fixes: string[],
) {
  const clientHooks = ["useState", "useEffect", "useRef", "useCallback", "useContext"];

  for (const [path, content] of Object.entries(files)) {
    if (!path.endsWith(".tsx") && !path.endsWith(".ts")) continue;
    if (path.includes("/api/")) continue; // API routes are server-side
    if (content.startsWith('"use client"') || content.startsWith("'use client'")) continue;

    const hasClientHook = clientHooks.some(hook => content.includes(hook));
    if (hasClientHook) {
      files[path] = `"use client";\n\n${content}`;
      fixes.push(`${path}: added missing "use client" directive`);
    }
  }
}

/** Fix unresolved imports — remove imports for components that don't exist */
function fixUnresolvedImports(
  files: Record<string, string>,
  fixes: string[],
) {
  const page = files["src/app/page.tsx"];
  if (!page) return;

  const componentImports = [
    { pattern: /import\s+ParticleBackground\s+from\s+"[^"]+";?\n?/g, file: "src/components/ParticleBackground.tsx", usage: "ParticleBackground" },
    { pattern: /import\s+GrainOverlay\s+from\s+"[^"]+";?\n?/g, file: "src/components/GrainOverlay.tsx", usage: "GrainOverlay" },
    { pattern: /import\s+TypewriterHero\s+from\s+"[^"]+";?\n?/g, file: "src/components/TypewriterHero.tsx", usage: "TypewriterHero" },
  ];

  for (const { pattern, file, usage } of componentImports) {
    if (page.match(pattern) && !files[file]) {
      // Component imported but file doesn't exist — remove import and usage
      files["src/app/page.tsx"] = files["src/app/page.tsx"]
        .replace(pattern, "")
        .replace(new RegExp(`<${usage}\\s*/>`, "g"), "");
      fixes.push(`page: removed unresolved import for ${usage}`);
    }
  }
}

/** Fix common CSS overflow issues */
function fixCssOverflow(
  files: Record<string, string>,
  fixes: string[],
) {
  const css = files["src/app/globals.css"];
  if (!css) return;

  // Ensure word-break on long text
  if (!css.includes("word-break") && !css.includes("overflow-wrap")) {
    files["src/app/globals.css"] = css + `
/* Guardrail: prevent text overflow */
h1, h2, h3, h4, p, span, a { overflow-wrap: break-word; word-break: break-word; }
.card { overflow: hidden; }
`;
    fixes.push("css: added word-break and overflow rules");
  }
}

/**
 * Fix bare `>` and `<` characters in JSX text content.
 * JSX requires these to be expressed as `{'>'}` / `{'<'}` or `&gt;` / `&lt;`.
 * Code Agent often writes `<span>>></span>` or `> {text}` in terminal-style themes.
 *
 * Pattern: finds `>` or `<` that sit between a closing `>` and text/whitespace,
 * i.e., JSX text positions, and wraps them in `{'...'}`.
 */
function fixJsxBareSpecialChars(
  files: Record<string, string>,
  fixes: string[],
) {
  for (const [path, content] of Object.entries(files)) {
    if (!path.endsWith(".tsx")) continue;

    // Match: >X</  where X is a bare > or < character in JSX text position
    // e.g., <span className="...">></span>  →  <span className="...">{'>'}</span>
    // Also: <span>>></span>  →  <span>{'>'}{'>'}>/span>  — but simpler to catch the ">>" pattern too

    let patched = content;

    // Pattern 1: `">">` — a bare `>` between a tag close `">` and next tag/text
    // e.g.,  ...className="text-accent">></span>
    //        ...className="text-accent">{'>'}>/span>
    patched = patched.replace(
      /(?<=>)(>)(?=\s)/g,
      "{'>'}"
    );

    // Pattern 2: `">"> ` — bare `>` followed by space then text (common: `> {highlight}`)
    patched = patched.replace(
      /(?<=>)(>)(\s*\{)/g,
      "{'>'}$2"
    );

    // Pattern 3: standalone bare `>` between tags: `>><` → `{'>'}<`
    patched = patched.replace(
      /(?<=>)(>)(?=<)/g,
      "{'>'}"
    );

    // Pattern 4: bare `<` in text position: `><` before non-/ (not a closing tag)
    // This is rarer but handle `>< ` text patterns
    patched = patched.replace(
      /(?<=>)(<)(?=[^/a-zA-Z{])/g,
      "{'<'}"
    );

    // Pattern 5: bare > or < in SVG <text> content only (safest scope)
    // e.g., <text ...>=></text>  →  <text ...>=&gt;</text>
    // Only targets <text> elements to avoid breaking JSX tags
    for (const line of patched.split("\n")) {
      const m = line.match(/^(\s*<text\b[^>]*>)(.*?)(<\/text>)/);
      if (m && /[<>]/.test(m[2]) && !m[2].includes("&gt;") && !m[2].includes("{'")) {
        const fixed = m[1] + m[2].replace(/>/g, "&gt;").replace(/</g, "&lt;") + m[3];
        patched = patched.replace(line, fixed);
      }
    }

    if (patched !== content) {
      files[path] = patched;
      fixes.push(`${path.split("/").pop()}: escaped bare > / < in JSX text`);
    }
  }
}

/** Ensure SharePoster is imported and rendered in page.tsx */
function fixMissingSharePoster(
  files: Record<string, string>,
  fixes: string[],
) {
  const page = files["src/app/page.tsx"];
  if (!page || !files["src/components/SharePoster.tsx"]) return;

  let patched = page;
  const hasImport = /import\s+SharePoster\s+from/.test(patched);
  const hasJsx = /<SharePoster\s*\/>/.test(patched);

  if (!hasImport) {
    patched = `import SharePoster from "@/components/SharePoster";\n${patched}`;
    fixes.push("page.tsx: added missing SharePoster import");
  }

  if (!hasJsx) {
    // Insert <SharePoster /> before the last closing </div> or before CartoonAssistant/ChatBot
    const insertBefore = patched.lastIndexOf("</div>");
    if (insertBefore > 0) {
      patched = patched.slice(0, insertBefore) + "      <SharePoster />\n    " + patched.slice(insertBefore);
      fixes.push("page.tsx: injected <SharePoster /> component");
    }
  }

  if (patched !== page) {
    files["src/app/page.tsx"] = patched;
  }
}

/**
 * Ensure translations.ts always exports Lang and Translations types.
 * Secondary edits (modify flow) sometimes rewrite translations and drop these exports,
 * causing LanguageProvider to fail with "Module has no exported member 'Lang'".
 */
function fixTranslationsExports(
  files: Record<string, string>,
  fixes: string[],
) {
  const trans = files["src/i18n/translations.ts"];
  if (!trans) return;

  let patched = trans;
  const hasLangExport = /export\s+type\s+Lang\b/.test(patched);
  const hasTranslationsExport = /export\s+type\s+Translations\b/.test(patched);

  if (!hasLangExport || !hasTranslationsExport) {
    // Ensure the translations object is exported
    if (!patched.includes("export const translations")) {
      patched = patched.replace(/\bconst translations\b/, "export const translations");
    }
    // Append missing type exports
    if (!hasLangExport) {
      patched += '\nexport type Lang = keyof typeof translations;\n';
    }
    if (!hasTranslationsExport) {
      patched += 'export type Translations = (typeof translations)[Lang];\n';
    }
    files["src/i18n/translations.ts"] = patched;
    fixes.push("translations.ts: added missing Lang/Translations type exports");
  }
}

/** Fix fullscreen overlays blocking clicks — ensure ::before/::after have pointer-events: none */
function fixOverlayPointerEvents(files: Record<string, string>, fixes: string[]) {
  const css = files["src/app/globals.css"];
  if (!css) return;

  let patched = css;

  // Fix any ::after or ::before on overlay elements that lack pointer-events: none
  // Pattern: .something-overlay::after { ... } without pointer-events: none
  patched = patched.replace(
    /(\.[\w-]*overlay[\w-]*::(?:after|before)\s*\{)([^}]*)\}/g,
    (match, selector, body) => {
      if (body.includes("pointer-events")) return match;
      return `${selector}${body} pointer-events: none; }`;
    },
  );

  // Also ensure any element with z-index >= 9000 and position: fixed has pointer-events: none on children
  // More targeted: if .texture-overlay exists, ensure its pseudo-elements are safe
  if (patched.includes("z-index: 9999") || patched.includes("z-index:9999")) {
    // Add a blanket rule for overlay pseudo-elements
    if (!patched.includes("[class*='overlay']::after") && !patched.includes("[class*=overlay]::after")) {
      patched += "\n[class*='overlay']::before, [class*='overlay']::after { pointer-events: none !important; }\n";
    }
  }

  if (patched !== css) {
    files["src/app/globals.css"] = patched;
    fixes.push("globals.css: added pointer-events: none to overlay pseudo-elements");
  }
}

/** Fix LanguageProvider import/export consistency — ensure default export + default import */
function fixLanguageProviderImport(files: Record<string, string>, fixes: string[]) {
  // Fix import side: { LanguageProvider } → default import
  const importRe = /import\s*\{\s*LanguageProvider\s*\}\s*from\s*["']@\/components\/LanguageProvider["']/g;
  for (const [filePath, content] of Object.entries(files)) {
    if (importRe.test(content)) {
      files[filePath] = content.replace(importRe, 'import LanguageProvider from "@/components/LanguageProvider"');
      fixes.push(`${filePath}: fixed LanguageProvider named→default import`);
    }
  }

  // Fix export side: ensure LanguageProvider.tsx uses export default
  const lpFile = files["src/components/LanguageProvider.tsx"];
  if (lpFile && !lpFile.includes("export default") && lpFile.includes("export function LanguageProvider")) {
    files["src/components/LanguageProvider.tsx"] = lpFile
      .replace("export function LanguageProvider", "export default function LanguageProvider")
      // Also fix useLanguage: if context is created with null, add safe default
      .replace(
        /const LanguageContext = createContext<LanguageContextType \| null>\(null\)/,
        "const LanguageContext = createContext<LanguageContextType>({ lang: \"zh\" as Lang, t: translations.zh, toggle: () => {} })"
      );
    // Fix useLanguage to not throw if outside provider
    if (lpFile.includes("if (!ctx) throw")) {
      files["src/components/LanguageProvider.tsx"] = files["src/components/LanguageProvider.tsx"]
        .replace(/export function useLanguage\(\)\s*\{[^}]*\}/, "export function useLanguage() {\n  return useContext(LanguageContext);\n}");
    }
    // Add localStorage persistence if missing
    if (!lpFile.includes("localStorage")) {
      files["src/components/LanguageProvider.tsx"] = files["src/components/LanguageProvider.tsx"]
        .replace(
          /import \{ createContext, useContext, useState, useCallback/,
          "import { createContext, useContext, useState, useEffect, useCallback"
        );
      // Insert useEffect after useState
      const setLangMatch = files["src/components/LanguageProvider.tsx"].match(/const \[lang, setLang\] = useState<Lang>\("zh"\);/);
      if (setLangMatch) {
        files["src/components/LanguageProvider.tsx"] = files["src/components/LanguageProvider.tsx"].replace(
          setLangMatch[0],
          setLangMatch[0] + '\n  useEffect(() => { const saved = localStorage.getItem("lang") as Lang | null; if (saved && translations[saved]) setLang(saved); }, []);'
        );
      }
    }
    fixes.push("LanguageProvider.tsx: upgraded to default export with localStorage persistence");
  }
}

// ============================================================
// Advanced Mode Deep Guardrails
// ============================================================

/** Known translation top-level keys that generateAdvancedTranslations() always produces */
const KNOWN_TRANSLATION_KEYS = new Set([
  "nav", "hero", "about", "projects", "experience", "skills", "education",
  "testimonials", "awards", "publications", "media", "demos", "contact",
  "footer", "chatbot", "share", "availableSections", "posts", "links",
]);

/**
 * Deep validation + auto-fix for advanced mode (Code Agent) generated code.
 * Runs AFTER runCodeGuardrails() and BEFORE writeFilesToSiteDir().
 * Returns the list of fixes applied (for progress reporting).
 */
export function runAdvancedModeGuardrails(
  files: Record<string, string>,
  allowedDeps: Set<string>,
  logger: Logger,
): string[] {
  const fixes: string[] = [];

  // Check 0: Truncate trailing garbage after the default export function closes
  fixTrailingGarbage(files, fixes);

  // Check 1: Auto-add `: any` to untyped callback parameters in page.tsx
  fixCallbackParamTypes(files, fixes);

  // Check 2: Universal import completeness — remove imports for non-existent local modules
  fixAllUnresolvedLocalImports(files, fixes);

  // Check 3: Third-party dependency import linkage — remove imports for non-whitelisted packages
  fixNonWhitelistedImports(files, allowedDeps, fixes);

  // Check 4: Translation key safety — guard against undefined t.xxx access
  fixTranslationKeySafety(files, fixes);

  if (fixes.length > 0) {
    logger.info("guardrails-advanced", `Applied ${fixes.length} advanced auto-fixes`, { fixes });
  }

  return fixes;
}

/**
 * Check 0: Fix trailing garbage after the default export function.
 * Code Agent sometimes emits extra `</div>`, `}`, or duplicated fragments
 * after the component's final closing brace. This truncates everything
 * after the last balanced top-level `}` of `export default function`.
 */
function fixTrailingGarbage(
  files: Record<string, string>,
  fixes: string[],
) {
  const page = files["src/app/page.tsx"];
  if (!page) return;

  // Strategy: find `export default function`, then track brace depth.
  // When depth returns to 0, everything after that closing `}` is garbage.
  const exportIdx = page.indexOf("export default function");
  if (exportIdx === -1) return;

  // Find the opening `{` of the function body
  const bodyStart = page.indexOf("{", exportIdx);
  if (bodyStart === -1) return;

  let depth = 0;
  let endIdx = -1;
  // Track whether we're inside a string or template literal to avoid counting braces in strings
  for (let i = bodyStart; i < page.length; i++) {
    const ch = page[i];
    // Skip string literals
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < page.length && page[i] !== quote) {
        if (page[i] === "\\") i++; // skip escaped char
        i++;
      }
      continue;
    }
    // Skip line comments
    if (ch === "/" && page[i + 1] === "/") {
      while (i < page.length && page[i] !== "\n") i++;
      continue;
    }
    // Skip block comments
    if (ch === "/" && page[i + 1] === "*") {
      i += 2;
      while (i < page.length - 1 && !(page[i] === "*" && page[i + 1] === "/")) i++;
      i++;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        endIdx = i + 1;
        // Don't break yet — there may be legitimate code after (unlikely for page.tsx, but safe)
        // Check if remaining content is just whitespace
        const remaining = page.slice(endIdx).trim();
        if (remaining.length > 0) {
          // There's trailing content — truncate it
          files["src/app/page.tsx"] = page.slice(0, endIdx) + "\n";
          fixes.push(`page.tsx: removed ${remaining.length} chars of trailing garbage after component`);
        }
        return;
      }
    }
  }

  // Fallback: depth never returned to 0 → the component function's closing `}`
  // is missing. The LLM emitted stray `)`, `</div>`, or duplicated fragments
  // after the final `return ( ... );` without ever closing the function body.
  //
  // Strategy: find the LAST top-level `return (`, match its balanced `)`,
  // drop everything after it, and append enough `}` to close the open blocks.
  const lastReturnParenIdx = findLastReturnOpenParen(page, bodyStart);
  if (lastReturnParenIdx === -1) return;

  const returnCloseIdx = findMatchingCloseParen(page, lastReturnParenIdx);
  if (returnCloseIdx === -1) return;

  // Skip optional whitespace + semicolons after the `)`
  let cutIdx = returnCloseIdx + 1;
  while (cutIdx < page.length && /[\s;]/.test(page[cutIdx])) cutIdx++;

  const tail = page.slice(cutIdx);
  const braces = "}\n".repeat(Math.max(1, depth));

  if (tail.length === 0) {
    // Pure EOF — function body just never closed. Append braces.
    files["src/app/page.tsx"] = page.slice(0, returnCloseIdx + 1) + ";\n" + braces;
    fixes.push(`page.tsx: appended ${Math.max(1, depth)} missing } to close component`);
    return;
  }

  // Drop the garbage tail, append closing braces.
  files["src/app/page.tsx"] = page.slice(0, returnCloseIdx + 1) + ";\n" + braces;
  fixes.push(
    `page.tsx: salvaged unterminated component — dropped ${tail.length} chars of post-return garbage, appended ${Math.max(1, depth)} closing }`
  );
}

/**
 * Find the `(` that opens the LAST top-level `return (` inside a function body.
 * Starts scanning from `bodyStart`. Skips strings and comments. Returns -1 if
 * not found.
 */
function findLastReturnOpenParen(src: string, bodyStart: number): number {
  let lastIdx = -1;
  let i = bodyStart;
  while (i < src.length) {
    const ch = src[i];
    // Skip strings
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") i++;
        i++;
      }
      i++;
      continue;
    }
    // Skip line comments
    if (ch === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    // Skip block comments
    if (ch === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length - 1 && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    // Match `return` as a whole word followed by whitespace then `(`
    if (ch === "r" && src.slice(i, i + 6) === "return" && /\W/.test(src[i + 6] || "")) {
      let j = i + 6;
      while (j < src.length && /\s/.test(src[j])) j++;
      if (src[j] === "(") {
        lastIdx = j;
        i = j + 1;
        continue;
      }
    }
    i++;
  }
  return lastIdx;
}

/**
 * Given the index of an open `(`, find the matching close `)`, skipping strings,
 * comments, and nested parens. Returns -1 if unbalanced.
 */
function findMatchingCloseParen(src: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") i++;
        i++;
      }
      continue;
    }
    if (ch === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length - 1 && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i++;
      continue;
    }
    // JSX content between tags contains `<` and `>` which are not parens — ignore
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Check 1: Auto-add `: any` type annotations to callback parameters.
 * Fixes TypeScript `noImplicitAny` errors like:
 *   .map((section) => ...)  →  .map((section: any) => ...)
 *   .map((item, index) => ...)  →  .map((item: any, index: number) => ...)
 */
function fixCallbackParamTypes(
  files: Record<string, string>,
  fixes: string[],
) {
  const page = files["src/app/page.tsx"];
  if (!page) return;

  let patched = page;
  const methods = "map|filter|forEach|find|some|every|reduce|flatMap|sort|findIndex";

  // Single param: .map((item) => ...) → .map((item: any) => ...)
  // But skip if already typed: .map((item: SomeType) => ...)
  const singleParamRe = new RegExp(
    `\\.(${methods})\\(\\(([a-zA-Z_$][a-zA-Z0-9_$]*)\\)\\s*=>`,
    "g",
  );
  patched = patched.replace(singleParamRe, (match, method, param) => {
    return `.${method}((${param}: any) =>`;
  });

  // Two params: .map((item, index) => ...) → .map((item: any, index: number) => ...)
  const twoParamRe = new RegExp(
    `\\.(${methods})\\(\\(([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*,\\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\\)\\s*=>`,
    "g",
  );
  patched = patched.replace(twoParamRe, (match, method, param1, param2) => {
    return `.${method}((${param1}: any, ${param2}: number) =>`;
  });

  // Destructured param: .map(({ title, desc }) => ...) → .map(({ title, desc }: any) => ...)
  const destructuredRe = new RegExp(
    `\\.(${methods})\\(\\(\\{([^}]+)\\}\\)\\s*=>`,
    "g",
  );
  patched = patched.replace(destructuredRe, (match, method, inner) => {
    return `.${method}(({ ${inner} }: any) =>`;
  });

  if (patched !== page) {
    files["src/app/page.tsx"] = patched;
    fixes.push("page.tsx: added type annotations to callback parameters");
  }
}

/**
 * Check 2: Universal import completeness — scan ALL `@/...` imports and verify files exist.
 * Replaces the old hardcoded 3-component approach in fixUnresolvedImports().
 */
function fixAllUnresolvedLocalImports(
  files: Record<string, string>,
  fixes: string[],
) {
  const page = files["src/app/page.tsx"];
  if (!page) return;

  // Match: import X from "@/..."; or import { X } from "@/...";
  const importRe = /^import\s+(?:(\w+)|(?:\{[^}]+\}))\s+from\s+["']@\/([^"']+)["'];?\s*$/gm;
  const toRemove: Array<{ fullMatch: string; defaultExport: string | null; modulePath: string }> = [];

  let m;
  while ((m = importRe.exec(page)) !== null) {
    const defaultExport = m[1] || null;
    const modulePath = m[2]; // e.g., "components/ParticleBackground"

    // Check if the file exists in the file map
    const candidates = [
      `src/${modulePath}.tsx`,
      `src/${modulePath}.ts`,
      `src/${modulePath}/index.tsx`,
      `src/${modulePath}/index.ts`,
    ];

    const exists = candidates.some(c => files[c] !== undefined);
    if (!exists) {
      toRemove.push({ fullMatch: m[0], defaultExport, modulePath });
    }
  }

  if (toRemove.length === 0) return;

  let patched = page;
  for (const { fullMatch, defaultExport, modulePath } of toRemove) {
    // Remove the import line
    patched = patched.replace(fullMatch + "\n", "");
    patched = patched.replace(fullMatch, "");

    // Remove JSX usage of default export: <ComponentName /> and <ComponentName ...>...</ComponentName>
    if (defaultExport) {
      // Self-closing: <ComponentName /> or <ComponentName prop="x" />
      patched = patched.replace(new RegExp(`<${defaultExport}\\s[^>]*/\\s*>`, "g"), "");
      patched = patched.replace(new RegExp(`<${defaultExport}\\s*/>`, "g"), "");
      // Opening + closing pair: <ComponentName>...</ComponentName>
      patched = patched.replace(new RegExp(`<${defaultExport}[^>]*>[\\s\\S]*?</${defaultExport}>`, "g"), "");
    }

    fixes.push(`page.tsx: removed unresolved import @/${modulePath}`);
  }

  files["src/app/page.tsx"] = patched;
}

/**
 * Check 3: Third-party dependency import linkage.
 * When package.json deps are stripped by the whitelist validator,
 * the corresponding imports in page.tsx must also be removed.
 */
function fixNonWhitelistedImports(
  files: Record<string, string>,
  allowedDeps: Set<string>,
  fixes: string[],
) {
  const page = files["src/app/page.tsx"];
  if (!page) return;

  // Known built-in modules that don't need to be in package.json
  const builtins = new Set(["react", "react-dom", "next", "next/image", "next/link", "next/font", "next/navigation"]);

  // Match: import X from "package-name"; or import { X } from "package-name";
  // Exclude @/ (local) imports
  const importRe = /^import\s+(?:(\w+)|(?:\{([^}]+)\}))\s+from\s+["']([^@./][^"']*)["'];?\s*$/gm;
  const toRemove: Array<{ fullMatch: string; defaultExport: string | null; namedExports: string[]; pkg: string }> = [];

  let m;
  while ((m = importRe.exec(page)) !== null) {
    const defaultExport = m[1] || null;
    const namedStr = m[2] || "";
    const pkg = m[3];

    // Extract base package name (e.g., "three" from "three", "@react-three/fiber" from "@react-three/fiber")
    // For sub-paths like "next/image" → "next"
    const basePkg = pkg.startsWith("@") ? pkg.split("/").slice(0, 2).join("/") : pkg.split("/")[0];

    if (builtins.has(pkg) || builtins.has(basePkg)) continue;
    if (allowedDeps.has(basePkg)) continue;

    const namedExports = namedStr.split(",").map(s => s.trim().split(/\s+as\s+/).pop()?.trim()).filter(Boolean) as string[];
    toRemove.push({ fullMatch: m[0], defaultExport, namedExports, pkg });
  }

  if (toRemove.length === 0) return;

  let patched = page;
  for (const { fullMatch, defaultExport, namedExports, pkg } of toRemove) {
    patched = patched.replace(fullMatch + "\n", "");
    patched = patched.replace(fullMatch, "");

    // Remove JSX usage for default export
    if (defaultExport) {
      patched = patched.replace(new RegExp(`<${defaultExport}\\s[^>]*/\\s*>`, "g"), "");
      patched = patched.replace(new RegExp(`<${defaultExport}\\s*/>`, "g"), "");
      patched = patched.replace(new RegExp(`<${defaultExport}[^>]*>[\\s\\S]*?</${defaultExport}>`, "g"), "");
    }

    // Remove JSX usage for named exports
    for (const name of namedExports) {
      if (/^[A-Z]/.test(name)) {
        patched = patched.replace(new RegExp(`<${name}\\s[^>]*/\\s*>`, "g"), "");
        patched = patched.replace(new RegExp(`<${name}\\s*/>`, "g"), "");
        patched = patched.replace(new RegExp(`<${name}[^>]*>[\\s\\S]*?</${name}>`, "g"), "");
      }
    }

    fixes.push(`page.tsx: removed non-whitelisted import "${pkg}"`);
  }

  files["src/app/page.tsx"] = patched;
}

/**
 * Check 4: Translation key safety.
 * Scans page.tsx for `t.xxx` top-level access and ensures translations has those keys.
 * Instead of rewriting t → _t, we patch the translations file to always have safe defaults.
 */
function fixTranslationKeySafety(
  files: Record<string, string>,
  fixes: string[],
) {
  const page = files["src/app/page.tsx"];
  if (!page) return;

  // Find all t.xxx top-level accesses (t.projects, t.hero, etc.)
  const accessRe = /\bt\.(\w+)/g;
  const usedKeys = new Set<string>();
  let m;
  while ((m = accessRe.exec(page)) !== null) {
    usedKeys.add(m[1]);
  }

  // Find keys NOT in the known set
  const missingKeys: string[] = [];
  for (const key of usedKeys) {
    if (!KNOWN_TRANSLATION_KEYS.has(key)) {
      missingKeys.push(key);
    }
  }

  if (missingKeys.length === 0) return;

  // Patch page.tsx: inject safe defaults after the useLanguage() call
  // Find the line with useLanguage() and add defaults after it
  const langLine = page.match(/const\s*\{[^}]*\}\s*=\s*useLanguage\(\);?\s*\n/);
  if (!langLine) return;

  const defaults = missingKeys.map(key => {
    // Heuristic: if key is plural-sounding, default to []; otherwise ""
    const isArray = /s$|list$|items$/i.test(key);
    return `  const _guardrail_${key} = t.${key} ?? ${isArray ? "[]" : '""'};`;
  }).join("\n");

  const replacements = missingKeys.map(key => ({
    // Replace t.keyName with the guardrail variable (but only for these missing keys)
    pattern: new RegExp(`\\bt\\.${key}\\b`, "g"),
    replacement: `_guardrail_${key}`,
  }));

  // Insert defaults block after useLanguage()
  const defaultsBlock = "\n  // Guardrail: safe defaults for unknown translation keys\n" + defaults + "\n\n";
  let patched = page.replace(langLine[0], langLine[0] + defaultsBlock);

  // Replace t.key → _guardrail_key, but NOT inside the defaults block itself
  const insertPos = page.indexOf(langLine[0]) + langLine[0].length + defaultsBlock.length;
  const before = patched.slice(0, insertPos);
  let after = patched.slice(insertPos);
  for (const { pattern, replacement } of replacements) {
    after = after.replace(pattern, replacement);
  }
  patched = before + after;

  files["src/app/page.tsx"] = patched;
  fixes.push(`page.tsx: added safe defaults for unknown translation keys: ${missingKeys.join(", ")}`);
}
