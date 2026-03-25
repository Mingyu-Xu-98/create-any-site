# CreateAnySite — 产品需求文档 (PRD)

> 版本 2.0 | 2026-03-24 | 架构重构版

---

## 1. 产品概述

### 1.1 定位

CreateAnySite 是一个 **AI 驱动的知识建站 SaaS 平台**。用户上传个人/企业数据源（简历、GitHub、文章等），AI 自动提取结构化知识，通过对话式交互编译出网站 Spec，最终生成高质量静态网站。

### 1.2 核心差异化

| | Squarespace/Wix | Framer | **CreateAnySite** |
|---|---|---|---|
| 输入 | 手动拖拽组件 | 设计稿导入 | **知识库自动抽取** |
| 智能程度 | 模板填空 | AI 辅助设计 | **AI 全链路（分析→设计→生成）** |
| 设计质量 | 模板化 | 高（手动） | **Skill 系统驱动** |
| 内容来源 | 手动输入 | 手动输入 | **多源自动提取** |

### 1.3 目标用户

**Phase 1（当前）**：个人开发者、设计师、自由职业者，需要快速搭建作品集/个人网站
**Phase 2**：小型企业、创业团队，需要品牌官网

### 1.4 核心价值

```
"从散乱数据到专业网站，你只需要一次对话"
```

---

## 2. 系统架构

### 2.1 三层架构

```
┌─────────────────────────────────────────────────────────┐
│                     用户交互层                            │
│  Landing / Dashboard / Create (Chat+Sources+KB) / Admin  │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│              Layer 1: 通用知识建模                        │
│                                                         │
│  数据源接入        AI 提取           知识存储              │
│  ┌─────────┐    ┌──────────┐    ┌──────────────┐        │
│  │PDF/ZIP  │───▶│ 分类标签  │───▶│KnowledgeItem │        │
│  │Git Repo │    │ 实体识别  │    │  7 categories│        │
│  │Bilibili │    │ 关联发现  │    │  tags, source│        │
│  │YouTube  │    └──────────┘    └──────────────┘        │
│  └─────────┘                                            │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│              Layer 2: Spec 编译                          │
│                                                         │
│  ┌──────────┐  ┌────────────┐  ┌──────────────────┐    │
│  │知识库选择 │  │ Skill 选择  │  │  Design System   │    │
│  │+ 用户意图 │─▶│ L0→L1→L2  │─▶│  BM25 查询       │    │
│  └──────────┘  └────────────┘  └──────────────────┘    │
│                       │                                  │
│                       ▼                                  │
│              ┌─────────────────┐                        │
│              │    SiteSpec     │                         │
│              │  product       │                         │
│              │  identity      │                         │
│              │  sections[]    │                         │
│              │  designSystem  │                         │
│              │  skillPlan     │                         │
│              │  meta.gaps     │                         │
│              └─────────────────┘                        │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│              Layer 3: 代码生成                            │
│                                                         │
│  SiteSpec ──▶ 逐 Section 生成 ──▶ Skill 打磨 ──▶ 静态导出│
│              (注入 Skill 指导)     (polish/audit)  (HTML) │
└─────────────────────────────────────────────────────────┘
```

### 2.2 技术栈

| 层 | 技术 | 理由 |
|---|---|---|
| 前端 | Next.js 16 + React 19 + Tailwind 4 | App Router, 服务端能力 |
| 后端 | Next.js API Routes | 全栈统一，部署简单 |
| 数据库 | SQLite (Drizzle ORM) → PostgreSQL | 开发快，SaaS 阶段迁移 |
| AI | SiliconFlow → **抽象 Provider** | 支持 Claude/GPT/GLM 切换 |
| 认证 | NextAuth v5 | 支持 Credentials + OAuth |
| PDF解析 | MinerU API | 高质量 OCR |
| 设计系统 | ui-skill BM25 引擎 | 50 色板 + 45 字体 + 36 布局模式 |

### 2.3 AI Provider 抽象

```typescript
interface AIProvider {
  id: string;
  name: string;
  chat(params: {
    model: string;
    messages: Message[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<{ content: string; usage: TokenUsage }>;
}

// 实现
class SiliconFlowProvider implements AIProvider { ... }
class AnthropicProvider implements AIProvider { ... }
class OpenAIProvider implements AIProvider { ... }

// 配置
const provider = createProvider(process.env.AI_PROVIDER || "siliconflow");
```

---

## 3. 核心流程

