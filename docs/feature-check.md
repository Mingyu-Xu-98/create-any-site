# Feature Checklist — PRD vs Codebase Audit

**Date**: 2026-03-26
**Compared**: `docs/PRD.md` against actual source files

---

## 1. Database Tables (src/lib/db/schema.ts + src/lib/db/index.ts)

- ✅ **users** — All PRD fields present (id, name, email, password, role, image, created_at). Extra fields: emailVerified, updatedAt
- ✅ **accounts** — OAuth table present (reserved for Phase 2)
- ✅ **sessions** — JWT session table present
- ✅ **verificationTokens** — Present (extra table, not in PRD but standard NextAuth)
- ✅ **sites** — All PRD fields present (id, user_id, slug, name, site_type, theme, layout, workspace_data, selections, file_map, status, preview_url, prd, prd_history). Extra fields: published_url, template_id, editor_state, updatedAt
- ✅ **knowledge_groups** — All PRD fields present (id, user_id, name, description, index_md, tags, source_file, source_type)
- ✅ **knowledge_items** — All PRD fields present (id, user_id, group_id, category, title, content, tags, selected). Extra fields: source_id, source_name, source_type
- ✅ **conversations** — All PRD fields present (id, user_id, site_id, title, messages, preview_url)
- ✅ **skills** — All PRD fields present (id, name, description, category, index_content, references, enabled). Extra fields: site_types, createdAt, updatedAt
- ✅ **templates** — All PRD fields present (id, name, category, site_type, theme, layout, file_map, preview_image, featured). Extra fields: description, preview_url, popularity
- ✅ **DB init (index.ts)** — Auto-creates all tables with CREATE TABLE IF NOT EXISTS, WAL mode, busy_timeout 5s, foreign_keys ON, admin seed account

---

## 2. API Routes

### 2.1 Auth API
- ✅ **POST /api/auth/[...nextauth]** — NextAuth handler present (`export const { GET, POST } = handlers`)
- ✅ **POST /api/auth/register** — Registration route present (exports POST)

### 2.2 Sites API
- ✅ **GET /api/sites** — List user sites (exports GET)
- ✅ **POST /api/sites** — Create site (exports POST)
- ✅ **GET /api/sites/[id]** — Get site details (exports GET)
- ✅ **PUT /api/sites/[id]** — Update site (exports PUT)
- ✅ **DELETE /api/sites/[id]** — Delete site (exports DELETE)

### 2.3 Knowledge API
- ✅ **GET /api/knowledge-groups** — List knowledge groups (exports GET)
- ✅ **POST /api/knowledge-groups** — Create knowledge group + items (exports POST)
- ✅ **GET /api/knowledge-groups/[id]** — Get group details + items (exports GET)
- ✅ **PUT /api/knowledge-groups/[id]** — Update group (exports PUT)
- ✅ **DELETE /api/knowledge-groups/[id]** — Delete group with CASCADE (exports DELETE)
- ✅ **GET /api/knowledge** — List all user knowledge items (exports GET)
- ✅ **POST /api/knowledge** — Batch create items (exports POST)
- ✅ **PUT /api/knowledge/[id]** — Update single item (exports PUT)
- ✅ **DELETE /api/knowledge/[id]** — Delete single item (exports DELETE)

### 2.4 AI Build API
- ✅ **POST /api/analyze-source** — File parsing (PDF/DOCX/ZIP/TXT/MD/URL) with knowledge extraction (619 lines)
- ✅ **POST /api/chat-build** — Conversational build with PRD generation, option cards, skill loading (266 lines)
- ✅ **POST /api/generate** — Code generation + static export + HTTP preview server (226 lines)
- ✅ **POST /api/modify** — Incremental code modification + re-export (88 lines)
- ✅ **POST /api/design-system** — Design system query (calls BM25 Python search engine via ui-skill/scripts/search.py)

