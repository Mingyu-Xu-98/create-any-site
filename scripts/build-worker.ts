// Load env files the same way Next.js does (.env.local > .env.production > .env).
// The worker runs under plain `tsx`, which — unlike `next start` — does NOT auto-load these.
import fs from "fs";
import path from "path";
for (const file of [".env", ".env.production", ".env.local"]) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  for (const rawLine of fs.readFileSync(p, "utf-8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

import { claimNextQueuedBuildJob, processBuildJob } from "../src/lib/build-queue";

const POLL_MS = Number(process.env.BUILD_WORKER_POLL_MS || 2000);

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`[build-worker] started (poll=${POLL_MS}ms)`);

  while (true) {
    try {
      const jobId = await claimNextQueuedBuildJob();
      if (!jobId) {
        await sleep(POLL_MS);
        continue;
      }

      console.log(`[build-worker] processing ${jobId}`);
      await processBuildJob(jobId, { alreadyClaimed: true });
    } catch (err) {
      const message = err instanceof Error ? err.stack || err.message : String(err);
      console.error(`[build-worker] error\n${message}`);
      await sleep(POLL_MS);
    }
  }
}

void main();
