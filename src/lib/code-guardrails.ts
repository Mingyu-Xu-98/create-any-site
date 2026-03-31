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

  if (fixes.length > 0) {
    logger.info("guardrails", `Applied ${fixes.length} auto-fixes for site ${siteId}`, { fixes });
  }

  return files;
}

/** Fix ChatBot fetching /api/chat which doesn't work in static export */
function fixChatBotApiUrl(
  files: Record<string, string>,
  siteId: string,
  previewBaseUrl: string,
  fixes: string[],
) {
  const chatbot = files["src/components/ChatBot.tsx"];
  if (!chatbot) return;

  // If it still has a hardcoded /api/chat, patch it to use the host project's proxy
  if (chatbot.includes('fetch("/api/chat"') && !chatbot.includes("site-chat")) {
    const mainHost = previewBaseUrl
      ? new URL(previewBaseUrl).origin.replace(":3002", ":3001")
      : "http://localhost:3001";

    files["src/components/ChatBot.tsx"] = chatbot.replace(
      /const res = await fetch\("\/api\/chat"/g,
      `const res = await fetch("${mainHost}/api/site-chat/${siteId}"`,
    );
    fixes.push("chatbot: patched API URL to use host project proxy");
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
