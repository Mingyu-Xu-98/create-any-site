# CreateAnySite — 产品需求文档

## 1. 项目概述

**CreateAnySite** 是一个 AI 驱动的建站平台，用户上传内容（PDF/DOCX/TXT/MD/ZIP/Git/视频链接），AI 分析并提取结构化知识，通过对话式交互生成 PRD，按 PRD 构建完整网站，支持增量修改和静态导出部署。

### 核心定位
- **目标用户**：需要快速搭建个人/品牌网站的非技术用户和开发者
- **核心价值**：从"上传内容"到"网站上线"全流程 AI 自动化
- **技术框架**：Next.js 16 + React 19 + Tailwind CSS 4 + SQLite + SiliconFlow AI

---

## 2. 技术架构

### 2.1 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| **前端** | Next.js 16 + React 19 | SSR/SSG 页面渲染 |
| **样式** | Tailwind CSS 4 | 原子化 CSS |
| **认证** | NextAuth 5 (JWT) | 邮箱密码登录 |
| **数据库** | SQLite + Drizzle ORM | 用户/站点/知识/对话持久化 |
| **AI 模型** | SiliconFlow (GLM-5) | 知识提取/对话构建/PRD 生成 |
| **PDF 解析** | MinerU API | 专业 PDF 文档解析 |
| **DOCX 解析** | mammoth | Word 文档文本提取 |
| **Markdown** | react-markdown + remark-gfm | PRD 渲染 |
| **文件处理** | JSZip | ZIP 解压逐文件解析 |
| **ID 生成** | nanoid + crypto.randomUUID | 短链接/数据库主键 |

### 2.2 架构图

```
┌─────────────────────────────────────────────┐
│                 前端 (Next.js)               │
│  Landing | Login | Create | Dashboard | Admin│
├─────────────────────────────────────────────┤
│              API Routes (27个)               │
│  auth | sites | knowledge | conversations   │
│  chat-build | generate | modify | analyze   │
├─────────┬───────────┬───────────────────────┤
│ SQLite  │ SiliconFlow│     MinerU API       │
│ (本地DB) │  (AI模型)  │   (PDF解析)          │
├─────────┴───────────┴───────────────────────┤
│           sites-data/{siteId}/              │
│       生成的网站文件 + 静态导出 (out/)        │
└─────────────────────────────────────────────┘
```

---

## 3. 数据库设计

### 3.1 表关系图

```
users ─┬── sites ──── conversations
       ├── knowledgeGroups ── knowledgeItems
       ├── accounts (OAuth, 预留)
       └── sessions (JWT)

skills (独立，admin管理)
templates (独立，admin管理)
```

### 3.2 表结构

#### users（用户表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| name | TEXT | 用户名 |
| email | TEXT UNIQUE | 邮箱 |
| password | TEXT | bcrypt 哈希 |
| role | TEXT | user / admin |
| image | TEXT | 头像 URL |
| created_at | TEXT | ISO 时间戳 |

#### sites（站点表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| user_id | TEXT FK→users | 所有者 |
| slug | TEXT UNIQUE | 短链接（nanoid 10位） |
| name | TEXT | 站点名称 |
| site_type | TEXT | portfolio/brand/blog/landing/custom |
| theme | TEXT | 视觉主题 |
| layout | TEXT | 布局类型 |
| workspace_data | TEXT | 结构化内容数据 (JSON) |
| selections | TEXT | 用户选择配置 (JSON) |
| file_map | TEXT | 生成的代码文件 (JSON: {path→content}) |
| status | TEXT | draft/published/archived |
| preview_url | TEXT | 预览地址 |
| prd | TEXT | 当前 PRD 文档 (JSON) |
| prd_history | TEXT | PRD 版本历史 (JSON[]) |
| created_at | TEXT | 创建时间 |

#### knowledge_groups（知识组/文件夹）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| user_id | TEXT FK→users | 所有者 |
| name | TEXT | 知识组名（如"我的简历"） |
| description | TEXT | AI 生成的描述 |
| index_md | TEXT | AI 索引文件（模型调用时参考） |
| tags | TEXT | 标签数组 (JSON) |
| source_file | TEXT | 原始文件名 |
| source_type | TEXT | pdf/zip/docx/txt/md |

#### knowledge_items（知识条目）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| user_id | TEXT FK→users | 所有者 |
| group_id | TEXT FK→knowledge_groups | 所属知识组 |
| category | TEXT | factual/skills/experience/relational/media/opinion/meta |
| title | TEXT | 知识标题 |
| content | TEXT | 知识内容 |
| tags | TEXT | 标签 (JSON) |
| selected | INTEGER | 是否用于构建（1/0） |

#### conversations（对话记录）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| user_id | TEXT FK→users | 所有者 |
| site_id | TEXT FK→sites | 关联站点（可空） |
| title | TEXT | 对话标题（首条消息截取） |
| messages | TEXT | 消息数组 (JSON: [{role,content}]) |
| preview_url | TEXT | 关联的预览地址 |

