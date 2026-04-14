/**
 * Rule-based build error classifier.
 * No LLM — pure regex matching to categorize build errors
 * and generate fingerprints for deduplication.
 */
import { createHash } from "crypto";

export type ErrorCategory = "jsx" | "import" | "typescript" | "css" | "runtime" | "build";

export interface ErrorClassification {
  pattern: string;       // Normalized name e.g. "bare_jsx_gt"
  category: ErrorCategory;
  fingerprint: string;   // SHA-256 hash for dedup
  badPattern: string;    // Short description of what went wrong
  fixHint: string;       // Short description of correct approach
}

interface ClassificationRule {
  regex: RegExp;
  pattern: string;
  category: ErrorCategory;
  badPattern: string;
  fixHint: string;
}

/**
 * Classification rules — ordered by specificity (most specific first).
 * Derived from the 15 guardrail functions in code-guardrails.ts
 * plus common Next.js build error patterns.
 */
const RULES: ClassificationRule[] = [
  // --- JSX errors ---
  {
    regex: /Unexpected token.*Expected.*[}>)]/i,
    pattern: "jsx_unexpected_token",
    category: "jsx",
    badPattern: "Malformed JSX syntax (unclosed tags or braces)",
    fixHint: "Ensure all JSX tags and braces are properly closed",
  },
  {
    regex: /`[<>]` can only be used|Unexpected token [<>]/i,
    pattern: "bare_jsx_special_char",
    category: "jsx",
    badPattern: "Bare < or > in JSX text content",
    fixHint: "Use {'<'} or {'>'} for literal angle brackets in JSX text",
  },
  {
    regex: /Adjacent JSX elements must be wrapped/i,
    pattern: "jsx_adjacent_elements",
    category: "jsx",
    badPattern: "Multiple JSX root elements without wrapper",
    fixHint: "Wrap adjacent JSX elements in a single parent <> fragment",
  },

  // --- Import errors ---
  {
    regex: /Module not found.*Can't resolve '([^']+)'/i,
    pattern: "module_not_found",
    category: "import",
    badPattern: "Importing a module that doesn't exist",
    fixHint: "Only import from whitelisted packages or existing local files",
  },
  {
    regex: /has no (exported member|default export) '([^']+)'/i,
    pattern: "missing_export",
    category: "import",
    badPattern: "Importing a non-existent export from a module",
    fixHint: "Check the module's actual exports before importing",
  },

  // --- TypeScript errors ---
  {
    regex: /Type '(.+)' is not assignable to type '(.+)'/i,
    pattern: "type_mismatch",
    category: "typescript",
    badPattern: "Type mismatch in assignment or prop",
    fixHint: "Add proper type annotations or cast with 'as'",
  },
  {
    regex: /Property '(\w+)' does not exist on type/i,
    pattern: "missing_property",
    category: "typescript",
    badPattern: "Accessing a property that doesn't exist on the type",
    fixHint: "Check the type definition; use optional chaining (?.) for nullable access",
  },
  {
    regex: /Parameter '(\w+)' implicitly has an 'any' type/i,
    pattern: "implicit_any",
    category: "typescript",
    badPattern: "Callback parameter without type annotation",
    fixHint: "Add explicit ': any' or proper type to callback parameters",
  },
  {
    regex: /Cannot find name '(\w+)'/i,
    pattern: "undefined_name",
    category: "typescript",
    badPattern: "Using an undefined variable or function",
    fixHint: "Import or declare the identifier before use",
  },

  // --- CSS errors ---
  {
    regex: /Unknown pseudo-class|Unknown at-rule/i,
    pattern: "css_syntax_error",
    category: "css",
    badPattern: "Invalid CSS syntax (unknown pseudo-class or at-rule)",
    fixHint: "Use standard CSS properties and Tailwind utilities",
  },

  // --- Runtime / build errors ---
  {
    regex: /ENOMEM|JavaScript heap out of memory/i,
    pattern: "oom",
    category: "build",
    badPattern: "Build ran out of memory",
    fixHint: "Reduce page complexity; keep page.tsx under 500 lines",
  },
  {
    regex: /Build timeout/i,
    pattern: "build_timeout",
    category: "build",
    badPattern: "Build exceeded time limit",
    fixHint: "Simplify code; avoid circular dependencies",
  },
  {
    regex: /next build.*exited with code [^0]/i,
    pattern: "build_exit_nonzero",
    category: "build",
    badPattern: "next build failed with non-zero exit code",
    fixHint: "Check build output for specific errors above",
  },
  {
    regex: /ENOENT.*no such file or directory/i,
    pattern: "file_not_found",
    category: "runtime",
    badPattern: "Referenced file does not exist on disk",
    fixHint: "Check file paths and ensure all files are written before build",
  },

  // --- Guardrail-derived patterns ---
  {
    regex: /use client.*directive/i,
    pattern: "missing_use_client",
    category: "jsx",
    badPattern: "Missing 'use client' directive in component with hooks",
    fixHint: "Add \"use client\" as the first line of files using React hooks",
  },
  {
    regex: /Cannot read properties of (undefined|null)/i,
    pattern: "null_access",
    category: "runtime",
    badPattern: "Accessing property of undefined/null",
    fixHint: "Use optional chaining (?.) and provide fallback values",
  },
];

