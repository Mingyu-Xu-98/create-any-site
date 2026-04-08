// Side-effect only — populates process.env from .env files the same way
// Next.js does (.env → .env.production → .env.local, later wins unless already set).
//
// MUST be imported before any module that captures process.env at load time
// (notably src/lib/build-runtime.ts, which caches PREVIEW_PUBLISH_DIR and
// PREVIEW_BASE_URL into module-level consts at import).
//
// The worker runs under plain `tsx`, which — unlike `next start` — does NOT
// auto-load .env files, so without this shim the worker sees an empty env.
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