#### skills（AI 技能）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| name | TEXT | 技能名称 |
| description | TEXT | 触发条件描述（~50字） |
| category | TEXT | design/content/layout/interaction/seo/other |
| index_content | TEXT | 完整 index.md（如何应用） |
| references | TEXT | 参考文档 (JSON[{name,content}]) |
| enabled | INTEGER | 是否启用 |

#### templates（网站模板）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| name | TEXT | 模板名称 |
| category | TEXT | starter/professional/creative |
| site_type | TEXT | 适用站点类型 |
| theme / layout | TEXT | 默认主题和布局 |
| file_map | TEXT | 模板代码 (JSON) |
| preview_image | TEXT | 预览截图 URL |
| featured | INTEGER | 是否推荐 |

---

## 4. API 设计

### 4.1 认证 API
| 方法 | 路径 | 功能 |
|------|------|------|
| POST | /api/auth/[...nextauth] | NextAuth 处理器 |
| POST | /api/auth/register | 邮箱密码注册 |

### 4.2 站点 API
| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /api/sites | 列出用户站点（含 conversationId） |
| POST | /api/sites | 创建站点 |
| GET | /api/sites/[id] | 获取站点详情 |
| PUT | /api/sites/[id] | 更新站点（fileMap/PRD/状态） |
| DELETE | /api/sites/[id] | 删除站点 |

### 4.3 知识库 API
| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /api/knowledge-groups | 列出知识组（含条目统计） |
| POST | /api/knowledge-groups | 创建知识组 + 批量插入条目 |
| GET | /api/knowledge-groups/[id] | 获取组详情 + 所有条目 |
| PUT | /api/knowledge-groups/[id] | 更新组信息 |
| DELETE | /api/knowledge-groups/[id] | 删除组（CASCADE 条目） |
| GET | /api/knowledge | 列出用户所有知识条目 |
| POST | /api/knowledge | 批量创建条目 |
| PUT | /api/knowledge/[id] | 更新单条（标题/内容/selected） |
| DELETE | /api/knowledge/[id] | 删除单条 |

### 4.4 AI 构建 API
| 方法 | 路径 | 功能 |
|------|------|------|
| POST | /api/analyze-source | 解析文件（PDF/DOCX/ZIP/TXT/MD/URL）→ 知识提取 |
| POST | /api/chat-build | 对话式构建（含 PRD 生成/选项卡/技能调用） |
| POST | /api/generate | 生成网站代码 → 静态导出 → HTTP 服务器 |
| POST | /api/modify | 增量修改代码文件 → 重新静态导出 |
| POST | /api/design-system | 查询 BM25 设计系统引擎 |

### 4.5 对话 API
| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /api/conversations | 列出对话记录 |
| POST | /api/conversations | 创建对话 |
| GET | /api/conversations/[id] | 获取对话详情 |
| PUT | /api/conversations/[id] | 更新对话（消息/关联站点） |
| DELETE | /api/conversations/[id] | 删除对话 |

### 4.6 管理 API（需 admin 权限）
| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /api/admin/stats | 统计数据 |
| GET | /api/admin/users | 用户列表 |
| CRUD | /api/admin/skills | 技能管理 |
| POST | /api/admin/skills/upload | 上传技能包 |
| CRUD | /api/admin/templates | 模板管理 |

---

## 5. 核心流程

### 5.1 PRD 驱动的建站流程

```
用户发起对话
    ↓
Phase 1: AI 提问（选项卡形式，3-5个问题）
    ├── 网站目标（单选）
    ├── 目标受众（单选）
    ├── 视觉风格（单选）
    ├── 核心功能（多选 + 自定义）
    └── 知识库选择
    ↓
Phase 2: AI 生成 PRD 文档
    ├── Markdown 渲染预览
    ├── 用户可编辑 PRD
    └── 确认构建按钮
    ↓
Phase 3: 代码生成
    ├── 文件生成（page.tsx/globals.css/translations.ts 等）
    ├── 静态导出（next build → out/）
    ├── HTTP 预览服务器
    └── 自动保存到 DB（fileMap + PRD）
    ↓
Phase 4: 增量修改
    ├── 对话中描述修改需求
    ├── AI 读取当前代码（渐进式加载）
    ├── 输出 modify action（文件级别替换/创建/删除）
    └── 重新静态导出
```

### 5.2 知识库流程

```
上传文件（PDF/DOCX/TXT/MD/ZIP）
    ↓
文件解析
    ├── PDF → MinerU API（OCR + 表格 + 公式）
    ├── DOCX → mammoth（纯文本提取）
    ├── TXT/MD → 直接读取
    └── ZIP → 逐文件解析（每个文件独立处理）
    ↓
AI 知识提取（GLM-5 模型）
    ├── 输出 Markdown 格式
    ├── 按类别归类（factual/skills/experience/...）
    └── 打标签
    ↓
用户预览 & 编辑
    ├── 勾选要保留的知识
    └── 编辑标题/内容
    ↓
保存到知识组
    ├── 创建 knowledge_group
    ├── 批量插入 knowledge_items
    └── 自动生成 index.md
```

