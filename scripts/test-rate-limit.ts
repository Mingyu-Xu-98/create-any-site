/**
 * Standalone test for the in-memory rate limiter.
 *
 * Run:  npx tsx scripts/test-rate-limit.ts
 *
 * Not wired into any test framework (project has none). Execute manually
 * after touching src/lib/rate-limit.ts and confirm all cases pass.
 */
import { checkRateLimit, clearAllRateLimits } from "../src/lib/rate-limit";

type Case = {
  name: string;
  run: () => string | null; // null = pass, string = failure reason
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const cases: Case[] = [
  {
    name: "Case 1 — all calls under limit succeed",
    run: () => {
      clearAllRateLimits();
      for (let i = 0; i < 5; i++) {
        const r = checkRateLimit("k1", 5, 1000);
        if (!r.ok) return `call ${i + 1} unexpectedly rejected: ${JSON.stringify(r)}`;
        if (r.remaining !== 5 - 1 - i) {
          return `call ${i + 1} remaining wrong: got ${r.remaining}, expected ${5 - 1 - i}`;
        }
      }
      return null;
    },
  },
  {
    name: "Case 2 — 6th call over limit-of-5 is rejected with retry-after",
    run: () => {
      clearAllRateLimits();
      for (let i = 0; i < 5; i++) checkRateLimit("k2", 5, 1000);
      const r = checkRateLimit("k2", 5, 1000);
      if (r.ok) return "6th call should have been rejected";
      if (r.remaining !== 0) return `remaining should be 0, got ${r.remaining}`;
      if (r.retryAfterSec < 1) return `retryAfterSec should be >= 1, got ${r.retryAfterSec}`;
      if (r.limit !== 5) return `limit should be 5, got ${r.limit}`;
      return null;
    },
  },
  {
    name: "Case 3 — different keys are independent",
    run: () => {
      clearAllRateLimits();
      for (let i = 0; i < 3; i++) checkRateLimit("kA", 3, 1000);
      // kA is now full
      const rA = checkRateLimit("kA", 3, 1000);
      if (rA.ok) return "kA should be full";
      // kB has never been touched — should get a clean window
      const rB = checkRateLimit("kB", 3, 1000);
      if (!rB.ok) return `kB should be fresh, got ${JSON.stringify(rB)}`;
      if (rB.remaining !== 2) return `kB remaining should be 2, got ${rB.remaining}`;
      return null;
    },
  },
  {
    name: "Case 4 — rejected calls still count (no free pass after block)",
    run: () => {
      clearAllRateLimits();
      for (let i = 0; i < 3; i++) checkRateLimit("k4", 3, 1000);
      // Hammer 5 more rejections
      for (let i = 0; i < 5; i++) {
        const r = checkRateLimit("k4", 3, 1000);
        if (r.ok) return `hammer call ${i + 1} was unexpectedly allowed`;
      }
      return null;
    },
  },
  {
    name: "Case 5 — window expires and counter resets",
    run: () => {
      // Note: this case needs a real tick. It's the only async case.
      // We run it outside the main loop below.
      return "deferred";
    },
  },
];

async function runAsyncCase(): Promise<string | null> {
  clearAllRateLimits();
  for (let i = 0; i < 2; i++) checkRateLimit("k5", 2, 100); // 100ms window
  const blocked = checkRateLimit("k5", 2, 100);
  if (blocked.ok) return "should be blocked immediately after filling window";
  // Wait for window to expire
  await sleep(150);
  const fresh = checkRateLimit("k5", 2, 100);
  if (!fresh.ok) return `after window expired, should be allowed again. got ${JSON.stringify(fresh)}`;
  if (fresh.remaining !== 1) return `fresh.remaining should be 1, got ${fresh.remaining}`;
  return null;
}

(async () => {
  let failed = 0;
  for (const c of cases) {
    if (c.name.startsWith("Case 5")) continue;
    try {
      const reason = c.run();
      if (reason) {
        console.error(`✗ ${c.name}\n    ${reason}`);
        failed++;
      } else {
        console.log(`✓ ${c.name}`);
      }
    } catch (err) {
      console.error(`✗ ${c.name}\n    threw: ${(err as Error).message}`);
      failed++;
    }
  }

  // Async case
  try {
    const reason = await runAsyncCase();
    if (reason) {
      console.error(`✗ Case 5 — window expires and counter resets\n    ${reason}`);
      failed++;
    } else {
      console.log(`✓ Case 5 — window expires and counter resets`);
    }
  } catch (err) {
    console.error(`✗ Case 5\n    threw: ${(err as Error).message}`);
    failed++;
  }

  if (failed > 0) {
    console.error(`\n${failed}/${cases.length} cases FAILED`);
    process.exit(1);
  }
  console.log(`\n${cases.length}/${cases.length} cases passed`);
})();
