# Create Any Portfolio

[English](./README.en.md) | **中文**

AI 驱动的全栈网站构建器。用户上传个人资料（简历、作品集等），通过对话式交互自动生成个人网站，支持二次编辑、一键发布。

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16 + React 19 |
| 样式 | Tailwind CSS 4 |
| 认证 | NextAuth 5 |
| 数据库 | SQLite + Drizzle ORM |
| LLM | OpenRouter (Claude Sonnet) / SiliconFlow (GLM-5) 双链路 |
| 文档解析 | JSZip, Mammoth, MinerU |
| 进程管理 | PM2 |
| 反向代理 | Nginx |

## 核心功能

- **知识库管理** — 支持 PDF、DOCX、TXT、MD、ZIP、URL 等多格式导入，自动解析结构化数据
- **对话式建站** — 通过 AI 对话生成 PRD → 编译 SiteSpec → 生成完整网站
- **KB 智能提取** — 从知识库中自动提取姓名、职位、项目、技能等信息填充网站
- **二次编辑** — 意图分类（样式/内容/组件/结构/修复）→ Edit Agent → 增量修改
- **自动修复** — 15+ 条 code guardrails 规则 + Edit Agent 双层修复
- **队列构建** — 独立 worker 进程处理构建任务，支持并发
- **静态发布** — Next.js 静态导出 → Nginx 直接服务
- **分享海报** — Canvas 生成带二维码的分享图片

## 项目结构

```
src/
├── app/                          # Next.js App Router
│   ├── create/page.tsx           # 创建页（对话 + 预览）
│   ├── edit/[siteId]/page.tsx    # 二次编辑页
│   ├── dashboard/page.tsx        # 我的网站
│   ├── knowledge/                # 知识库管理
│   ├── admin/                    # 管理后台
│   └── api/
│       ├── chat-build/           # 对话式构建 API
│       ├── generate/             # 站点生成 API
│       ├── edit/                 # 二次编辑 API
│       ├── sites/                # 站点 CRUD + 发布
│       ├── kb/                   # 知识库文件管理
│       └── ingestion/            # 文档解析
├── lib/
│   ├── build-runtime.ts          # 构建运行时（核心）
│   ├── build-agents.ts           # PRD/Spec/Code Agent
│   ├── build-queue.ts            # 构建队列 worker
│   ├── code-guardrails.ts        # 代码质量守卫（15+ 规则）
│   ├── edit-runtime.ts           # 二次编辑运行时
│   ├── edit-agent.ts             # Edit Agent（LLM 驱动）
│   ├── edit-classifier.ts        # 编辑意图分类器
│   ├── generator.ts              # 高级模式站点生成器
│   ├── generator-shared.ts       # 分享海报、通用组件
│   ├── shared-components.ts      # 生成站点的基础文件
│   ├── kb-loader.ts              # 知识库加载 & 格式化
│   ├── llm.ts                    # LLM 调用（OpenRouter + SiliconFlow）
│   ├── db/
│   │   ├── schema.ts             # Drizzle 数据表定义
│   │   └── index.ts              # DB 连接 + 自动迁移
│   ├── error-collector.ts        # 错误模式收集
│   └── asset-store.ts            # 用户图片存储
├── prompts/                      # Agent prompt 模板
└── components/                   # 共享 UI 组件

sites-data/                       # 生成的站点工作空间
├── {siteId}/
│   ├── builds/{buildId}/         # 不可变构建产物
│   ├── current -> builds/xxx     # 当前版本软链
│   └── public/images/            # 用户图片资源
data/
├── app.db                        # SQLite 主数据库
├── app.db.bak.*                  # 自动备份
└── user-assets/{userId}/         # 用户上传的原始文件
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env.local`：