### 5.3 渐进式技能调用

```
Level 0（始终加载）: 所有技能的 description（~50字触发条件）
    ↓ AI 判断相关性
Level 1（按需加载）: 相关技能的 index_content（完整指导文档）
    ↓ AI 需要深度参考
Level 2（按需加载）: references（参考文档数组）
```

### 5.4 代码修改流程

```
用户在对话中说"把主色改成红色"
    ↓
chat-build API:
    ├── 从 DB 加载当前 fileMap
    ├── 注入关键源文件到 system prompt
    │   └── page.tsx / globals.css / layout.tsx / translations.ts
    └── AI 输出 modify action
        ├── {file: "src/app/globals.css", action: "replace", content: "..."}
        └── 只修改需要变的文件
    ↓
modify API:
    ├── 增量写入文件到 sites-data/{siteId}/
    ├── 更新 DB 中的 fileMap
    └── 重新 next build → 静态导出
    ↓
前端 iframe 刷新
```

---

## 6. 前端页面

### 6.1 页面清单

| 路由 | 功能 | 认证 |
|------|------|------|
| / | 首页（Landing Page） | 无 |
| /login | 登录 | 无 |
| /register | 注册 | 无 |
| /templates | 模板画廊 | 无 |
| /create | 构建工作台（核心） | 需登录 |
| /dashboard | 我的网站 | 需登录 |
| /admin | 管理后台 | 需 admin |
| /admin/users | 用户管理 | 需 admin |
| /admin/skills/* | 技能管理 | 需 admin |
| /admin/templates/* | 模板管理 | 需 admin |

### 6.2 构建工作台（/create）

三个视图通过左侧图标菜单切换：

**构建视图**（默认）
- 左侧：对话框（选项卡消息 + PRD 确认按钮 + 工作状态提示）
- 右侧：预览面板（Tab: 网页预览 | PRD 文档）
- 可拖拽分割线调整比例
- 知识库选择器（顶部下拉菜单）

**数据源视图**
- 拖拽上传区域（支持 PDF/DOCX/TXT/MD/ZIP）
- URL 输入（Git/Bilibili/YouTube）
- 解析进度展示
- 解析结果预览 + 逐条勾选 + 保存到知识组

**知识库视图**
- 第一级：知识组列表（文件夹卡片）
- 第二级：点击进入 → 知识条目详情（可编辑）
- 组级全选/删除
- 搜索过滤

---

## 7. 国际化 (i18n)

- 默认中文，顶部可切换英文
- 语言选择保存到 localStorage
- 覆盖范围：导航栏、登录/注册、首页、工作台、管理后台
- 翻译存储在 `src/lib/i18n.ts`（100+ 条翻译项）

---

## 8. 安全机制

| 层面 | 机制 |
|------|------|
| 认证 | JWT session + bcrypt 密码哈希 |
| 授权 | `requireAdmin()` 检查 role 字段 |
| CSRF | NextAuth 内置 CSRF 保护 |
| 路径安全 | 静态服务器防止目录遍历 |
| 文件大小 | 10MB body size limit |
| DB 并发 | SQLite WAL 模式 + busy_timeout 5s |

---

## 9. 日志系统

- 位置：`data/logs/analyze-YYYY-MM-DD.log`
- 格式：JSON per line（time, level, module, message, data）
- 覆盖模块：handler, mineru, ai, zip, git, bilibili, youtube, generate, chat-build, modify, skill-upload
- 级别：INFO / WARN / ERROR

---

## 10. 部署架构

### 本地开发
```
主应用: localhost:3003 (Next.js dev)
预览服务: localhost:3002 (静态 HTTP 服务器)
数据库: data/app.db (SQLite)
生成站点: sites-data/{siteId}/out/ (静态 HTML)
```

### 生产部署（规划）
```
DNS: *.createanysite.com → 服务器 IP（通配符 A 记录）
Nginx: 按 Host 头路由子域名 → sites-data/{slug}/out/
SSL: Let's Encrypt 通配符证书
CDN: Cloudflare（可选）
```

---

## 11. 已知问题 & 规划

### 当前问题
- [ ] 静态导出偶发 Turbopack 兼容性问题
- [ ] AI 模型有时不遵循 PRD 生成规则（需要前端 safeguard）
- [ ] 共享 node_modules 版本管理
- [ ] 图片生成 API 已禁用（SiliconFlow model disabled）

### Phase 2 规划
- [ ] 子域名托管（*.createanysite.com）
- [ ] 自定义域名绑定
- [ ] OAuth 登录（GitHub/Google）
- [ ] 网页爬取数据源
- [ ] 视频字幕提取（Bilibili/YouTube）
- [ ] 解析后交互式提问（AI 引导知识整理）
- [ ] 模板市场（完整网站模板管理）
