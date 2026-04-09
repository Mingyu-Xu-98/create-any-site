/**
 * SQLite auto-backup — periodic `.backup()` to a timestamped file.
 *
 * better-sqlite3 exposes the native `sqlite3_backup_*` API via
 * `database.backup(destination)`. This is an online backup — it runs
 * while the DB is open and handles WAL correctly.
 *
 * Schedule:
 *   - Runs every BACKUP_INTERVAL_MS (default 6 hours).
 *   - Retains the last BACKUP_RETAIN_COUNT (default 7) backup files.
 *   - Timer is `.unref()`'d so it won't keep the process alive.
 *
 * Backup directory: data/backups/ (next to data/app.db).
 *
 * Usage:
 *   import "@/lib/db-backup";
 *   // That's it — importing starts the scheduler.
 *
 *   // Or trigger manually:
 *   import { runBackupNow } from "@/lib/db-backup";
 *   await runBackupNow();
 */

import { sqlite } from "@/lib/db";
import fs from "fs";
import path from "path";
import { logger } from "@/lib/logger";

const DB_PATH = path.join(process.cwd(), "data", "app.db");
const BACKUP_DIR = path.join(path.dirname(DB_PATH), "backups");
const BACKUP_INTERVAL_MS = Number(process.env.BACKUP_INTERVAL_MS || 6 * 3_600_000); // 6 hours
const BACKUP_RETAIN_COUNT = Number(process.env.BACKUP_RETAIN_COUNT || 7);

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Run a backup immediately. Returns the backup file path on success.
 */
export async function runBackupNow(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_DIR, `app-${timestamp}.db`);

  await sqlite.backup(backupPath);
  logger.info("db-backup", `Backup complete: ${path.basename(backupPath)}`);

  // Prune old backups
  pruneOldBackups();

  return backupPath;
}

/**
 * Remove old backup files, keeping only the most recent BACKUP_RETAIN_COUNT.
 */
function pruneOldBackups(): void {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("app-") && f.endsWith(".db"))
      .sort()
      .reverse(); // newest first

    for (const file of files.slice(BACKUP_RETAIN_COUNT)) {
      fs.unlinkSync(path.join(BACKUP_DIR, file));
      logger.info("db-backup", `Pruned old backup: ${file}`);
    }
  } catch (err) {
    logger.warn("db-backup", `Prune failed: ${err instanceof Error ? err.message : "unknown"}`);
  }
}

// ---- Scheduler ----

let backupTimer: ReturnType<typeof setInterval> | null = null;

function startBackupScheduler(): void {
  if (backupTimer) return;
  // Don't start in test environment
  if (process.env.NODE_ENV === "test") return;

  backupTimer = setInterval(() => {
    void runBackupNow().catch((err) => {
      logger.warn("db-backup", `Scheduled backup failed: ${err instanceof Error ? err.message : "unknown"}`);
    });
  }, BACKUP_INTERVAL_MS);
  backupTimer.unref();

  logger.info("db-backup", `Backup scheduler started: every ${BACKUP_INTERVAL_MS / 3_600_000}h, retain ${BACKUP_RETAIN_COUNT}`);
}

startBackupScheduler();