```env
# ========== 必填 ==========
NEXTAUTH_SECRET=your-random-secret-string
NEXTAUTH_URL=http://localhost:3001

# LLM 提供商（至少配一个）
# 方案 A：OpenRouter（推荐，支持 Claude Sonnet）
OPENROUTER_API_KEY=sk-or-v1-xxx
OPENROUTER_MODEL=anthropic/claude-sonnet-4-20250514
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_HTTP_REFERER=http://localhost:3001
OPENROUTER_APP_NAME=CreateAnyPortfolio

# 方案 B：SiliconFlow（备用链路）
SILICONFLOW_API_KEY=sk-xxx
SILICONFLOW_MODEL=Pro/zai-org/GLM-5

# ========== 构建 & 预览 ==========
PREVIEW_BASE_URL=http://localhost:3002
PREVIEW_PUBLISH_DIR=                      # 留空 = 使用内置静态服务器
BUILD_INLINE_JOBS=1                       # 1=内联构建（开发），0=worker 队列（生产）

# ========== 可选 ==========
RUNTIME_BASE_DIR=                         # 共享 node_modules 路径
USE_SHARED_NODE_MODULES=0                 # 1=共享，0=每站点独立安装
MAX_UPLOAD_BYTES=104857600                # 上传大小限制（默认 100MB）
MAX_KB_UPLOAD_BYTES=52428800              # 知识库文件限制（默认 50MB）
MINERU_API_KEY=                           # MinerU PDF 解析（可选）
SILICONFLOW_IMAGE_MODEL=Kwai-Kolors/Kolors  # AI 生图模型
```

### 3. 启动开发

```bash
# 启动 Web 应用（默认端口 3001）
npm run dev -- -p 3001

# 或使用默认端口
npm run dev
```

### 4. 访问

- 应用首页：http://localhost:3001
- 注册账号后即可开始使用

## 生产部署

### 服务器要求

- Node.js 20+
- Nginx
- PM2（进程管理）
- 至少 2GB RAM（构建站点时 LLM 调用 + Next.js build 较占资源）

### 部署步骤

#### 1. 准备目录

```bash
mkdir -p /opt/create-any-site
mkdir -p /srv/www/create-any-site/previews
cd /opt/create-any-site
git clone <your-repo-url> .
npm install
```

#### 2. 配置生产环境变量

创建 `.env.local`：

```env
# 基础配置
NEXTAUTH_SECRET=your-production-secret
NEXTAUTH_URL=https://your-domain.com
NODE_ENV=production

# LLM（推荐双链路）
OPENROUTER_API_KEY=sk-or-v1-xxx
OPENROUTER_MODEL=anthropic/claude-sonnet-4-20250514
SILICONFLOW_API_KEY=sk-xxx
SILICONFLOW_MODEL=Pro/zai-org/GLM-5

# 构建与预览
PREVIEW_BASE_URL=https://your-domain.com/p
PREVIEW_PUBLISH_DIR=/srv/www/create-any-site/previews
BUILD_INLINE_JOBS=0          # 生产环境必须用 worker 队列
BUILD_WORKER_POLL_MS=2000
BUILD_MAX_CONCURRENCY=2
USE_SHARED_NODE_MODULES=1    # 推荐：节省磁盘和安装时间
MAX_RETAINED_BUILDS=5        # 每站点保留最近 5 个构建

# 安全限流
LOGIN_RL_IP_PER_MIN=5
LOGIN_RL_EMAIL_PER_MIN=3
SITE_CHAT_RL_IP_PER_MIN=10
```

#### 3. 构建

```bash
npm run build
```

#### 4. PM2 启动

```bash
# Web 应用
pm2 start npm --name create-any-site -- start

# 构建 Worker
pm2 start npm --name create-any-site-worker -- run worker

# 保存并设置开机自启
pm2 save
pm2 startup
```

#### 5. Nginx 配置

```nginx
server_tokens off;

server {
    listen 80;
    server_name your-domain.com;
    client_max_body_size 100m;

    # 主应用代理
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

    # 静态预览站点
    location /p/ {
        alias /srv/www/create-any-site/previews/;
        autoindex off;
        try_files $uri $uri/ $uri/index.html =404;

        # 安全：禁止访问源码和敏感文件
        location ~ /\.(?!well-known) { deny all; return 404; }
        location ~ \.(ts|tsx|env|db|sqlite|map)$ { deny all; return 404; }
        location ~ /(package\.json|tsconfig.*\.json|next\.config\..*)$ { deny all; return 404; }

        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
    }

    # 禁止直接访问内部目录
    location ~ ^/(sites-data|data|node_modules|\.git)(/|$) {
        deny all;
        return 404;
    }
}
```

```bash
nginx -t && systemctl reload nginx
```

### 更新部署

```bash
cd /opt/create-any-site
git pull
npm install
npm run build
pm2 restart create-any-site --update-env
pm2 restart create-any-site-worker --update-env
```

## 架构概览

### 建站流程

```
用户上传资料 → 知识库 → 对话式 PRD → SiteSpec → CompositionPlan → Code Agent → 站点文件
                ↓                                                        ↓
          KB 智能提取                                              Code Guardrails
          (name/title/                                            (15+ 规则自动修复)
           projects/skills)                                             ↓
                ↓                                                  Next.js Build
          Translations                                                  ↓
          (多语言数据)                                            静态导出 → Nginx
```

