import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ---- NextAuth tables ----

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: integer("email_verified", { mode: "timestamp" }),
  password: text("password"), // bcrypt hashed
  image: text("image"),
  role: text("role").default("user"), // "user" | "admin"
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

export const sessions = sqliteTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: text("expires").notNull(),
});

export const verificationTokens = sqliteTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: text("expires").notNull(),
});

// ---- Sites ----

export const sites = sqliteTable("sites", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  slug: text("slug").unique().notNull(),
  name: text("name").notNull(),
  siteType: text("site_type").notNull(),
  theme: text("theme").notNull(),
  layout: text("layout").notNull(),
  workspaceData: text("workspace_data"), // JSON
  selections: text("selections"),         // JSON
  fileMap: text("file_map"),              // JSON
  status: text("status").default("draft"), // draft | published | archived
  buildStatus: text("build_status").default("idle"), // idle | queued | building | ready | failed
  buildError: text("build_error"),
  draftBuildId: text("draft_build_id"),
  publishedBuildId: text("published_build_id"),
  previewUrl: text("preview_url"),
  publishedUrl: text("published_url"),
  publishedAt: text("published_at"),
  isPublic: integer("is_public").default(0),   // 0=private, 1=public (shown on homepage)
  publicDesc: text("public_desc"),              // One-line description for public showcase
  templateId: text("template_id"),
  editorState: text("editor_state"),      // JSON
  prd: text("prd"),                       // Current PRD JSON
  prdHistory: text("prd_history"),        // JSON array of {version, prd, createdAt, note}
  lastBuiltAt: text("last_built_at"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const siteBuilds = sqliteTable("site_builds", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").default("queued"), // queued | building | ready | failed
  payload: text("payload").notNull(), // JSON
  previewUrl: text("preview_url"),
  fileMapSnapshot: text("file_map_snapshot"),
  specSnapshot: text("spec_snapshot"),
  prdSnapshot: text("prd_snapshot"),
  knowledgeRefsSnapshot: text("knowledge_refs_snapshot"),
  error: text("error"),
  logs: text("logs"), // JSON array
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ---- Ingestion Tasks (background file processing) ----

export const ingestionTasks = sqliteTable("ingestion_tasks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  status: text("status").notNull().default("queued"), // queued | processing | done | error
  progress: text("progress"),           // Human-readable progress message
  itemCount: integer("item_count"),     // How many items extracted
  groupId: text("group_id"),            // Created knowledge group ID
  error: text("error"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ---- Knowledge Bases (new: folder-level, with index + raw files) ----

export const knowledgeBases = sqliteTable("knowledge_bases", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  indexMd: text("index_md"),             // Auto-generated index: file list + descriptions + keywords
  fileCount: integer("file_count").default(0),
  totalChars: integer("total_chars").default(0),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const knowledgeFiles = sqliteTable("knowledge_files", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  baseId: text("base_id").notNull().references(() => knowledgeBases.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),          // Original filename or link title
  type: text("type").notNull(),          // pdf, md, txt, docx, image, link
  description: text("description"),       // AI-generated one-line description
  keywords: text("keywords"),             // JSON array of keywords
  originalUrl: text("original_url"),      // For links: the original URL
  contentLength: integer("content_length").default(0), // Character count of raw content
  content: text("content"),               // Raw full text (parsed from PDF/DOCX, or link content)
  mimeType: text("mime_type"),            // For images: image/png etc
  assetPath: text("asset_path"),          // For images: path in user-assets
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ---- Knowledge Groups (legacy — kept for backwards compat) ----

export const knowledgeGroups = sqliteTable("knowledge_groups", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  indexMd: text("index_md"),           // AI-generated index for model consumption (mapping/routing)
  eurekaMd: text("eureka_md"),        // Cross-domain insights discovered during extraction
  tags: text("tags"),                  // JSON array
  sourceFile: text("source_file"),     // Original filename
  sourceType: text("source_type"),     // pdf/zip/docx/txt/md
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ---- Knowledge Items ----

export const knowledgeItems = sqliteTable("knowledge_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  groupId: text("group_id").references(() => knowledgeGroups.id, { onDelete: "cascade" }),
  sourceId: text("source_id"),
  sourceName: text("source_name"),
  sourceType: text("source_type"),
  category: text("category").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  tags: text("tags"),         // JSON array
  useCase: text("use_case"),  // When to retrieve this knowledge (routing hint)
  format: text("format"),     // "narrative" or "structured"
  selected: integer("selected").default(1),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ---- Knowledge Relations (edges between items) ----

export const knowledgeRelations = sqliteTable("knowledge_relations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fromId: text("from_id").notNull().references(() => knowledgeItems.id, { onDelete: "cascade" }),
  toId: text("to_id").notNull().references(() => knowledgeItems.id, { onDelete: "cascade" }),
  relationType: text("relation_type").notNull(), // used_in, belongs_to, requires, produced, collaborated_with, led_to, part_of
  label: text("label"),             // Human-readable: "Python used in Data Pipeline project"
  strength: integer("strength").default(1), // 1=weak, 2=medium, 3=strong
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ---- Conversations ----

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  siteId: text("site_id").references(() => sites.id, { onDelete: "set null" }),
  title: text("title"),
  messages: text("messages").notNull(), // JSON array of {role, content}
  previewUrl: text("preview_url"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ---- Skills (progressive disclosure: description → indexContent → references) ----

export const skills = sqliteTable("skills", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),          // Level 0: AI-generated trigger description (~50 words)
  category: text("category").notNull(),      // design | content | layout | interaction | seo | other
  indexContent: text("index_content").notNull(), // Level 1: index.md full text (how to apply)
  references: text("references"),            // Level 2: JSON [{name, content}] (deep reference docs)
  siteTypes: text("site_types"),             // JSON array
  enabled: integer("enabled").default(1),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ---- Templates (Phase 2) ----

export const templates = sqliteTable("templates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  siteType: text("site_type").notNull(),
  theme: text("theme").notNull(),
  layout: text("layout").notNull(),
  previewImage: text("preview_image"),
  previewUrl: text("preview_url"),
  fileMap: text("file_map"),  // JSON
  popularity: integer("popularity").default(0),
  featured: integer("featured").default(0),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ---- User Quotas (usage limits per user) ----

export const userQuotas = sqliteTable("user_quotas", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  plan: text("plan").notNull().default("free"), // free | pro | enterprise | custom
  monthlyTokenLimit: integer("monthly_token_limit").notNull().default(500000),
  monthlyBuildLimit: integer("monthly_build_limit").notNull().default(20),
  storageLimitMb: integer("storage_limit_mb").notNull().default(100),
  currentMonthTokens: integer("current_month_tokens").notNull().default(0),
  currentMonthBuilds: integer("current_month_builds").notNull().default(0),
  currentStorageMb: integer("current_storage_mb").notNull().default(0),
  periodStart: text("period_start").$defaultFn(() => new Date().toISOString()),
  metadata: text("metadata"), // JSON
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ---- Feature Flags ----

export const featureFlags = sqliteTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: integer("enabled").default(0),        // 0 = off, 1 = on
  description: text("description"),
  allowList: text("allow_list"),                  // JSON array of user IDs
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ---- Usage Logs (per-call token tracking) ----

export const usageLogs = sqliteTable("usage_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // llm_call | build | file_upload | entity_extract | relation_infer
  provider: text("provider"),       // siliconflow | openrouter | anthropic
  model: text("model"),             // Pro/zai-org/GLM-5 etc.
  inputTokens: integer("input_tokens").default(0),
  outputTokens: integer("output_tokens").default(0),
  totalTokens: integer("total_tokens").default(0),
  durationMs: integer("duration_ms"),
  label: text("label"),             // chat-build, compile-spec, code-agent, kb-describe ...
  siteId: text("site_id"),
  status: text("status").default("success"), // success | error
  errorMessage: text("error_message"),
  metadata: text("metadata"),       // JSON
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});