### 3.1 用户旅程

```
注册/登录
    │
    ▼
仪表盘（我的网站列表）
    │
    ├── 新建网站 ──▶ Create 页面
    │                  │
    │                  ├── 1. 添加数据源（PDF/ZIP/URL）
    │                  │      └── AI 提取 → 待审核 → 保存到知识库
    │                  │
    │                  ├── 2. 整理知识库（选择/编辑/删除）
    │                  │
    │                  ├── 3. 对话构建
    │                  │      ├── AI 推荐类型/风格
    │                  │      ├── AI 推荐 Skill（渐进披露）
    │                  │      └── 用户确认 → 编译 Spec
    │                  │
    │                  ├── 4. Spec 确认
    │                  │      ├── 查看 Spec（可编辑）
    │                  │      └── 查看 gaps（缺失信息）
    │                  │
    │                  └── 5. 生成 & 预览
    │                         ├── 实时预览
    │                         ├── 对话迭代
    │                         └── 导出静态 HTML
    │
    └── 继续编辑 ──▶ 恢复对话上下文
```

### 3.2 知识建模流程

```
数据源                    AI 提取                    存储
─────────                ─────────                  ──────
PDF 文件  ──┐            ┌─ factual (事实)          knowledge_items
ZIP 压缩包 ─┤  解析文本  │  skills (技能)           ┌─ id
Git 仓库   ─┤ ────────▶ ├─ experience (经历)  ───▶ ├─ category
Bilibili   ─┤  AI 分析  │  relational (关联)       ├─ title
YouTube    ─┘            ├─ media (媒体)            ├─ content
                         │  opinion (观点)          ├─ sourceId
                         └─ meta (元信息)           ├─ tags[]
                                                    └─ selected
```

### 3.3 Spec 编译流程

```
Phase 1: 需求理解
  输入: 用户对话历史
  输出: siteType, 目标受众, 核心目的

Phase 2: 知识抽取
  输入: KnowledgeItem[] (选中的)
  输出: identity, sections[], 每个字段标注 source

Phase 3: Skill 选择 (渐进式)
  ① 读 Level 0 (所有 skill 描述, ~50字/个)
  ② 选择相关 skill
  ③ 加载 Level 1 (选中 skill 的 indexContent)
  ④ 按需加载 Level 2 (深度参考)

Phase 4: 设计系统
  输入: 用户风格偏好 + BM25 查询
  输出: colors, typography, spacing, effects

Phase 5: 组装 Spec JSON
```

### 3.4 Skill 渐进式调用时序

```
Chat-Build API 调用:
  ┌──────────────────────────────────────────────┐
  │ System Prompt 中注入:                         │
  │   - 知识库摘要 (≤30K chars)                   │
  │   - 所有 Skill 描述 (Level 0)                 │
  │   - 已激活 Skill 的 indexContent (Level 1)     │
  └──────────────────────────────────────────────┘
           │
           ▼
  AI 响应:
  ┌─────────────────────────────┐
  │ 文本回复 + action JSON:      │
  │                             │
  │ activate_skills →           │
  │   前端记住 skillIds         │
  │   下一轮传入 loadedSkills    │
  │   后端加载 indexContent      │
  │                             │
  │ generate →                  │
  │   携带 skillIds             │
  │   触发 compile-spec         │
  │   进入生成流程               │
  └─────────────────────────────┘
```

---

## 4. 数据模型

### 4.1 ER 图

```
users ──────┬──── sites
  │         │      │
  │         │      └──── conversations
  │         │
  │         └──── knowledge_items
  │
  └──────── accounts
  └──────── sessions

skills (独立，不关联用户)
templates (独立)
```

### 4.2 表结构

#### users
| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | UUID |
| email | TEXT UNIQUE | 登录邮箱 |
| password | TEXT | bcrypt hash |
| name | TEXT | 显示名 |
| role | TEXT | "user" / "admin" |
| createdAt | TEXT | ISO datetime |

#### knowledge_items
| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | UUID |
| userId | TEXT FK→users | 所属用户 |
| sourceId | TEXT | 来源标识 |
| sourceName | TEXT | 来源显示名 |
| sourceType | TEXT | pdf/zip/git/bilibili/youtube |
| category | TEXT | 7 类之一 |
| title | TEXT | 知识标题 |
| content | TEXT | 知识内容 |
| tags | TEXT (JSON) | 标签数组 |
| selected | INTEGER | 是否选中用于构建 |

