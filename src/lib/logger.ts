import fs from "fs";
import path from "path";

const LOG_DIR = path.join(process.cwd(), "data", "logs");

function ensureDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function timestamp() {
  return new Date().toISOString();
}

function getLogFile() {
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return path.join(LOG_DIR, `analyze-${date}.log`);
}

export function log(level: "INFO" | "WARN" | "ERROR", module: string, message: string, data?: unknown) {
  ensureDir();
  const entry = {
    time: timestamp(),
    level,
    module,
    message,
    ...(data !== undefined ? { data } : {}),
  };

  const line = JSON.stringify(entry) + "\n";

  // Write to file
  try {
    fs.appendFileSync(getLogFile(), line, "utf-8");
  } catch {
    // Fallback to console if file write fails
  }

  // Also console
  const prefix = `[${entry.time}] [${level}] [${module}]`;
  if (level === "ERROR") {
    console.error(prefix, message, data || "");
  } else if (level === "WARN") {
    console.warn(prefix, message, data || "");
  } else {
    console.log(prefix, message, data ? JSON.stringify(data).slice(0, 200) : "");
  }
}

export const logger = {
  info: (module: string, message: string, data?: unknown) => log("INFO", module, message, data),
  warn: (module: string, message: string, data?: unknown) => log("WARN", module, message, data),
  error: (module: string, message: string, data?: unknown) => log("ERROR", module, message, data),
};
