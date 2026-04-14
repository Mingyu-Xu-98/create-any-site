# Create Any Portfolio

**English** | [中文](./README.md)

AI-powered full-stack website builder. Users upload personal materials (resumes, portfolios, etc.), generate a personal website through conversational AI, with support for iterative editing and one-click publishing.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 + React 19 |
| Styling | Tailwind CSS 4 |
| Auth | NextAuth 5 |
| Database | SQLite + Drizzle ORM |
| LLM | OpenRouter (Claude Sonnet) / SiliconFlow (GLM-5) dual-chain |
| Doc Parsing | JSZip, Mammoth, MinerU |
| Process Mgmt | PM2 |
| Reverse Proxy | Nginx |

## Core Features

- **Knowledge Base** — Multi-format import (PDF, DOCX, TXT, MD, ZIP, URL) with auto-parsing
- **Conversational Site Building** — AI chat → PRD → SiteSpec → full website generation
- **KB Smart Extraction** — Auto-extract name, title, projects, skills from knowledge base to populate site
- **Iterative Editing** — Intent classification (style/content/component/structure/fix) → Edit Agent → incremental changes
- **Auto-Fix** — 15+ deterministic code guardrail rules + Edit Agent two-layer repair
- **Queued Builds** — Separate worker process for build tasks with concurrency support
- **Static Publishing** — Next.js static export → Nginx direct serving
- **Share Poster** — Canvas-generated share image with QR code

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── create/page.tsx           # Create page (chat + preview)
│   ├── edit/[siteId]/page.tsx    # Edit workspace
│   ├── dashboard/page.tsx        # My Sites dashboard
│   ├── knowledge/                # Knowledge base management
│   ├── admin/                    # Admin panel
│   └── api/
│       ├── chat-build/           # Conversational build API
│       ├── generate/             # Site generation API
│       ├── edit/                 # Edit API
│       ├── sites/                # Site CRUD + publishing
│       ├── kb/                   # Knowledge base file management
│       └── ingestion/            # Document parsing
├── lib/
│   ├── build-runtime.ts          # Build runtime (core)
│   ├── build-agents.ts           # PRD/Spec/Code Agents
│   ├── build-queue.ts            # Build queue worker
│   ├── code-guardrails.ts        # Code quality guardrails (15+ rules)
│   ├── edit-runtime.ts           # Edit runtime
│   ├── edit-agent.ts             # Edit Agent (LLM-driven)
│   ├── edit-classifier.ts        # Edit intent classifier
│   ├── generator.ts              # Advanced mode site generator
│   ├── generator-shared.ts       # Share poster, shared components
│   ├── shared-components.ts      # Generated site base files
│   ├── kb-loader.ts              # Knowledge base loading & formatting
│   ├── llm.ts                    # LLM calls (OpenRouter + SiliconFlow)
│   ├── db/
│   │   ├── schema.ts             # Drizzle table definitions
│   │   └── index.ts              # DB connection + auto-migration
│   ├── error-collector.ts        # Error pattern collection
│   └── asset-store.ts            # User image storage
├── prompts/                      # Agent prompt templates
└── components/                   # Shared UI components

sites-data/                       # Generated site workspaces
├── {siteId}/
│   ├── builds/{buildId}/         # Immutable build artifacts
│   ├── current -> builds/xxx     # Current version symlink
│   └── public/images/            # User image assets
data/
├── app.db                        # SQLite main database
├── app.db.bak.*                  # Auto backups
└── user-assets/{userId}/         # User uploaded raw files
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env.local`:

```env
# ========== Required ==========
NEXTAUTH_SECRET=your-random-secret-string
NEXTAUTH_URL=http://localhost:3001

# LLM Provider (configure at least one)
# Option A: OpenRouter (recommended, supports Claude Sonnet)
OPENROUTER_API_KEY=sk-or-v1-xxx
OPENROUTER_MODEL=anthropic/claude-sonnet-4-20250514
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_HTTP_REFERER=http://localhost:3001
OPENROUTER_APP_NAME=CreateAnyPortfolio

# Option B: SiliconFlow (fallback)
SILICONFLOW_API_KEY=sk-xxx
SILICONFLOW_MODEL=Pro/zai-org/GLM-5