### 二次编辑流程

```
用户输入修改指令
       ↓
  意图分类（style/content/component/structure/fix）
       ↓
  按意图确定文件范围
       ↓
  Edit Agent（LLM）生成修改
       ↓
  Code Guardrails 自动修正
       ↓
  Next.js 重新构建
       ↓
  失败 → 重试（最多 2 次）
```

### 自动修复流程（修复错误按钮）

```
点击「修复错误」
       ↓
  Code Guardrails 扫描（确定性规则修复）
       ↓
  重新构建
       ↓
  成功 → 结束
  失败 → Edit Agent 接管（带错误上下文）
       ↓
  重试最多 2 次
```

### 不可变构建系统

```
sites-data/{siteId}/
├── builds/
│   ├── build-001/          # 不可变：构建完成后不再修改
│   ├── build-002/
│   └── build-003/
├── current -> builds/build-003   # 原子软链切换
```

- 每次构建生成新的 `buildId` 目录
- 通过原子软链接 `current` 切换版本
- 历史构建保留（可配置 `MAX_RETAINED_BUILDS`）
- 支持回滚到任意历史版本

## 环境变量完整参考

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `NEXTAUTH_SECRET` | ✅ | - | NextAuth 加密密钥 |
| `NEXTAUTH_URL` | ✅ | - | 应用访问地址 |
| `OPENROUTER_API_KEY` | ⚡ | - | OpenRouter API Key |
| `OPENROUTER_MODEL` | - | `openai/gpt-4.1-mini` | OpenRouter 模型 |
| `OPENROUTER_BASE_URL` | - | `https://openrouter.ai/api/v1` | OpenRouter 端点 |
| `SILICONFLOW_API_KEY` | ⚡ | - | SiliconFlow API Key |
| `SILICONFLOW_MODEL` | - | `Pro/zai-org/GLM-5` | SiliconFlow 模型 |
| `SILICONFLOW_IMAGE_MODEL` | - | `Kwai-Kolors/Kolors` | AI 生图模型 |
| `PREVIEW_BASE_URL` | - | `http://localhost:3002` | 预览站点基础 URL |
| `PREVIEW_PUBLISH_DIR` | - | 空（内置服务器） | 静态发布目录 |
| `BUILD_INLINE_JOBS` | - | `1` | 1=内联构建, 0=worker 队列 |
| `BUILD_WORKER_POLL_MS` | - | `2000` | Worker 轮询间隔(ms) |
| `BUILD_MAX_CONCURRENCY` | - | `2` | 最大并发构建数 |
| `RUNTIME_BASE_DIR` | - | `sites-data/_runtime_base` | 运行时基础目录 |
| `USE_SHARED_NODE_MODULES` | - | `0` | 共享 node_modules |
| `MAX_RETAINED_BUILDS` | - | `5` | 保留构建数 |
| `MAX_UPLOAD_BYTES` | - | `104857600` | 上传大小限制 |
| `MAX_KB_UPLOAD_BYTES` | - | `52428800` | KB 文件限制 |
| `MINERU_API_KEY` | - | - | MinerU PDF 解析 |
| `LOGIN_RL_IP_PER_MIN` | - | `10` | 登录限流/IP/分钟 |
| `LOGIN_RL_EMAIL_PER_MIN` | - | `5` | 登录限流/邮箱/分钟 |
| `BACKUP_INTERVAL_MS` | - | `3600000` | DB 自动备份间隔 |
| `BACKUP_RETAIN_COUNT` | - | `5` | 备份保留数量 |

> ⚡ `OPENROUTER_API_KEY` 和 `SILICONFLOW_API_KEY` 至少配置一个

## NPM 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm start` | 启动生产服务器 |
| `npm run worker` | 启动构建 Worker |

## 数据库

- SQLite 数据库位于 `data/app.db`
- 启动时自动执行迁移（`src/lib/db/index.ts`）
- 自动备份到 `data/app.db.bak.*`
- 主要数据表：`users`, `sites`, `site_builds`, `knowledge_bases`, `knowledge_files`, `edit_sessions`

## 相关文档

- [产品需求文档](./docs/PRD.md)
- [生产部署指南](./docs/deployment-production.md)
- [功能检查清单](./docs/feature-check.md)
- [数据库与用户管理](./docs/database-and-user-management.md)

## License

Private — All rights reserved.
