# Production Deployment

This project now supports queued site builds with a separate worker process.

## Architecture

- Web app:
  - handles auth, chat, knowledge, PRD, site management
  - creates build jobs through `POST /api/generate`
- Build worker:
  - polls `site_builds`
  - builds site output
  - publishes static preview files into `PREVIEW_PUBLISH_DIR/<siteId>`
- Nginx:
  - `/` proxies to the web app
  - `/p/<siteId>` serves static preview files directly from disk

## Required Environment Variables

Set these on both the web app and the worker:

```env
PREVIEW_BASE_URL=http://YOUR_HOST/p
PREVIEW_PUBLISH_DIR=/srv/www/create-any-site/previews
BUILD_INLINE_JOBS=0
BUILD_WORKER_POLL_MS=2000
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://YOUR_HOST
```

LLM provider options:

```env
# Option A: OpenRouter (preferred if configured)
OPENROUTER_API_KEY=...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openai/gpt-4.1-mini
OPENROUTER_HTTP_REFERER=http://YOUR_HOST
OPENROUTER_APP_NAME=CreateAnySite

# Option B: SiliconFlow fallback
SILICONFLOW_API_KEY=...
SILICONFLOW_MODEL=Pro/zai-org/GLM-5
```

If `OPENROUTER_API_KEY` is present, the app uses OpenRouter first for `chat-build` and `compile-spec`.

## Directory Layout

Recommended server layout:

```txt
/opt/create-any-site
/srv/www/create-any-site/previews
```

- `/opt/create-any-site`
  - app code
  - sqlite database in `data/app.db`
  - transient build cache in `sites-data/`
- `/srv/www/create-any-site/previews`
  - final static preview output for Nginx

## PM2

Run the web app and worker as separate processes.

Example:

```bash
pm2 start npm --name create-any-site -- start
pm2 start npm --name create-any-site-worker -- run worker
pm2 save
```

If you prefer ecosystem config, use the example file in the repo root.

## Nginx

Use Nginx to proxy the main app and serve preview files directly.

Example:

```nginx
server {
    listen 80;
    server_name YOUR_HOST;

    client_max_body_size 50m;

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
        send_timeout 300s;
    }

    location /p/ {
        alias /srv/www/create-any-site/previews/;
        try_files $uri $uri/ $uri/index.html =404;
    }
}
```

Important:

- `PREVIEW_BASE_URL` must match the public `/p` prefix
- `PREVIEW_PUBLISH_DIR` must match the Nginx `alias` directory

## Deploy Flow

1. Pull latest code
2. Install dependencies
3. Build the web app
4. Ensure `PREVIEW_PUBLISH_DIR` exists
5. Restart PM2 web app
6. Start or restart PM2 worker
7. Reload Nginx

Example:

```bash
cd /opt/create-any-site
npm install
npm run build
mkdir -p /srv/www/create-any-site/previews
pm2 restart create-any-site --update-env
pm2 restart create-any-site-worker --update-env || pm2 start npm --name create-any-site-worker -- run worker
pm2 save
systemctl reload nginx
```

## Current Status Model

- `queued`
- `building`
- `ready`
- `failed`

The dashboard reads these values from the `sites` table.