# ========== Build & Preview ==========
PREVIEW_BASE_URL=http://localhost:3002
PREVIEW_PUBLISH_DIR=                      # Empty = use built-in static server
BUILD_INLINE_JOBS=1                       # 1=inline (dev), 0=worker queue (prod)

# ========== Optional ==========
RUNTIME_BASE_DIR=                         # Shared node_modules path
USE_SHARED_NODE_MODULES=0                 # 1=shared, 0=per-site install
MAX_UPLOAD_BYTES=104857600                # Upload size limit (default 100MB)
MAX_KB_UPLOAD_BYTES=52428800              # KB file limit (default 50MB)
MINERU_API_KEY=                           # MinerU PDF parsing (optional)
SILICONFLOW_IMAGE_MODEL=Kwai-Kolors/Kolors  # AI image generation model
```

### 3. Start Development

```bash
# Start web app (port 3001)
npm run dev -- -p 3001

# Or use default port
npm run dev
```

### 4. Access

- Homepage: http://localhost:3001
- Register an account to get started

## Production Deployment

### Server Requirements

- Node.js 20+
- Nginx
- PM2 (process management)
- Minimum 2GB RAM (LLM calls + Next.js builds are resource-intensive)

### Deployment Steps

#### 1. Prepare Directories

```bash
mkdir -p /opt/create-any-site
mkdir -p /srv/www/create-any-site/previews
cd /opt/create-any-site
git clone <your-repo-url> .
npm install
```

#### 2. Configure Production Environment

Create `.env.local`:

```env
# Base config
NEXTAUTH_SECRET=your-production-secret
NEXTAUTH_URL=https://your-domain.com
NODE_ENV=production

# LLM (dual-chain recommended)
OPENROUTER_API_KEY=sk-or-v1-xxx
OPENROUTER_MODEL=anthropic/claude-sonnet-4-20250514
SILICONFLOW_API_KEY=sk-xxx
SILICONFLOW_MODEL=Pro/zai-org/GLM-5

# Build & Preview
PREVIEW_BASE_URL=https://your-domain.com/p
PREVIEW_PUBLISH_DIR=/srv/www/create-any-site/previews
BUILD_INLINE_JOBS=0          # Must use worker queue in production
BUILD_WORKER_POLL_MS=2000
BUILD_MAX_CONCURRENCY=2
USE_SHARED_NODE_MODULES=1    # Recommended: saves disk and install time
MAX_RETAINED_BUILDS=5        # Retain last 5 builds per site

# Rate limiting
LOGIN_RL_IP_PER_MIN=5
LOGIN_RL_EMAIL_PER_MIN=3
SITE_CHAT_RL_IP_PER_MIN=10
```

#### 3. Build

```bash
npm run build
```

#### 4. Start with PM2

```bash
# Web app
pm2 start npm --name create-any-site -- start

# Build worker
pm2 start npm --name create-any-site-worker -- run worker

# Save and enable startup
pm2 save
pm2 startup
```

#### 5. Nginx Configuration

```nginx
server_tokens off;

server {
    listen 80;
    server_name your-domain.com;
    client_max_body_size 100m;

    # Main app proxy
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Static preview sites
    location /p/ {
        alias /srv/www/create-any-site/previews/;
        autoindex off;
        try_files $uri $uri/ $uri/index.html =404;

        # Security: block source code and sensitive files
        location ~ /\.(?!well-known) { deny all; return 404; }
        location ~ \.(ts|tsx|env|db|sqlite|map)$ { deny all; return 404; }
        location ~ /(package\.json|tsconfig.*\.json|next\.config\..*)$ { deny all; return 404; }

        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
    }

    # Block access to internal directories
    location ~ ^/(sites-data|data|node_modules|\.git)(/|$) {
        deny all;
        return 404;
    }
}
```

```bash
nginx -t && systemctl reload nginx
```

### Update Deployment

```bash
cd /opt/create-any-site
git pull
npm install
npm run build
pm2 restart create-any-site --update-env
pm2 restart create-any-site-worker --update-env
```

## Architecture Overview

### Site Building Flow

```
User uploads materials → Knowledge Base → Conversational PRD → SiteSpec → CompositionPlan → Code Agent → Site files
                             ↓                                                                    ↓
                       KB Smart Extraction                                                Code Guardrails
                       (name/title/                                                    (15+ auto-fix rules)
                        projects/skills)                                                        ↓
                             ↓                                                           Next.js Build
                        Translations                                                          ↓
                       (i18n data)                                                  Static Export → Nginx