#### sites
| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | UUID |
| userId | TEXT FK→users | |
| slug | TEXT UNIQUE | URL slug |
| name | TEXT | 网站名 |
| siteType | TEXT | portfolio/brand/blog/landing |
| theme | TEXT | 18 种主题之一 |
| layout | TEXT | 布局类型 |
| workspaceData | TEXT (JSON) | 旧版数据（待废弃） |
| selections | TEXT (JSON) | 用户选择 |
| fileMap | TEXT (JSON) | 生成的文件映射 |
| status | TEXT | draft/published/archived |
| previewUrl | TEXT | 预览地址 |

#### skills (渐进式三层)
| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | UUID |
| name | TEXT | 技能名称 |
| description | TEXT | **Level 0**: 触发描述 (~50字) |
| category | TEXT | design/content/layout/interaction/seo/other |
| indexContent | TEXT | **Level 1**: 完整指令 (index.md) |
| references | TEXT (JSON) | **Level 2**: [{name, content}] |
| siteTypes | TEXT (JSON) | 适用网站类型 |
| enabled | INTEGER | 是否启用 |

#### conversations
| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | UUID |
| userId | TEXT FK→users | |
| siteId | TEXT FK→sites | 关联网站 |
| messages | TEXT (JSON) | [{role, content}] |
| previewUrl | TEXT | 最新预览 |

### 4.3 SiteSpec JSON Schema

```typescript
interface SiteSpec {
  version: string;               // "1.0"
  compiledAt: string;            // ISO datetime

  product: {
    siteType: string;            // portfolio | brand | blog | landing
    purpose: string;             // 一句话核心目的
    targetAudience: string;
    locale: { primary: string; secondary?: string };
    tone: string[];              // ["professional", "creative"]
  };

  identity: {
    name: SourcedValue<string>;
    nameEn?: SourcedValue<string>;
    title: SourcedValue<string>;
    tagline: SourcedValue<string>;
    bio: SourcedValue<string>;
    avatar: SourcedValue<string | null>;
    contact: {
      email: SourcedValue<string>;
      github?: SourcedValue<string>;
      linkedin?: SourcedValue<string>;
    };
  };

  sections: SectionSpec[];        // 有序的页面模块列表

  designSystem: {
    theme: string;
    colors: Record<string, string>;    // 完整语义色板
    typography: { heading: string; body: string; cssImport: string };
    spacing: { unit: string; scale: number[] };
    components: { borderRadius: string; shadow: string };
    effects: string;
    antiPatterns: string[];
  };

  motion: { enabled: boolean; philosophy: string; details: string };
  responsive: { strategy: string; breakpoints: Record<string, string> };
  features: { i18n: boolean; chatbot: boolean; seo: object };
  techStack: { framework: string; styling: string; deployment: string };

  skillPlan: {
    activated: SkillInvocation[];    // generate 阶段执行
    postBuild: SkillInvocation[];    // 生成后打磨
  };

  meta: {
    knowledgeItemsUsed: number;
    coverage: number;                // 0-1
    gaps: Gap[];                     // 缺失信息
    suggestions: string[];           // AI 建议
  };
}

interface SourcedValue<T> {
  value: T;
  source: "knowledge" | "inferred" | "missing";
}

interface SectionSpec {
  id: string;
  type: "hero" | "about" | "projects" | "skills" | "timeline" | "education" | "contact" | "blog" | "gallery";
  enabled: boolean;
  priority: number;
  data: Record<string, unknown>;
  sourceEntities: string[];          // knowledge item IDs
}

interface SkillInvocation {
  skillId: string;
  skillName: string;
  phase: "generate" | "refine";
  reason: string;
  appliedTo: string | string[];
}

interface Gap {
  field: string;
  severity: "high" | "medium" | "low";
  suggestion: string;
}
```

---

## 5. 页面与交互设计

### 5.1 页面清单

| 路径 | 页面 | 认证 |
|---|---|---|
| `/` | Landing 首页 | 否 |
| `/login` | 登录 | 否 |
| `/register` | 注册 | 否 |
| `/dashboard` | 我的网站 | 是 |
| `/create` | 创建/编辑 (核心) | 是 |
| `/templates` | 模板浏览 | 否 |
| `/admin` | 管理后台 | admin |
| `/admin/skills` | Skill 管理 | admin |
| `/admin/templates` | 模板管理 | admin |
| `/admin/users` | 用户管理 | admin |

### 5.2 Create 页面核心布局

