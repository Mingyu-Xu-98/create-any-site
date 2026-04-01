# Create Any Portfolio

AI-driven website builder for portfolio, profile, brand, and blog sites.

Users can upload source materials, extract structured knowledge, chat with the builder, generate a site draft, iteratively modify it, and publish static previews.

## Stack

- Next.js 16
- React 19
- Tailwind CSS 4
- NextAuth 5
- SQLite with Drizzle ORM
- SiliconFlow / OpenRouter for LLM calls
- JSZip, Mammoth, MinerU for source ingestion

## Main Capabilities

- Source ingestion from PDF, DOCX, TXT, MD, ZIP, and URLs
- Knowledge base and knowledge-group management
- Conversational site planning and PRD generation
- Two generation paths:
  - Default mode: `ContentModel -> Template`
  - Advanced mode: `PRD -> Spec -> CompositionPlan -> Generator`
- Incremental site modification after generation
- Queued builds with a separate worker
- Static preview publishing
- Admin pages for users, templates, and skills

## Project Layout

```txt
src/app                 Next.js app routes and API routes
src/components          App-level React components
src/lib                 Core generation, build, DB, auth, and AI logic
src/prompts             Agent and spec-compilation prompts
scripts                 Worker and utility scripts
docs                    Product and deployment docs
sites-data              Generated site workspaces and build artifacts
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env.local` with the values you need.

Minimum useful local setup:

```env
NEXTAUTH_SECRET=change-me
NEXTAUTH_URL=http://localhost:3000

SILICONFLOW_API_KEY=your_key
SILICONFLOW_MODEL=Pro/zai-org/GLM-5
```

Optional provider override:

```env
OPENROUTER_API_KEY=your_key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openai/gpt-4.1-mini
OPENROUTER_HTTP_REFERER=http://localhost:3000
OPENROUTER_APP_NAME=CreateAnyPortfolio
```

Optional preview / worker settings:

```env
PREVIEW_BASE_URL=http://localhost:3002
PREVIEW_PUBLISH_DIR=
BUILD_INLINE_JOBS=1
BUILD_WORKER_POLL_MS=2000
USE_SHARED_NODE_MODULES=0
RUNTIME_BASE_DIR=
```

## Development

Run the web app:

```bash
npm run dev
```

Run the production build:

```bash
npm run build
npm start
```

Run the separate build worker:

```bash
npm run worker
```

## Scripts

- `npm run dev` - start local Next.js dev server
- `npm run build` - build the app
- `npm start` - run the production server
- `npm run worker` - run the queued build worker

## Build Model

The app has two generation paths:

### Default mode

- Builds a `ContentModel` from selected knowledge
- Selects a registered template by site mode
- Renders a complete file map from the template

Relevant files:

- `src/lib/content-model.ts`
- `src/lib/template-renderer.ts`
- `src/lib/templates/*`

### Advanced mode

- Uses chat agents to produce a PRD
- Compiles a `SiteSpec`
- Generates a `CompositionPlan`
- Builds the site from the component-based generator

Relevant files:

- `src/lib/build-agents.ts`
- `src/app/api/compile-spec/route.ts`
- `src/lib/generator.ts`
- `src/lib/build-runtime.ts`

## Data and Runtime

- App data is stored in SQLite through Drizzle
- Generated site files and build artifacts are written under `sites-data/`
- Preview publishing can write static output into `PREVIEW_PUBLISH_DIR`

## Related Docs

- [Product requirements](./docs/PRD.md)
- [Production deployment](./docs/deployment-production.md)
- [Feature check](./docs/feature-check.md)

## Current Status

This repository is under active development. The generation pipeline and mode boundaries are still evolving, so expect behavior changes while default mode and advanced mode are being stabilized.