```

### Edit Flow

```
User edit instruction
       ↓
  Intent classification (style/content/component/structure/fix)
       ↓
  Scope files by intent
       ↓
  Edit Agent (LLM) generates changes
       ↓
  Code Guardrails auto-correction
       ↓
  Next.js rebuild
       ↓
  Failure → Retry (max 2 attempts)
```

### Auto-Fix Flow (Fix Errors Button)

```
Click "Fix Errors"
       ↓
  Code Guardrails scan (deterministic rule fixes)
       ↓
  Rebuild
       ↓
  Success → Done
  Failure → Edit Agent takes over (with error context)
       ↓
  Retry up to 2 times
```

### Immutable Build System

```
sites-data/{siteId}/
├── builds/
│   ├── build-001/          # Immutable: never modified after build
│   ├── build-002/
│   └── build-003/
├── current -> builds/build-003   # Atomic symlink swap
```

- Each build creates a new `buildId` directory
- Atomic symlink `current` switches versions
- Historical builds retained (configurable via `MAX_RETAINED_BUILDS`)
- Rollback to any previous version supported

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXTAUTH_SECRET` | Yes | - | NextAuth encryption key |
| `NEXTAUTH_URL` | Yes | - | App access URL |
| `OPENROUTER_API_KEY` | * | - | OpenRouter API Key |
| `OPENROUTER_MODEL` | - | `openai/gpt-4.1-mini` | OpenRouter model |
| `OPENROUTER_BASE_URL` | - | `https://openrouter.ai/api/v1` | OpenRouter endpoint |
| `SILICONFLOW_API_KEY` | * | - | SiliconFlow API Key |
| `SILICONFLOW_MODEL` | - | `Pro/zai-org/GLM-5` | SiliconFlow model |
| `SILICONFLOW_IMAGE_MODEL` | - | `Kwai-Kolors/Kolors` | AI image model |
| `PREVIEW_BASE_URL` | - | `http://localhost:3002` | Preview site base URL |
| `PREVIEW_PUBLISH_DIR` | - | empty (built-in server) | Static publish directory |
| `BUILD_INLINE_JOBS` | - | `1` | 1=inline build, 0=worker queue |
| `BUILD_WORKER_POLL_MS` | - | `2000` | Worker poll interval (ms) |
| `BUILD_MAX_CONCURRENCY` | - | `2` | Max concurrent builds |
| `RUNTIME_BASE_DIR` | - | `sites-data/_runtime_base` | Runtime base directory |
| `USE_SHARED_NODE_MODULES` | - | `0` | Share node_modules |
| `MAX_RETAINED_BUILDS` | - | `5` | Retained builds count |
| `MAX_UPLOAD_BYTES` | - | `104857600` | Upload size limit |
| `MAX_KB_UPLOAD_BYTES` | - | `52428800` | KB file limit |
| `MINERU_API_KEY` | - | - | MinerU PDF parsing |
| `LOGIN_RL_IP_PER_MIN` | - | `10` | Login rate limit/IP/min |
| `LOGIN_RL_EMAIL_PER_MIN` | - | `5` | Login rate limit/email/min |
| `BACKUP_INTERVAL_MS` | - | `3600000` | DB auto-backup interval |
| `BACKUP_RETAIN_COUNT` | - | `5` | Backup retention count |

> \* At least one of `OPENROUTER_API_KEY` or `SILICONFLOW_API_KEY` must be configured

## NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run worker` | Start build worker |

## Database

- SQLite database at `data/app.db`
- Auto-migration on startup (`src/lib/db/index.ts`)
- Auto-backup to `data/app.db.bak.*`
- Main tables: `users`, `sites`, `site_builds`, `knowledge_bases`, `knowledge_files`, `edit_sessions`

## Related Docs

- [Product Requirements](./docs/PRD.md)
- [Production Deployment Guide](./docs/deployment-production.md)
- [Feature Checklist](./docs/feature-check.md)
- [Database & User Management](./docs/database-and-user-management.md)

## License

Private — All rights reserved.
