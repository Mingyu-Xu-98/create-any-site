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
  previewUrl: text("preview_url"),
  publishedUrl: text("published_url"),
  templateId: text("template_id"),
  editorState: text("editor_state"),      // JSON
  prd: text("prd"),                       // Current PRD JSON
  prdHistory: text("prd_history"),        // JSON array of {version, prd, createdAt, note}
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ---- Knowledge Groups (folders) ----

export const knowledgeGroups = sqliteTable("knowledge_groups", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  indexMd: text("index_md"),           // AI-generated index for model consumption
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
  selected: integer("selected").default(1),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
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
