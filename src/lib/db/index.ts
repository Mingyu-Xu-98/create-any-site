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

export const sqlite = new Database(DB_PATH);
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
      build_status TEXT DEFAULT 'idle',
      build_error TEXT,
      draft_build_id TEXT,
      published_build_id TEXT,
      preview_url TEXT,
      published_url TEXT,
      published_at TEXT,
      template_id TEXT,
      editor_state TEXT,
      prd TEXT,
      prd_history TEXT,
      last_built_at TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS site_builds (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'queued',
      payload TEXT NOT NULL,
      preview_url TEXT,
      file_map_snapshot TEXT,
      spec_snapshot TEXT,
      prd_snapshot TEXT,
      knowledge_refs_snapshot TEXT,
      error TEXT,
      logs TEXT,
      started_at TEXT,
      finished_at TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS knowledge_bases (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      index_md TEXT,
      file_count INTEGER DEFAULT 0,
      total_chars INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS knowledge_files (
      id TEXT PRIMARY KEY,
      base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      keywords TEXT,
      original_url TEXT,
      content_length INTEGER DEFAULT 0,
      content TEXT,
      mime_type TEXT,
      asset_path TEXT,
      usage_tag TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS knowledge_groups (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      index_md TEXT,
      tags TEXT,
      source_file TEXT,
      source_type TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS knowledge_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      group_id TEXT REFERENCES knowledge_groups(id) ON DELETE CASCADE,
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

    CREATE TABLE IF NOT EXISTS ingestion_tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      progress TEXT,
      item_count INTEGER,
      group_id TEXT,
      error TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS knowledge_relations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      from_id TEXT NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
      to_id TEXT NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
      relation_type TEXT NOT NULL,
      label TEXT,
      strength INTEGER DEFAULT 1,
      created_at TEXT
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

    CREATE TABLE IF NOT EXISTS user_quotas (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      plan TEXT NOT NULL DEFAULT 'free',
      monthly_token_limit INTEGER NOT NULL DEFAULT 500000,
      monthly_build_limit INTEGER NOT NULL DEFAULT 20,
      storage_limit_mb INTEGER NOT NULL DEFAULT 100,
      current_month_tokens INTEGER NOT NULL DEFAULT 0,
      current_month_builds INTEGER NOT NULL DEFAULT 0,
      current_storage_mb INTEGER NOT NULL DEFAULT 0,
      period_start TEXT,
      metadata TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      provider TEXT,
      model TEXT,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      duration_ms INTEGER,
      label TEXT,
      site_id TEXT,
      status TEXT DEFAULT 'success',
      error_message TEXT,
      metadata TEXT,
      created_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_usage_logs_user_time ON usage_logs(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_logs_action ON usage_logs(action, created_at);

    CREATE TABLE IF NOT EXISTS llm_traces (
      id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      parent_span_id TEXT,
      phase TEXT NOT NULL,
      provider TEXT,
      model TEXT,
      system_prompt TEXT,
      user_prompt TEXT,
      messages TEXT,
      raw_response TEXT,
      parsed_output TEXT,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      latency_ms INTEGER,
      temperature REAL,
      max_tokens INTEGER,
      outcome TEXT DEFAULT 'success',
      outcome_tags TEXT,
      error_message TEXT,
      user_id TEXT,
      site_id TEXT,
      build_id TEXT,
      created_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_llm_traces_trace ON llm_traces(trace_id);
    CREATE INDEX IF NOT EXISTS idx_llm_traces_phase ON llm_traces(phase, created_at);
    CREATE INDEX IF NOT EXISTS idx_llm_traces_user ON llm_traces(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_llm_traces_outcome ON llm_traces(outcome, created_at);

    CREATE TABLE IF NOT EXISTS feature_flags (
      key TEXT PRIMARY KEY,
      enabled INTEGER DEFAULT 0,
      description TEXT,
      allow_list TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS edit_sessions (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'active',
      intent TEXT,
      instruction TEXT NOT NULL,
      changes TEXT,
      build_id_before TEXT,
      build_id_after TEXT,
      build_success INTEGER,
      build_error TEXT,
      created_at TEXT,
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_edit_sessions_site ON edit_sessions(site_id, created_at);

    CREATE TABLE IF NOT EXISTS error_patterns (
      id TEXT PRIMARY KEY,
      fingerprint TEXT UNIQUE,
      pattern TEXT NOT NULL,
      category TEXT NOT NULL,
      layer TEXT DEFAULT 'prompt',
      raw_example TEXT,
      bad_pattern TEXT,
      fix_hint TEXT,
      frequency INTEGER DEFAULT 1,
      applicable_context TEXT,
      last_seen_at TEXT,
      created_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_error_patterns_fingerprint ON error_patterns(fingerprint);
    CREATE INDEX IF NOT EXISTS idx_error_patterns_frequency ON error_patterns(frequency);

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

  const alterStatements = [
    "ALTER TABLE sites ADD COLUMN build_status TEXT DEFAULT 'idle'",
    "ALTER TABLE sites ADD COLUMN build_error TEXT",
    "ALTER TABLE sites ADD COLUMN last_built_at TEXT",
    "ALTER TABLE sites ADD COLUMN draft_build_id TEXT",
    "ALTER TABLE sites ADD COLUMN published_build_id TEXT",
    "ALTER TABLE sites ADD COLUMN published_at TEXT",
    "ALTER TABLE site_builds ADD COLUMN file_map_snapshot TEXT",
    "ALTER TABLE site_builds ADD COLUMN spec_snapshot TEXT",
    "ALTER TABLE site_builds ADD COLUMN prd_snapshot TEXT",
    "ALTER TABLE site_builds ADD COLUMN knowledge_refs_snapshot TEXT",
    "ALTER TABLE knowledge_items ADD COLUMN use_case TEXT",
    "ALTER TABLE knowledge_items ADD COLUMN format TEXT",
    "ALTER TABLE knowledge_groups ADD COLUMN eureka_md TEXT",
    "ALTER TABLE sites ADD COLUMN is_public INTEGER DEFAULT 0",
    "ALTER TABLE sites ADD COLUMN public_desc TEXT",
    "ALTER TABLE knowledge_bases ADD COLUMN profile_json TEXT",
    "ALTER TABLE knowledge_files ADD COLUMN usage_tag TEXT",
    "ALTER TABLE edit_sessions ADD COLUMN file_map_before TEXT",
  ];

  for (const statement of alterStatements) {
    try {
      sqlite.exec(statement);
    } catch {
      // Column already exists on upgraded databases.
    }
  }
}

initDb();

// Start the backup scheduler (side-effect import — timer is .unref()'d)
import("@/lib/db-backup").catch(() => {});
