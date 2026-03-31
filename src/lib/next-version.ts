import { createRequire } from "module";

const require = createRequire(import.meta.url);

export function getInstalledNextVersion(): string {
  try {
    const pkg = require("next/package.json") as { version?: string };
    if (pkg?.version) {
      return pkg.version;
    }
  } catch {}
  return "16.1.6";
}