### 2.5 Conversations API
- ✅ **GET /api/conversations** — List conversations (exports GET)
- ✅ **POST /api/conversations** — Create conversation (exports POST)
- ✅ **GET /api/conversations/[id]** — Get conversation details (exports GET)
- ✅ **PUT /api/conversations/[id]** — Update conversation (exports PUT)
- ✅ **DELETE /api/conversations/[id]** — Delete conversation (exports DELETE)

### 2.6 Admin API
- ✅ **GET /api/admin/stats** — Statistics data (exports GET, uses requireAdmin)
- ✅ **GET /api/admin/users** — User list (exports GET, uses requireAdmin)
- ✅ **GET/POST /api/admin/skills** — Skill CRUD list + create (exports GET, POST)
- ✅ **GET/PUT/DELETE /api/admin/skills/[id]** — Skill detail/update/delete
- ✅ **POST /api/admin/skills/upload** — Upload skill package
- ✅ **GET/POST /api/admin/templates** — Template CRUD list + create
- ✅ **GET/PUT/DELETE /api/admin/templates/[id]** — Template detail/update/delete

### Extra Routes (not in PRD)
- ⚠️ **POST /api/analyze** — Legacy analyze route (predates analyze-source, still exists)
- ⚠️ **POST /api/compile-spec** — Spec compilation route (not documented in PRD)
- ⚠️ **POST /api/generate-image** — Image generation route (PRD notes: disabled due to SiliconFlow model)
- ⚠️ **GET /api/skills** — Public skills listing route (not in PRD, but functional)

---

## 3. Frontend Pages

- ✅ **/ (Landing Page)** — `src/app/page.tsx` exists
- ✅ **/login** — `src/app/login/page.tsx` exists
- ✅ **/register** — `src/app/register/page.tsx` exists
- ✅ **/templates** — `src/app/templates/page.tsx` exists
- ✅ **/create** — `src/app/create/page.tsx` exists (1167 lines, full workspace with build/sources/knowledge views)
- ✅ **/dashboard** — `src/app/dashboard/page.tsx` exists
- ✅ **/admin** — `src/app/admin/page.tsx` exists
- ✅ **/admin/users** — `src/app/admin/users/page.tsx` exists
- ✅ **/admin/skills** — `src/app/admin/skills/page.tsx` exists
- ✅ **/admin/skills/new** — `src/app/admin/skills/new/page.tsx` exists
- ✅ **/admin/skills/[id]** — `src/app/admin/skills/[id]/page.tsx` exists
- ✅ **/admin/templates** — `src/app/admin/templates/page.tsx` exists
- ✅ **/admin/templates/new** — `src/app/admin/templates/new/page.tsx` exists
- ✅ **/admin/templates/[id]** — `src/app/admin/templates/[id]/page.tsx` exists

---

## 4. Core Flows

### 4.1 PRD-Driven Build Flow
- ✅ **Phase 1: AI questioning with option cards** — chat-build outputs `"type": "options"` action blocks, 3-5 questions enforced in prompt
- ✅ **Phase 2: PRD generation** — chat-build outputs `"type": "prd"` action, mandatory before generate (enforced in system prompt)
- ✅ **Phase 3: Code generation** — generate route writes files to `sites-data/{siteId}/`, runs `next build` with static export, serves via HTTP server
- ✅ **Phase 4: Incremental modification** — modify route reads current fileMap, applies file-level changes, re-exports

### 4.2 Knowledge Flow
- ✅ **PDF parsing** — MinerU API integration (OCR + table + formula), with fallback to basic extraction
- ✅ **DOCX parsing** — mammoth library imported and used
- ✅ **TXT/MD parsing** — Direct text reading
- ✅ **ZIP parsing** — JSZip imported, per-file extraction
- ✅ **Git URL** — GitHub API fetching (repo info, README, languages)
- ⚠️ **Bilibili URL** — Basic video info fetch (title, description, stats) via Bilibili API. **No subtitle/transcript extraction** (PRD Phase 2 item)
- ⚠️ **YouTube URL** — Video ID extraction only. **No subtitle/transcript extraction** (PRD Phase 2 item)
- ✅ **AI knowledge extraction** — SiliconFlow GLM model integration for categorization
- ✅ **Knowledge group creation** — Batch insert to knowledge_groups + knowledge_items