/**
 * Classify a raw build error string into a structured pattern.
 * Returns null if no rule matches (unknown error type).
 */
export function classifyBuildError(rawError: string): ErrorClassification | null {
  const normalized = rawError
    .replace(/\u001b\[[0-9;]*m/g, "")  // strip ANSI colors
    .replace(/\r\n/g, "\n")
    .trim();

  for (const rule of RULES) {
    if (rule.regex.test(normalized)) {
      return {
        pattern: rule.pattern,
        category: rule.category,
        fingerprint: createFingerprint(rule.pattern, normalized),
        badPattern: rule.badPattern,
        fixHint: rule.fixHint,
      };
    }
  }

  // Fallback: create a generic classification from the first error-like line
  const firstErrorLine = normalized
    .split("\n")
    .find(line => /error|failed|cannot|unexpected/i.test(line));

  if (firstErrorLine) {
    const genericPattern = "unknown_" + firstErrorLine
      .replace(/[^a-zA-Z\s]/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 4)
      .join("_")
      .toLowerCase();

    return {
      pattern: genericPattern,
      category: "build",
      fingerprint: createFingerprint(genericPattern, normalized),
      badPattern: firstErrorLine.slice(0, 100),
      fixHint: "Review the build error output for details",
    };
  }

  return null;
}

/**
 * Classify a guardrail fix name into a pattern.
 * Guardrail names like "fixMissingUseClient" → "missing_use_client".
 */
export function classifyGuardrailFix(fixName: string): ErrorClassification {
  // Convert camelCase fix name to snake_case pattern
  const pattern = fixName
    .replace(/^fix/, "")
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");

  const GUARDRAIL_MAP: Record<string, { category: ErrorCategory; badPattern: string; fixHint: string }> = {
    chat_bot_api_url: { category: "runtime", badPattern: "ChatBot API URL points to wrong port", fixHint: "Use runtime-resolved chat API URL" },
    missing_use_client: { category: "jsx", badPattern: "Missing 'use client' directive", fixHint: "Add \"use client\" to files with hooks" },
    unresolved_imports: { category: "import", badPattern: "Import references non-existent component", fixHint: "Only import components that exist" },
    css_overflow: { category: "css", badPattern: "Text overflows container", fixHint: "Add word-break and overflow-wrap rules" },
    jsx_bare_special_chars: { category: "jsx", badPattern: "Bare > or < in JSX text", fixHint: "Escape with {'>'} or {'<'}" },
    overlay_pointer_events: { category: "css", badPattern: "Fullscreen overlay blocks clicks", fixHint: "Add pointer-events: none to overlays" },
    missing_share_poster: { category: "jsx", badPattern: "SharePoster component missing", fixHint: "Import and include <SharePoster />" },
    translations_exports: { category: "typescript", badPattern: "Missing Lang/Translations type exports", fixHint: "Export Lang and Translations types from translations.ts" },
    language_provider_import: { category: "import", badPattern: "Wrong LanguageProvider import style", fixHint: "Use default import for LanguageProvider" },
    trailing_garbage: { category: "jsx", badPattern: "Stray closing tags after component", fixHint: "Remove content after the final closing brace" },
    callback_param_types: { category: "typescript", badPattern: "Untyped callback parameters", fixHint: "Add ': any' to callback params" },
    all_unresolved_local_imports: { category: "import", badPattern: "Import references non-existent local file", fixHint: "Only import from existing local modules" },
    non_whitelisted_imports: { category: "import", badPattern: "Import from non-whitelisted npm package", fixHint: "Only use whitelisted dependencies" },
    translation_key_safety: { category: "runtime", badPattern: "Accessing undefined translation key", fixHint: "Guard t.xxx access with optional chaining" },
  };

  const mapped = GUARDRAIL_MAP[pattern] || {
    category: "build" as ErrorCategory,
    badPattern: `Guardrail: ${fixName}`,
    fixHint: `Auto-fixed by ${fixName}`,
  };

  return {
    pattern,
    category: mapped.category,
    fingerprint: createFingerprint(pattern, fixName),
    badPattern: mapped.badPattern,
    fixHint: mapped.fixHint,
  };
}

function createFingerprint(pattern: string, context: string): string {
  // Fingerprint is based on pattern name + a normalized snippet of the error
  const normalizedContext = context
    .replace(/\d+/g, "N")         // normalize numbers
    .replace(/['"][^'"]*['"]/g, "S") // normalize strings
    .slice(0, 200);
  return createHash("sha256")
    .update(`${pattern}:${normalizedContext}`)
    .digest("hex")
    .slice(0, 16);
}