```
┌──────────────────────────────────────────────────────┐
│ Navbar (fixed, h-14, backdrop-blur)                  │
├──────┬───────────────────────┬───┬───────────────────┤
│      │                       │   │                   │
│  S   │     Chat / Sources    │ D │    Preview        │
│  i   │     / Knowledge       │ i │    (iframe)       │
│  d   │                       │ v │                   │
│  e   │  (由 sidebar nav      │ i │  Browser chrome   │
│  b   │   切换三个视图)        │ d │  + mock content   │
│  a   │                       │ e │                   │
│  r   │                       │ r │                   │
│      ├───────────────────────┤   ├───────────────────┤
│ w-56 │ Input bar             │w-1│                   │
│ /w-14│ (border-t)            │   │                   │
└──────┴───────────────────────┴───┴───────────────────┘
```

### 5.3 状态机

**生成状态**:
```
idle ──(用户确认)──▶ generating ──(成功)──▶ ready
                         │                    │
                         └──(失败)──▶ idle    └──(重新生成)──▶ generating
```

**Skill 激活状态**:
```
未加载 ──(AI 推荐)──▶ activate_skills action
                          │
                          ▼
前端记录 loadedSkillIds ──(下次请求)──▶ 后端加载 Level 1
                                            │
                                            ▼
                                   System Prompt 中注入
```

---

## 6. API 设计

### 6.1 完整 API 清单

| Method | Path | 说明 | 认证 |
|---|---|---|---|
| POST | `/api/auth/register` | 注册 | 否 |
| POST | `/api/auth/[...nextauth]` | NextAuth | 否 |
| GET | `/api/knowledge` | 列出知识项 | user |
| POST | `/api/knowledge` | 批量创建 | user |
| PUT | `/api/knowledge/[id]` | 更新 | user |
| DELETE | `/api/knowledge/[id]` | 删除 | user |
| DELETE | `/api/knowledge?sourceId=X` | 按源删除 | user |
| POST | `/api/analyze-source` | 分析数据源 | user |
| POST | `/api/chat-build` | 对话构建 | user |
| POST | `/api/compile-spec` | 编译 Spec | user |
| POST | `/api/generate` | 生成网站 | user |
| POST | `/api/design-system` | 查询设计系统 | user |
| GET | `/api/skills?level=0\|1\|2` | 渐进加载 Skill | user |
| GET/POST | `/api/sites` | 网站 CRUD | user |
| GET/PUT/DELETE | `/api/sites/[id]` | | user |
| GET/POST | `/api/conversations` | 对话 CRUD | user |
| GET/PUT/DELETE | `/api/conversations/[id]` | | user |
| GET/POST | `/api/admin/skills` | Skill 管理 | admin |
| POST | `/api/admin/skills/upload` | 上传 Skill 包 | admin |
| GET/PUT/DELETE | `/api/admin/skills/[id]` | | admin |

### 6.2 关键 API 详情

#### POST /api/chat-build

```json
// Request
{
  "messages": [{"role": "user", "content": "帮我搭建一个极简风格的个人网站"}],
  "knowledge": [/* KnowledgeItem[] */],
  "currentSelections": {},
  "loadedSkills": ["skill-id-1"]   // 已激活的 skill IDs
}

// Response
{
  "content": "AI 回复文本...",
  "action": {
    "type": "activate_skills",    // 或 "generate"
    "skillIds": ["skill-id-2"],
    "reason": "..."
  }
}
```

#### POST /api/compile-spec

```json
// Request
{
  "knowledge": [/* 选中的 KnowledgeItem[] */],
  "intent": {
    "siteType": "portfolio",
    "theme": "minimalist",
    "layout": "f-shape",
    "conversationSummary": "用户想要极简风格个人网站..."
  },
  "skillIds": ["skill-1", "skill-2"]
}

// Response
{
  "spec": { /* SiteSpec JSON */ }
}
```

#### GET /api/skills (渐进式)

```
Level 0: GET /api/skills
  → { skills: [{ id, name, description, category }] }

Level 1: GET /api/skills?level=1&ids=id1,id2
  → { skills: [{ id, name, indexContent, hasReferences }] }

Level 2: GET /api/skills?level=2&ids=id1
  → { skills: [{ id, name, indexContent, references: [{name, content}] }] }
```

---

## 7. Skill 系统

### 7.1 Skill 包结构

```
my-skill.zip
├── index.md          # 主指令 → Level 1 (indexContent)
├── reference/
│   ├── colors.md     # 参考文档 → Level 2 (references)
│   └── patterns.md
```

