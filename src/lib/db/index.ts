import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "app.db");

// Ensure data directory exists
import fs from "fs";
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Auto-create tables on first import
function initDb() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      email_verified INTEGER,
      image TEXT,
      role TEXT DEFAULT 'user',
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at INTEGER,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      session_state TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT NOT NULL,
      expires TEXT NOT NULL,
      PRIMARY KEY (identifier, token)
    );

    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      site_type TEXT NOT NULL,
      theme TEXT NOT NULL,
      layout TEXT NOT NULL,
      workspace_data TEXT,
      selections TEXT,
      file_map TEXT,
      status TEXT DEFAULT 'draft',
      preview_url TEXT,
      published_url TEXT,
      template_id TEXT,
      editor_state TEXT,
      prd TEXT,
      prd_history TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS knowledge_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source_id TEXT,
      source_name TEXT,
      source_type TEXT,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT,
      selected INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      site_id TEXT REFERENCES sites(id) ON DELETE SET NULL,
      title TEXT,
      messages TEXT NOT NULL,
      preview_url TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      index_content TEXT NOT NULL,
      "references" TEXT,
      site_types TEXT,
      enabled INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      site_type TEXT NOT NULL,
      theme TEXT NOT NULL,
      layout TEXT NOT NULL,
      preview_image TEXT,
      preview_url TEXT,
      file_map TEXT,
      popularity INTEGER DEFAULT 0,
      featured INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );
  `);
}

initDb();

// Seed admin account
function seedAdmin() {
  try {
    const existing = sqlite.prepare("SELECT id FROM users WHERE email = ?").get("admin@createanysite.com");
    if (!existing) {
      const bcrypt = require("bcryptjs");
      const hash = bcrypt.hashSync("Admin@2024!", 12);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      sqlite.prepare(
        "INSERT OR IGNORE INTO users (id, name, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(id, "Admin", "admin@createanysite.com", hash, "admin", now, now);
      console.log("[seed] Admin account created: admin@createanysite.com");
    }
  } catch {
    // Ignore seed errors (e.g. concurrent workers)
  }
}

seedAdmin();
