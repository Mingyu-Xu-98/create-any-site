/**
 * Standalone test for fixTrailingGarbage in src/lib/code-guardrails.ts.
 *
 * Run:  npx tsx scripts/test-trailing-garbage.ts
 *
 * This is NOT wired into `npm test` (project has no test runner). It exists
 * to lock in the behavior of the 4 cases that motivated the fallback salvage
 * path and its hardening. When the guardrail changes, run this file manually
 * and confirm all cases still pass.
 */
import { fixTrailingGarbage } from "../src/lib/code-guardrails";

type Case = {
  name: string;
  input: string;
  expect: (out: string, fixes: string[]) => string | null; // null = pass, string = failure reason
};

function countBraces(src: string): { open: number; close: number } {
  let open = 0;
  let close = 0;
  for (const ch of src) {
    if (ch === "{") open++;
    else if (ch === "}") close++;
  }
  return { open, close };
}

const cases: Case[] = [
  {
    name: "Case 1 — stray `)` + orphan </div> after return (real regression)",
    input: `export default function Page() {
  return (
    <div>
      <h1>hi</h1>
    </div>
  );
  )
  </div>
  </div>
`,
    expect: (out, fixes) => {
      if (!fixes.some((f) => f.includes("salvaged"))) {
        return `expected a "salvaged" fix, got: ${JSON.stringify(fixes)}`;
      }
      const { open, close } = countBraces(out);
      if (open !== close) return `brace mismatch: open=${open} close=${close}`;
      if (out.includes(")\n  </div>")) return "garbage tail was not removed";
      return null;
    },
  },

  {
    name: "Case 2 — garbage tail contains stray `{` (EOF-depth bug trap)",
    input: `export default function Page() {
  return (
    <main>
      <p>content</p>
    </main>
  );
  { oops stray brace
  </main>
`,
    expect: (out, fixes) => {
      if (!fixes.some((f) => f.includes("salvaged"))) {
        return `expected salvage, got: ${JSON.stringify(fixes)}`;
      }
      const { open, close } = countBraces(out);
      if (open !== close) {
        return `brace mismatch: open=${open} close=${close} (EOF-depth bug would over-append })`;
      }
      if (out.includes("stray brace")) return "garbage not removed";
      return null;
    },
  },

  {
    name: "Case 3 — nested handler with its own return (top-level detection)",
    input: `export default function Page() {
  const handleClick = () => {
    return (
      <span>nested</span>
    );
  };
  return (
    <div onClick={handleClick}>
      <h1>outer</h1>
    </div>
  );
  )
  </div>
`,
    expect: (out, fixes) => {
      if (!fixes.some((f) => f.includes("salvaged"))) {
        return `expected salvage, got: ${JSON.stringify(fixes)}`;
      }
      const { open, close } = countBraces(out);
      if (open !== close) return `brace mismatch: open=${open} close=${close}`;
      // The nested handler and its return must survive.
      if (!out.includes("handleClick")) return "handleClick was cut away";
      if (!out.includes("<span>nested</span>")) {
        return "nested return was incorrectly treated as top-level and chopped";
      }
      if (!out.includes("<h1>outer</h1>")) return "outer JSX was cut";
      return null;
    },
  },

  {
    name: "Case 4 — well-formed page with junk AFTER closing brace (primary path regression)",
    input: `export default function Page() {
  return (
    <div>ok</div>
  );
}

// leftover model chatter
Sure, let me know if you want more!
`,
    expect: (out, fixes) => {
      if (!fixes.some((f) => f.includes("removed") && f.includes("trailing garbage"))) {
        return `expected primary-path trim, got: ${JSON.stringify(fixes)}`;
      }
      if (out.includes("model chatter")) return "primary path did not trim garbage";
      const { open, close } = countBraces(out);
      if (open !== close) return `brace mismatch: open=${open} close=${close}`;
      return null;
    },
  },

  {
    name: "Case 5 — well-formed page with NO garbage (no-op regression)",
    input: `export default function Page() {
  return (
    <div>clean</div>
  );
}
`,
    expect: (out, fixes) => {
      if (fixes.length !== 0) return `expected no fixes, got: ${JSON.stringify(fixes)}`;
      if (!out.includes("clean")) return "content was corrupted";
      return null;
    },
  },
];

let failed = 0;
for (const c of cases) {
  const files: Record<string, string> = { "src/app/page.tsx": c.input };
  const fixes: string[] = [];
  try {
    fixTrailingGarbage(files, fixes);
  } catch (err) {
    console.error(`✗ ${c.name}\n    threw: ${(err as Error).message}`);
    failed++;
    continue;
  }
  const out = files["src/app/page.tsx"];
  const reason = c.expect(out, fixes);
  if (reason) {
    console.error(`✗ ${c.name}\n    ${reason}`);
    console.error(`    fixes: ${JSON.stringify(fixes)}`);
    console.error(`    output:\n${out.split("\n").map((l) => "    | " + l).join("\n")}`);
    failed++;
  } else {
    console.log(`✓ ${c.name}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed}/${cases.length} cases FAILED`);
  process.exit(1);
}
console.log(`\n${cases.length}/${cases.length} cases passed`);