### 7.2 上传解析流程

```
上传 ZIP/MD → 解析文件结构
  ├── index.md / SKILL.md → indexContent
  └── 其他 .md 文件 → references[]
        │
        ▼
  AI 读 indexContent → 自动生成:
  ├── name (人类可读名称)
  ├── description (触发条件, ~50字)
  ├── category (design/content/layout/...)
  └── siteTypes (适用类型)
        │
        ▼
  存入 skills 表 (enabled=1)
```

### 7.3 内置 Skill 清单 (20 个)

**内容分析类** (Phase 2 调用):
| Skill | 触发条件 |
|---|---|
| extract | 知识库内容丰富但结构松散 |
| distill | 知识条目过多需要精简 |
| clarify | 内容表述不清有歧义 |

**设计决策类** (Phase 4 调用):
| Skill | 触发条件 |
|---|---|
| frontend-design | **每次都调用** |
| colorize | 需要确定色彩方案 |
| typeset | 需要确定字体方案 |
| arrange | 4+ section 需要编排 |
| critique | Spec 初版完成后自检 |

**构建指导类** (写入 Spec):
| Skill | 触发条件 |
|---|---|
| animate | 用户开启动画 |
| adapt | 需要响应式 |
| harden | 企业站需要健壮性 |
| optimize | 性能敏感 |
| onboard | 复杂首次体验 |
| delight | 要求有趣 |
| bolder | 设计太保守 |
| quieter | 设计太激进 |

**生成后打磨类** (postBuild):
| Skill | 触发条件 |
|---|---|
| polish | **每次都标记** |
| audit | 企业/品牌站 |
| normalize | 有自定义设计系统 |

---

## 8. 改造计划

### Phase 1: Spec 层引入 ✅ (已完成)
- [x] 定义 SiteSpec JSON Schema
- [x] 创建 compile-spec.md 编排文档
- [x] 实现 `/api/compile-spec` 端点
- [x] DB schema 改造 (skills 表三层字段)
- [x] `/api/skills` 渐进式加载端点
- [ ] 前端 Create 页面接入 compile-spec
- [ ] 替代 `buildWorkspaceDataFromKnowledge()`

### Phase 2: 生成器重构
- [ ] 生成器接受 SiteSpec (不再是 WorkspaceData)
- [ ] 按 section 生成，注入 skill context
- [ ] AI 驱动代码生成（替代硬编码模板）
- [ ] skillPlan.activated 的 skill 注入到生成 prompt
- [ ] skillPlan.postBuild 的 skill 最后执行

### Phase 3: 静态导出
- [ ] 替代 dev server 预览为静态 HTML 导出
- [ ] 生成独立的 `index.html` + assets
- [ ] 支持下载 ZIP
- [ ] 预览用 iframe srcdoc 或 blob URL

### Phase 4: AI Provider 抽象
- [ ] 定义 AIProvider 接口
- [ ] 实现 SiliconFlow/Anthropic/OpenAI provider
- [ ] 环境变量配置切换
- [ ] 每个 API route 使用抽象 provider

### Phase 5: 知识图谱增强
- [ ] KnowledgeEntity 实体识别
- [ ] KnowledgeRelation 关系映射
- [ ] 多源同一实体自动合并
- [ ] 知识成熟度标记 (confidence)

### 依赖关系

```
Phase 1 ──▶ Phase 2 ──▶ Phase 3
                │
Phase 4 (独立)  │
                ▼
            Phase 5 (独立)
```

---

## 9. 非功能需求

### 9.1 性能
- 知识提取: < 30s / 源
- Spec 编译: < 15s
- 网站生成: < 60s
- Token 预算: chat-build ≤ 40K tokens/请求，compile-spec ≤ 60K tokens/请求

### 9.2 安全
- API Key 仅存服务端 `.env.local`
- 用户密码 bcrypt hash
- 用户数据按 userId 隔离
- Admin 操作需 role="admin"

### 9.3 可扩展性
- SQLite → PostgreSQL: Drizzle ORM 迁移（改 driver 即可）
- 单机 → 多实例: 静态导出后无需 dev server 进程

### 9.4 国际化
- UI: 中文为主，英文切换 (LocaleProvider)
- 生成网站: 支持中英双语 (i18n 模块)
- 知识提取: AI prompt 支持中英文源

---

*文档结束。最后更新: 2026-03-24*