### 4.3 Progressive Skill Loading
- ✅ **Level 0** — All skill descriptions loaded in chat-build (`db.select description from skills`)
- ✅ **Level 1** — On-demand indexContent loaded for activated skills
- ⚠️ **Level 2** — References field exists in schema but not explicitly loaded in chat-build route (only Level 0 + Level 1 confirmed)

### 4.4 Code Modification Flow
- ✅ **Chat-based modification** — chat-build loads current fileMap, injects source files into context
- ✅ **Modify action output** — AI outputs file-level replace/create/delete actions
- ✅ **Re-export** — modify route runs next build after changes
- ✅ **iframe refresh** — Frontend handles preview URL updates

---

## 5. i18n (src/lib/i18n.ts)

- ✅ **Dual language support** — zh/en locale type defined
- ✅ **Translation function** — `t(key, locale)` exported
- ✅ **Navigation translations** — nav.templates, nav.dashboard, nav.admin, nav.login, nav.logout
- ✅ **Landing page translations** — 15 landing.* keys
- ✅ **Login/Register translations** — 10 login.* keys, 10 register.* keys
- ✅ **Dashboard translations** — 5 dashboard.* keys
- ✅ **Create page translations** — 20 create.* keys
- ✅ **Templates translations** — 6 templates.* keys
- ❌ **Admin translations** — Zero admin.* keys found (admin pages likely not i18n-ized)
- ⚠️ **Total translation count** — ~89 entries. PRD says "100+ items" — currently falls short

---

## 6. Skills System

- ✅ **skills/ directory exists** — Contains index.md, 3 skill packages (storytelling PDF skills, style-skills, ui-skill)
- ✅ **Skill upload API** — POST /api/admin/skills/upload handles skill package upload
- ✅ **Skill CRUD** — Full admin CRUD for skills table
- ✅ **Skill schema** — Progressive disclosure fields (description, indexContent, references)
- ✅ **BM25 design system** — ui-skill has Python BM25 search engine (search.py)

---

## 7. Security Mechanisms

- ✅ **JWT session** — NextAuth with JWT
- ✅ **bcrypt password hashing** — Used in register + admin seed
- ✅ **requireAdmin() guard** — Used on all /api/admin/* routes
- ✅ **SQLite WAL mode + busy_timeout** — Configured in db/index.ts
- ✅ **Foreign keys ON** — Enabled in db/index.ts pragma

---

## 8. Logging System

- ✅ **Log directory** — `data/logs/analyze-YYYY-MM-DD.log`
- ✅ **JSON per line format** — time, level, module, message, data fields
- ✅ **Log levels** — INFO, WARN, ERROR
- ✅ **Module coverage** — handler, mineru, ai, zip, git, bilibili, youtube, generate, chat-build, modify, skill-upload all observed

---

## 9. Deployment Config

- ✅ **Dev server** — Next.js dev on configured port
- ✅ **Preview server** — Static HTTP server in generate route (separate port)
- ✅ **SQLite DB path** — data/app.db
- ✅ **Generated sites** — sites-data/{siteId}/out/ static HTML

---

## 10. Known Discrepancies Summary

| # | Issue | Severity |
|---|-------|----------|
| 1 | Admin pages have zero i18n translations | Medium |
| 2 | i18n has ~89 entries, PRD claims "100+" | Low |
| 3 | Video subtitle extraction (Bilibili/YouTube) not implemented (PRD lists as Phase 2) | Low — acknowledged |
| 4 | Level 2 skill references not explicitly loaded in chat-build | Low |
| 5 | 4 extra API routes not documented in PRD (analyze, compile-spec, generate-image, skills) | Low — legacy/experimental |
| 6 | PRD says "27 API routes" — actual main routes: 24 documented + 4 extra = 28 total | Info |
| 7 | Image generation API disabled (SiliconFlow model issue, noted in PRD known issues) | Acknowledged |
