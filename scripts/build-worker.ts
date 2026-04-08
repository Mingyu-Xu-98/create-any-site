// MUST be the first import — populates process.env before any module that
// captures env vars at load time (e.g. build-runtime.ts caches
// PREVIEW_PUBLISH_DIR as a module-level const).
import "./load-env";

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
