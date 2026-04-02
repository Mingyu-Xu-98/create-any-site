# 统一知识系统设计方案

> 版本: v1.0 | 日期: 2026-04-02 | 状态: 设计阶段

## 目录

- [1. 背景与问题](#1-背景与问题)
- [2. 设计目标](#2-设计目标)
- [3. 数据模型](#3-数据模型)
- [4. 知识处理流程](#4-知识处理流程)
- [5. 实体关联系统](#5-实体关联系统)
- [6. 构建管线消费](#6-构建管线消费)
- [7. 前端设计](#7-前端设计)
- [8. 迁移策略](#8-迁移策略)
- [9. 成本分析](#9-成本分析)

---

## 1. 背景与问题

### 1.1 现状：两套并行的知识系统

项目中存在两套独立的知识系统，分别服务不同场景但职责重叠：

| | Legacy 系统 | KB 系统（新） |
|---|---|---|
| **存储** | `knowledgeGroups` + `knowledgeItems` | `knowledgeBases` + `knowledgeFiles` |
| **粒度** | AI 提取的细粒度知识条目（MECE 拆分） | 原始文件 + 轻量描述 |
| **AI 开销** | 重（~8K tokens/文件，完整 MECE 提取） | 轻（~200 tokens/文件，仅描述+关键词） |
| **上传入口** | `/api/ingestion` → `ingestion-worker` | `/api/kb/[baseId]/files` |
| **消费者** | `knowledge-router.ts` → 按 section 路由 | `kb-loader.ts` → 构建时按需加载原文 |

### 1.2 核心痛点

**用户层面：**
- 两个上传入口（ingestion vs KB upload），同一份文件走哪条路不清楚
- 知识库管理页面分为两个区域（KB 列表 + Legacy Groups），体验割裂

**数据层面：**
- 同一用户的知识分散在两张表体系，消费者要分别加载合并
- Legacy 的 MECE 拆分会丢失上下文，碎片化严重
- KB 文件没有 section 路由能力，compile-spec 只看 Legacy items

**关联层面：**
- 现有知识图谱关系建在 MECE 碎片之间，不在有意义的实体之间
- 只支持单文件内关联，跨文件关联缺失（最有价值的部分）
- 关系通过 title 模糊匹配存储，不可靠
- `content-model-utils.ts` 中的关系增强代码（`resolveRelations`、`enrichModelWithRelations`）已写好但**从未被调用**
- 知识图谱在生成管线中零消费，仅用于前端可视化展示

**构建管线层面：**
- `chat-build`、`build-runtime` 中各自写合并逻辑，字符预算各管各
- `compile-spec` 不感知 KB 系统
- knowledge.json 是两套系统唯一真正合流的地方，但也是简单拼接

### 1.3 方案选择

经过评估三个方案后，选择 **方案 A：KB 为主体 + 实体关联增强**：

| 方案 | 思路 | 结论 |
|------|------|------|
| A: KB + 按需增强 | KB 作为唯一存储层，实体关联作为可选增强 | **选择** — 改动最小、保留原文优势 |
| B: KB + 虚拟 Chunks | KB 存原文，上层维护条目视图 | 放弃 — 多一层抽象、提取成本仍在 |
| C: 全交 Agent | 只保留原文，取消所有预处理 | 放弃 — token 消耗高、大文件难传 |

---

## 2. 设计目标

### 2.1 核心原则

1. **单一数据源** — KB 系统（`knowledgeBases` + `knowledgeFiles`）作为唯一存储层
2. **原文不拆碎** — 保留文件完整性，不做 MECE 拆分
3. **实体做连接** — 通过跨文件实体对齐建立有意义的关联
4. **关系给上下文** — 构建时 Agent 拿到关系图，知道哪些文件该一起看
5. **轻量 AI** — 每文件 ~1.2K tokens（vs 现在 ~8K tokens），降低 85%

### 2.2 预期效果

- 用户只有一个知识上传入口
- 跨文件信息自动关联（简历 + 项目文档 + 博客 = 完整项目视图）
- 生成的网站自动携带正确的技能标签、项目关联、时间线
- Chatbot 能回答跨文件的关系问题

---

## 3. 数据模型

### 3.1 保留并扩展的表

#### `knowledgeBases`（不变）

```sql
-- 文件夹级组织，不变
knowledge_bases (
  id, userId, name, description,
  indexMd,      -- 自动生成的文件索引（给 AI 看）
  fileCount, totalChars,
  createdAt, updatedAt
)
```

#### `knowledgeFiles`（新增字段）

```sql
knowledge_files (
  -- 已有字段
  id, baseId, userId, name, type,
  description, keywords, originalUrl,
  contentLength, content,
  mimeType, assetPath, createdAt,

  -- 新增字段
  sectionMapping  TEXT,         -- JSON: ["hero","projects","skills"]
                                -- 该文件适合放在网站哪些 section
  entityIds       TEXT,         -- JSON: ["entity_uuid_1","entity_uuid_2"]
                                -- 该文件涉及哪些实体
  enrichedAt      TEXT,         -- ISO 时间戳, null=未增强
  enrichVersion   INTEGER DEFAULT 0  -- 增强版本号, prompt 变化时可重跑
)
```

### 3.2 新增表

#### `knowledgeEntities` — 跨文件实体

```sql
CREATE TABLE knowledge_entities (
  id            TEXT PRIMARY KEY,
  userId        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 实体核心信息
  type          TEXT NOT NULL,
    -- person     人物（通常是用户自己）
    -- project    项目/作品
    -- skill      技能/技术
    -- company    公司/组织
    -- school     学校
    -- award      荣誉/奖项
    -- publication 论文/出版物
    -- tool       工具/框架

  name          TEXT NOT NULL,    -- 规范化名称: "智能推荐系统"
  nameEn        TEXT,             -- 英文名: "Smart Recommendation System"
  aliases       TEXT,             -- JSON: ["推荐项目","RecSys"] 用于跨文件匹配
  description   TEXT,             -- 一句话描述（来自最详细的文件）

  -- 关联信息
  fileIds       TEXT NOT NULL,    -- JSON: ["file_uuid_1","file_uuid_2"]
                                  -- 出现在哪些文件中（跨 KB）
  sectionHint   TEXT,             -- 最适合展示在哪个 section
                                  -- hero|about|projects|skills|timeline|
                                  -- education|awards|publications|contact

  -- 排序和筛选
  importance    INTEGER DEFAULT 1,
    -- 3 = 核心实体（用户本人、主要项目）
    -- 2 = 重要提及（技能、公司）
    -- 1 = 普通提及（工具、次要引用）

  -- 灵活扩展
  metadata      TEXT,             -- JSON: {period, techStack, url, ...}

  createdAt     TEXT,
  updatedAt     TEXT
);
```

#### `entityRelations` — 实体间关系

```sql
CREATE TABLE entity_relations (
  id            TEXT PRIMARY KEY,
  userId        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fromEntityId  TEXT NOT NULL REFERENCES knowledge_entities(id) ON DELETE CASCADE,
  toEntityId    TEXT NOT NULL REFERENCES knowledge_entities(id) ON DELETE CASCADE,

  relationType  TEXT NOT NULL,
    -- built_with       项目使用了某技术/工具
    -- worked_at        人在某公司工作
    -- studied_at       人在某学校就读
    -- produced         经历/项目产出了某成果
    -- contributed_to   人参与了某项目
    -- evolved_into     一段经历发展为另一段（职业进阶）
    -- related_to       其他有意义的关联

  evidence      TEXT,    -- 来自哪个文件的哪段话（可追溯）
  strength      INTEGER DEFAULT 2,  -- 1=weak, 2=medium, 3=strong
  createdAt     TEXT
);
```

### 3.3 废弃的表（迁移后删除）

| 表 | 替代方案 |
|---|---|
| `knowledgeGroups` | → `knowledgeBases`（已有对应） |
| `knowledgeItems` | → `knowledgeFiles` 原文 + `knowledgeEntities` 实体 |
| `knowledgeRelations` | → `entityRelations` 实体关系 |

### 3.4 实体与 KB 的作用域关系

```
用户 (userId)
  │
  ├─── knowledgeBases (文件夹, 多个)
  │      └─── knowledgeFiles (文件, 属于某个 KB)
  │
  └─── knowledgeEntities (全局, 不绑定到某个 KB)
         │
         ├─── fileIds: 跨 KB 引用 (一个实体可关联多个 KB 的文件)
         │
         └─── entityRelations: 实体间关系 (全局)
```

**设计原因：**
- 实体是用户级的，不是 KB 级的 — 因为同一个"项目A"可能在"求职材料"KB 和"项目文档"KB 中都被提到
- `fileIds` 字段天然跨 KB，实现跨文件关联
- 前端按需过滤：进入某个 KB 只展示该 KB 相关的实体子图

---

## 4. 知识处理流程

### 4.1 整体流程

```
用户上传文件
    │
    ▼
Phase 1: 文件解析 + 轻量描述（已有，不变）
    │   解析原文 → AI 生成 description + keywords (~200 tokens)
    │   存入 knowledgeFiles → regenerateIndex()
    │
    ▼
Phase 2: 实体提取（新增，异步后台）
    │   从文件内容提取实体列表 (~500 tokens/文件)
    │   存入 knowledgeEntities → 更新 knowledgeFiles.entityIds
    │
    ▼
Phase 3: 跨文件实体对齐（新增，纯规则无 AI）
    │   新实体 vs 已有实体 → 名称/别名匹配 → 合并 fileIds
    │
    ▼
Phase 4: 关系推断（新增，按需触发）
        所有实体 → AI 推断关系 (~500 tokens/batch)
        存入 entityRelations
```

### 4.2 Phase 1: 文件上传与解析（保持不变）

入口: `POST /api/kb/[baseId]/files`

```
文件上传 → 按类型解析:
  PDF  → MinerU API → markdown
  DOCX → mammoth → 纯文本
  TXT/MD → 直接读取 (含 GBK 编码检测)
  ZIP  → 逐文件递归处理
  Image → 保存到 asset store
  Link → fetch 内容 / GitHub API

→ AI 轻量描述 (~200 tokens):
  输入: 文件名 + 内容前 2000 字
  输出: {description: "一句话描述", keywords: ["关键词"]}

→ 存入 knowledgeFiles
→ regenerateIndex() 更新 KB 的 indexMd
```

### 4.3 Phase 2: 实体提取（新增）

**触发时机：** 文件上传成功后异步触发，或用户手动点击"分析关联"

**API:** `POST /api/kb/[baseId]/enrich`

**AI Prompt (~500 tokens/文件)：**

```markdown
你是一个实体提取器。从以下文件内容中提取所有有意义的实体。

## 实体类型
- person: 人物（文件作者、提到的人）
- project: 项目/作品/产品
- skill: 技能/编程语言/技术能力
- company: 公司/组织/团队
- school: 学校/教育机构
- award: 荣誉/奖项/证书
- publication: 论文/文章/出版物
- tool: 工具/框架/平台

## 输出格式
JSON 数组，每个元素:
{
  "type": "实体类型",
  "name": "规范化名称（简洁、去重友好）",
  "nameEn": "英文名",
  "aliases": ["文中出现的其他叫法"],
  "description": "一句话描述该实体在文中的角色",
  "sectionHint": "hero|about|projects|skills|timeline|education|awards|publications|contact",
  "importance": 1-3,
  "metadata": { 可选: "period", "techStack", "url" 等 }
}

## 规则
- 同一实体只出现一次，用 aliases 收集不同叫法
- 只提取文中明确出现的实体，不要推测
- importance 3: 文档主角/核心项目; 2: 重要提及; 1: 普通提及
- 输出纯 JSON，不要 markdown 包裹

## 文件信息
文件名: ${fileName}
类型: ${fileType}
内容:
${contentPreview (前 3000 字)}
```

**处理逻辑：**

```typescript
async function extractEntities(fileId: string, userId: string): Promise<void> {
  // 1. 读取文件内容
  const file = await db.select().from(knowledgeFiles).where(eq(id, fileId)).get();

  // 2. AI 提取实体
  const entities = await aiExtractEntities(file.name, file.type, file.content);

  // 3. 跨文件实体对齐 (Phase 3, 内联调用)
  const resolvedIds: string[] = [];
  for (const entity of entities) {
    const existingId = await resolveEntity(userId, entity);
    if (existingId) {
      // 已有实体: 追加 fileId, 合并 aliases
      await mergeEntityFile(existingId, fileId, entity);
      resolvedIds.push(existingId);
    } else {
      // 新实体: 创建
      const newId = await createEntity(userId, entity, fileId);
      resolvedIds.push(newId);
    }
  }

  // 4. 更新文件记录
  await db.update(knowledgeFiles).set({
    entityIds: JSON.stringify(resolvedIds),
    sectionMapping: JSON.stringify(inferSectionMapping(entities)),
    enrichedAt: new Date().toISOString(),
    enrichVersion: CURRENT_ENRICH_VERSION,
  }).where(eq(id, fileId));
}
```

### 4.4 Phase 3: 跨文件实体对齐（纯规则，无 AI）

```typescript
async function resolveEntity(
  userId: string,
  newEntity: ExtractedEntity,
): Promise<string | null> {
  const existing = await db.select()
    .from(knowledgeEntities)
    .where(eq(knowledgeEntities.userId, userId));

  for (const e of existing) {
    if (e.type !== newEntity.type) continue;

    // 规则 1: name 完全匹配 (大小写不敏感)
    if (e.name.toLowerCase() === newEntity.name.toLowerCase()) return e.id;

    // 规则 2: nameEn 完全匹配
    if (e.nameEn && newEntity.nameEn &&
        e.nameEn.toLowerCase() === newEntity.nameEn.toLowerCase()) return e.id;

    // 规则 3: aliases 交集非空
    const existingAliases = JSON.parse(e.aliases || "[]").map(a => a.toLowerCase());
    const newAliases = newEntity.aliases.map(a => a.toLowerCase());
    const allExisting = [e.name.toLowerCase(), ...existingAliases];
    const allNew = [newEntity.name.toLowerCase(), ...newAliases];
    if (allExisting.some(a => allNew.includes(a))) return e.id;

    // 规则 4: 同 type + name 编辑距离 ≤ 2 (短名称)
    if (e.name.length <= 10 && newEntity.name.length <= 10) {
      if (editDistance(e.name, newEntity.name) <= 2) return e.id;
    }
  }

  return null; // 未匹配，需要创建新实体
}
```

**合并逻辑：**

```typescript
async function mergeEntityFile(
  entityId: string,
  newFileId: string,
  newData: ExtractedEntity,
): Promise<void> {
  const entity = await db.select().from(knowledgeEntities).where(eq(id, entityId)).get();

  const fileIds = JSON.parse(entity.fileIds);
  if (!fileIds.includes(newFileId)) fileIds.push(newFileId);

  const aliases = JSON.parse(entity.aliases || "[]");
  for (const alias of newData.aliases) {
    if (!aliases.includes(alias)) aliases.push(alias);
  }

  // 取更长的 description
  const description = (newData.description?.length > (entity.description?.length || 0))
    ? newData.description : entity.description;

  // importance 取最大值
  const importance = Math.max(entity.importance, newData.importance);

  await db.update(knowledgeEntities).set({
    fileIds: JSON.stringify(fileIds),
    aliases: JSON.stringify(aliases),
    description,
    importance,
    updatedAt: new Date().toISOString(),
  }).where(eq(id, entityId));
}
```

### 4.5 Phase 4: 关系推断（按需触发）

**触发时机：**
- 实体数量 >= 5 时自动触发一次
- 新文件增强完成后，如果产生了新实体或扩展了已有实体
- 用户手动点击"重新分析关系"

**API:** `POST /api/entities/relations`

**AI Prompt (~500 tokens/batch)：**

```markdown
给定以下实体列表，推断它们之间的关系。

## 实体列表
${entities.map(e => `- [${e.type}] ${e.name}: ${e.description}`).join('\n')}

## 关系类型
- built_with: 项目使用了某技术/工具
- worked_at: 人在某公司工作
- studied_at: 人在某学校就读
- produced: 经历/项目产出了某成果（论文、奖项等）
- contributed_to: 人参与了某项目
- evolved_into: 一段经历发展为另一段（如实习→全职）
- related_to: 其他有意义的关联

## 输出格式
JSON 数组:
[{"from": "实体名", "to": "实体名", "type": "关系类型", "evidence": "关键依据", "strength": 1-3}]

## 规则
- 只输出有依据的关系，不要猜测
- strength: 3=明确陈述, 2=可推断, 1=弱关联
- 输出纯 JSON
```

---

## 5. 实体关联系统

### 5.1 实体关联的核心价值

```
场景: 用户上传了 3 个文件

resume.pdf         →  提到"智能推荐系统"(2行概述)
project-recsys.md  →  提到"智能推荐系统"(详细技术文档)
blog-ml.md         →  提到"推荐系统"(技术复盘博客)

没有实体关联时:
  Agent 把这三处当作不相关的文本，项目 section 可能只用了简历的 2 行概述

有实体关联后:
  Entity "智能推荐系统" → fileIds: [resume.pdf, project-recsys.md, blog-ml.md]
  Agent 知道要把三个文件的内容合并来展示这个项目
  → 简历提供概述 + 项目文档提供详细 + 博客提供技术深度
```

### 5.2 实体上下文构建

```typescript
// 新文件: src/lib/entity-context.ts

export interface EntityContext {
  /** 给 Agent 看的 markdown 格式关系图 */
  markdown: string;
  /** 结构化数据 */
  entities: EntityWithRelations[];
  /** 文件级路由: fileId → sections[] */
  fileRouting: Record<string, string[]>;
}

export async function buildEntityContext(userId: string): Promise<EntityContext> {
  const entities = await loadEntitiesWithRelations(userId);
  const markdown = formatEntityGraph(entities);
  const fileRouting = buildFileRouting(entities);
  return { markdown, entities, fileRouting };
}
```

**生成的 markdown 示例：**

```markdown
## 核心人物
张三 (前端工程师)
  就职于: 字节跳动 (2022-2024), 美团 (2024-至今)
  教育: 清华大学 计算机科学 学士
  主导项目: 智能推荐系统, 数据看板, 设计系统
  核心技能: React, Python, TensorFlow, TypeScript

## 项目
智能推荐系统 ★★★
  描述: 基于深度学习的个性化推荐引擎
  技术栈: Python, TensorFlow, Redis
  产出: 推荐准确率提升30%, 专利1项
  信息来源: resume.pdf(概述), project-recsys.md(详细), blog-ml.md(技术复盘)
  建议展示: projects section

数据看板 ★★☆
  描述: 实时数据可视化平台
  技术栈: React, D3.js, WebSocket
  信息来源: resume.pdf(概述), dashboard-doc.md(详细)
  建议展示: projects section

## 技能
React ★★★ — 用于: 数据看板, 设计系统
Python ★★★ — 用于: 智能推荐系统
TensorFlow ★★☆ — 用于: 智能推荐系统
TypeScript ★★☆ — 用于: 设计系统

## 文件路由建议
hero/about: resume.pdf (姓名、职位、简介)
projects: project-recsys.md, dashboard-doc.md, resume.pdf
skills: resume.pdf (技能列表)
timeline: resume.pdf (工作经历)
education: resume.pdf (教育背景)
```

### 5.3 按作用域过滤

```typescript
/**
 * 加载特定 KB 的实体子图（进入某个 KB 时使用）
 */
export async function buildEntityContextForBase(
  userId: string,
  baseId: string,
): Promise<EntityContext> {
  // 1. 获取该 KB 的所有文件 ID
  const files = await db.select({ id: knowledgeFiles.id })
    .from(knowledgeFiles)
    .where(eq(knowledgeFiles.baseId, baseId));
  const fileIdSet = new Set(files.map(f => f.id));

  // 2. 加载涉及这些文件的实体
  const allEntities = await loadEntitiesWithRelations(userId);
  const filtered = allEntities.filter(e =>
    JSON.parse(e.fileIds).some(fid => fileIdSet.has(fid))
  );

  // 3. 构建子图
  return formatEntityContext(filtered);
}

/**
 * 加载已选 KB 的合并实体图（create 页面构建时使用）
 */
export async function buildEntityContextForBases(
  userId: string,
  baseIds: string[],
): Promise<EntityContext> {
  // 合并多个 KB 的文件 ID → 过滤实体 → 构建合并图
}
```

---

## 6. 构建管线消费

### 6.1 消费入口总览

```
实体关联系统
    │
    ├─→ chat-build (对话构建)
    │     注入: entityContext.markdown + kbContent
    │     Agent 拿到关系图 + 原文
    │
    ├─→ compile-spec (编译规格)
    │     注入: entityContext + 文件索引
    │     替代: Legacy items 按 category 分组
    │
    ├─→ build-runtime / generate (生成代码)
    │     Code Agent: kbContent (原文)
    │     ContentModel: enrichContentModelFromEntities()
    │     Routing: entityContext.fileRouting
    │
    └─→ knowledge.json (站内聊天机器人)
          注入: 文件原文 chunks + entities 数据
```

### 6.2 chat-build 改造

**文件:** `src/app/api/chat-build/route.ts`

```typescript
// ---- 改前 ----
// Legacy: items.filter(selected) → "[category] title: content"
// KB: loadFullKBContext() → indexContent + 原文
// 分别加载，手动合并

// ---- 改后 ----
// 1. 加载 KB 原文 (不变)
const kbContent = await loadKBContent(session.user.id, selectedBaseIds);

// 2. 加载实体上下文 (新增)
const entityCtx = await buildEntityContextForBases(session.user.id, selectedBaseIds);

// 3. 合并传给 Agent
const result = await runBuildConversation({
  knowledgeContext: kbContent,          // 原文内容
  entityContext: entityCtx.markdown,    // 实体关系图 (新增)
  knowledgeSummary: `${kbFileCount} files, ${entityCtx.entities.length} entities`,
  // 移除: knowledgeGroupIndex (废弃)
});
```

### 6.3 Agent Prompt 注入

所有 Agent 都能看到实体关系图：

```markdown
## 实体关系图 (Entity Graph)
${entityContext}

使用说明:
- 关系图展示了用户信息的完整结构和跨文件关联
- "信息来源" 列出了每个实体的详细内容在哪些文件中
- 构建网站时，同一实体的多个文件内容应合并展示
- 技能标签应从 built_with 关系自动填充

## 知识库原文 (Raw Knowledge)
${knowledgeContext}
```

**各 Agent 消费重点：**

| Agent | 消费 entityContext | 消费 knowledgeContext | 作用 |
|-------|-------------------|---------------------|------|
| Orchestrator | 仅 summary | 不消费 | 判断路由 |
| Ideation | 完整关系图 | 完整原文 | 理解用户全貌 |
| Planning | 完整关系图 + fileRouting | 不消费 | 规划页面结构 |
| Design | 完整关系图 | 原文摘要 | 设计视觉方案 |
| Code | 完整关系图 | 完整原文 (~40K) | 生成代码 |
| Execution | summary | 不消费 | 确定 selections |

### 6.4 compile-spec 改造

**文件:** `src/app/api/compile-spec/route.ts`

```typescript
// ---- 改前 ----
// 只接收 Legacy KnowledgeItem[]，按 category 分组

// ---- 改后 ----
const entityCtx = await buildEntityContextForBases(userId, selectedBaseIds);

const userMessage = `
## 实体关系图
${entityCtx.markdown}

## 知识库文件索引
${kbIndexContent}

## 文件→Section 路由建议
${JSON.stringify(entityCtx.fileRouting, null, 2)}

请根据以上信息编译 SiteSpec。
实体关系图中的"信息来源"和"建议展示"字段可指导 section 规划。
`;
```

### 6.5 build-runtime 改造

**文件:** `src/lib/build-runtime.ts`

三个阶段的改造：

#### 阶段 A: Code Agent（小改）

```typescript
// 不变: Code Agent 继续读 KB 原文
// 新增: 注入 entityContext 让 Code Agent 理解结构
const codeResult = await runCodeAgent(
  {
    knowledgeContext: kbContent,       // 原文 (不变)
    entityContext: entityCtx.markdown, // 新增
  },
  designPlan,
  assetCss,
);
```

#### 阶段 B: Knowledge Routing（重构）

```typescript
// ---- 改前 ----
// 从 knowledgeItems 表读取 → routeKnowledge() 三轮匹配

// ---- 改后 ----
// 直接用 entityContext.fileRouting
const routing = entityCtx.fileRouting;
// routing = { "hero": ["file_1"], "projects": ["file_2","file_3"], ... }

for (const [sectionId, fileIds] of Object.entries(routing)) {
  const contents = await loadFileContents(fileIds);
  existing.chunks.push({
    topic: sectionId,
    content: contents.map(f => `${f.name}: ${f.content}`).join("\n"),
  });
}
```

#### 阶段 C: ContentModel 增强（新增）

```typescript
// 替代当前未接入的 resolveRelations() + enrichModelWithRelations()
import { enrichContentModelFromEntities } from "./entity-context";

// 在 ContentModel 构建完成后调用
const enrichedModel = enrichContentModelFromEntities(model, entityCtx.entities);
```

**增强逻辑：**

```typescript
export function enrichContentModelFromEntities(
  model: ContentModel,
  entities: EntityWithRelations[],
): ContentModel {
  // 1. 项目自动补充技能标签 (from built_with relations)
  for (const project of model.projects) {
    const entity = findMatchingEntity(entities, "project", project.title);
    if (!entity) continue;

    const techSkills = entity.relations
      .filter(r => r.relationType === "built_with")
      .map(r => r.targetEntity.name);
    project.tags = [...new Set([...project.tags, ...techSkills])];

    // 补充 highlights (from produced relations)
    const outputs = entity.relations
      .filter(r => r.relationType === "produced")
      .map(r => r.targetEntity.name);
    if (outputs.length > 0 && !project.highlights?.length) {
      project.highlights = outputs;
    }
  }

  // 2. 经历自动关联项目 (from contributed_to relations)
  for (const exp of model.experience) {
    const companyEntity = findMatchingEntity(entities, "company", exp.org);
    if (!companyEntity) continue;

    const projects = companyEntity.relations
      .filter(r => r.relationType === "contributed_to")
      .map(r => r.targetEntity.name);
    if (projects.length > 0 && !exp.highlights?.length) {
      exp.highlights = projects.map(p => `参与项目: ${p}`);
    }
  }

  // 3. 技能自动关联使用场景 (from used_in relations)
  for (const group of model.skills) {
    for (let i = 0; i < group.skills.length; i++) {
      const skillEntity = findMatchingEntity(entities, "skill", group.skills[i]);
      if (skillEntity) {
        const usedIn = skillEntity.relations
          .filter(r => r.relationType === "built_with")
          .map(r => r.targetEntity.name);
        // 可选: 在技能名后附加使用场景
        // group.skills[i] = `${group.skills[i]} (${usedIn.join(", ")})`;
      }
    }
  }

  return model;
}
```

### 6.6 knowledge.json 改造

```typescript
// ---- 改前 ----
// chunks: Legacy routing 结果 + KB 文件原文 (简单拼接)

// ---- 改后 ----
const knowledgeJson = {
  // 文件内容 chunks (不变)
  chunks: fileChunks,

  // 实体数据 (新增 — chatbot 可回答关系问题)
  entities: entityCtx.entities.map(e => ({
    type: e.type,
    name: e.name,
    description: e.description,
    relations: e.relations.map(r => ({
      type: r.relationType,
      target: r.targetEntity.name,
    })),
  })),
};
```

Chatbot 拿到实体数据后，用户问"你做过什么推荐相关的？"时，可以：
1. 通过实体找到"智能推荐系统"
2. 通过 `built_with` 关系找到技术栈
3. 通过 `produced` 关系找到成果
4. 通过 `fileIds` 关联的 chunks 找到详细内容

---

## 7. 前端设计

### 7.1 知识库管理页 (`/knowledge`)

#### 整体布局

```
┌─────────────────────────────────────────────────────────┐
│  知识管理                                    [+ 新建知识库] │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │ 求职材料  │ │ 项目文档  │ │ 博客文章  │                │
│  │ 5 files   │ │ 3 files   │ │ 7 files   │                │
│  │ 12K 字    │ │ 8K 字     │ │ 25K 字    │                │
│  │ ● 已分析  │ │ ○ 未分析  │ │ ● 已分析  │                │
│  └──────────┘ └──────────┘ └──────────┘                │
│                                                          │
│  ─── 移除旧的 Legacy Groups 区域 ───                      │
│  ─── 替换为 ↓ 实体关联面板 ↓ ───                          │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  实体关联 (23 个实体, 31 条关系)              [重新分析]  │
│                                                          │
│  Tab: [ 实体列表 | 关系图谱 | 文件路由 ]                  │
│                                                          │
│  (根据选中的 Tab 展示不同内容，见 7.2-7.4)               │
└─────────────────────────────────────────────────────────┘
```

#### 7.2 实体列表 Tab

按实体类型分组展示，每个实体卡片包含：
- 重要度（★ 标记）
- 名称 + 英文名
- 一句话描述
- 关联关系摘要（→ 就职于: ..., → 技术栈: ...）
- 出现在哪些文件（可点击预览）
- 操作: 编辑、合并（处理 AI 未对齐的实体）

```
┌─────────────────────────────────────────────────────────┐
│  🔍 搜索实体...                筛选: [全部▾] [重要度▾]   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  👤 人物 (1)                                             │
│  ┌────────────────────────────────────────────────┐     │
│  │ ★★★ 张三  Zhang San                            │     │
│  │ 前端工程师 · 出现在 4 个文件                     │     │
│  │ → 就职于: 字节跳动, 美团                         │     │
│  │ → 主导: 智能推荐系统, 数据看板                   │     │
│  │ → 技能: React, Python, TensorFlow               │     │
│  │ 📄 resume.pdf, cover-letter.md, ...             │     │
│  │                                    [编辑] [合并] │     │
│  └────────────────────────────────────────────────┘     │
│                                                          │
│  📦 项目 (5)                                             │
│  ┌────────────────────────────────────────────────┐     │
│  │ ★★★ 智能推荐系统  Smart Recommendation System   │     │
│  │ 基于深度学习的个性化推荐引擎                     │     │
│  │ → 技术栈: Python, TensorFlow, Redis             │     │
│  │ → 产出: 推荐准确率提升30%, 专利1项               │     │
│  │ 📄 resume.pdf, project-recsys.md, blog-ml.md   │     │
│  │ 路由建议: projects                              │     │
│  └────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────┐     │
│  │ ★★☆ 数据看板                                    │     │
│  │ 实时数据可视化平台                               │     │
│  │ → 技术栈: React, D3.js, WebSocket              │     │
│  │ 📄 resume.pdf, dashboard-doc.md                 │     │
│  └────────────────────────────────────────────────┘     │
│                                                          │
│  ⚡ 技能 (8)                                             │
│  ┌────────────────────────────────────────────────┐     │
│  │ Python ★★★    React ★★★    TensorFlow ★★☆      │     │
│  │ TypeScript ★★☆  D3.js ★☆☆   Redis ★☆☆          │     │
│  └────────────────────────────────────────────────┘     │
│                                                          │
│  🏢 公司 (2)     🎓 学校 (1)     🏆 荣誉 (2)            │
│  (折叠展示，点击展开)                                     │
└─────────────────────────────────────────────────────────┘
```

#### 7.3 关系图谱 Tab

替代现有的 `KnowledgeGraph.tsx`，核心改进：
- 节点是**实体**而非碎片 item
- 关系是**跨文件**的
- 节点大小反映重要度，颜色区分类型

```
┌─────────────────────────────────────────────────────────┐
│  关系图谱                                                │
│                                                          │
│    ┌────────┐                                            │
│    │  张三   │──── worked_at ────→ ┌────────┐            │
│    │ ★★★ 👤 │                      │字节跳动 │            │
│    └───┬────┘                      │ ★★☆ 🏢 │            │
│        │                           └────────┘            │
│  contributed_to                                          │
│        │              built_with                         │
│    ┌───┴────┐ ←──────────────── ┌────────┐              │
│    │推荐系统 │                    │ Python  │              │
│    │ ★★★ 📦 │                    │ ★★★ ⚡ │              │
│    └───┬────┘                    └────────┘              │
│        │                                                 │
│     produced                                             │
│        │                                                 │
│    ┌───┴────────┐                                        │
│    │准确率提升30%│                                        │
│    │ ★★☆ 🏆    │                                        │
│    └────────────┘                                        │
│                                                          │
│  图例: 👤人物 📦项目 ⚡技能 🏢公司 🎓学校 🏆荣誉         │
│  节点大小 = 重要度 · 线条粗细 = 关系强度                  │
│                                                          │
│  [ Hover 节点显示: 详细信息 + 关联文件列表 ]              │
│  [ 点击节点: 高亮相关节点和边 + 展开文件预览 ]            │
└─────────────────────────────────────────────────────────┘
```

**技术实现:** 复用现有的 Canvas 力导向图框架，改数据源为 `GET /api/entities/graph`。

#### 7.4 文件路由 Tab

展示每个文件被路由到哪些 section，支持手动调整：

```
┌─────────────────────────────────────────────────────────┐
│  文件 → 网站 Section 路由预览                             │
│                                                          │
│  hero / about                                            │
│  ├─ 📄 resume.pdf        (姓名、职位、简介)              │
│  └─ 📄 cover-letter.md   (个人陈述)                      │
│                                                          │
│  projects                                                │
│  ├─ 📄 project-recsys.md (智能推荐系统 详细)             │
│  ├─ 📄 resume.pdf        (项目列表 概述)                 │
│  └─ 📄 blog-ml.md        (推荐系统 技术复盘)             │
│                                                          │
│  skills                                                  │
│  ├─ 📄 resume.pdf        (技能列表)                      │
│  └─ 📄 cert-aws.pdf      (AWS 认证)                     │
│                                                          │
│  timeline                                                │
│  ├─ 📄 resume.pdf        (工作经历)                      │
│  └─ 📄 linkedin-export.txt (职业历程)                    │
│                                                          │
│  ⚠️ 未路由文件:                                           │
│  └─ 📄 random-notes.txt  (无明确 section 归属)           │
│                                                          │
│  操作: 拖拽文件到不同 section · 点击文件预览内容           │
│                           [确认路由] [恢复默认]           │
└─────────────────────────────────────────────────────────┘
```

### 7.5 单个 KB 详情页 (`/knowledge/[baseId]`)

进入某个 KB 后，展示该 KB 内的文件列表 + **该 KB 涉及的实体子图**：

```
┌─────────────────────────────────────────────────────────┐
│  ← 返回  求职材料                      [上传文件] [分析]  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  文件列表 (5 files, 12K 字)                              │
│  ┌────────────────────────────────────────────────┐     │
│  │ 📄 resume.pdf           8.2K 字  ● 已分析      │     │
│  │    包含实体: 张三, 智能推荐系统, Python, ...     │     │
│  │    路由: hero, projects, skills, timeline       │     │
│  ├────────────────────────────────────────────────┤     │
│  │ 📄 cover-letter.md      1.5K 字  ● 已分析      │     │
│  │    包含实体: 张三                               │     │
│  │    路由: hero, about                            │     │
│  ├────────────────────────────────────────────────┤     │
│  │ 📄 cert-aws.pdf         0.8K 字  ○ 未分析      │     │
│  │    (点击"分析"按钮提取实体)                      │     │
│  └────────────────────────────────────────────────┘     │
│                                                          │
│  本知识库涉及的实体 (过滤后子图)                          │
│  ┌────────────────────────────────────────────────┐     │
│  │ 力导向图: 只展示与本 KB 文件相关的实体和关系      │     │
│  └────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### 7.6 创建页面 (`/create`) — 知识选择器

**改造目标:** 统一选择入口，用户选 KB → 自动获得实体和路由

```
┌─────────────────────────────────────────────────────────┐
│  📚 选择知识  (12 个实体 · 8 个文件已选)                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  选择知识库:                                              │
│  ☑ 📚 求职材料 (5 files · 8 实体)                        │
│  ☑ 📚 项目文档 (3 files · 6 实体)                        │
│  ☐ 📚 博客文章 (7 files · 4 实体)                        │
│                                                          │
│  ─── 已选知识库包含的核心实体 ───                          │
│                                                          │
│  ☑ ★★★ 张三 (人物) — 4个文件                             │
│  ☑ ★★★ 智能推荐系统 (项目) — 3个文件                     │
│  ☑ ★★☆ 数据看板 (项目) — 2个文件                         │
│  ☑ ★★★ React (技能)                                     │
│  ☑ ★★★ Python (技能)                                    │
│  ☐ ★☆☆ Redis (工具)                                     │
│  ...                                                     │
│                                                          │
│  💡 已选: 3个项目 · 8个技能 · 2段工作经历                 │
│     [预览关系图]                                          │
│                                                          │
│  ─── 移除旧的 Legacy Items checkbox 区域 ───              │
└─────────────────────────────────────────────────────────┘
```

**传给 API 的数据:**

```typescript
// chat-build
body: {
  messages,
  knowledgeBaseIds: selectedBaseIds,  // 不变
  // 移除: knowledge: KnowledgeItem[]  (废弃 Legacy items)
  loadedSkills,
  siteId,
  currentPrd,
  useDesignAgent: true,
}

// compile-spec
body: {
  knowledgeBaseIds: selectedBaseIds,  // 新增，替代 knowledge[]
  intent: { siteType, theme, layout, ... },
  skillIds,
}
```

### 7.7 Resources Tab（create 页面右侧）

```
┌─────────────────────────────────────────────────────────┐
│  Tab: [预览] [PRD] [资源]                                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📊 知识概要                                             │
│  8 个文件 · 12 个实体 · 18 条关系                        │
│                                                          │
│  核心结构:                                               │
│  张三 → 字节跳动(前端工程师) → 智能推荐系统              │
│       → 美团(高级前端) → 数据看板                        │
│       → 清华大学(计算机 学士)                            │
│                                                          │
│  Section 内容来源:                                       │
│  hero:     resume.pdf                                    │
│  projects: project-recsys.md + resume.pdf + blog-ml.md  │
│  skills:   resume.pdf                                    │
│  timeline: resume.pdf                                    │
│                                                          │
│  [在知识库中查看完整关系图 →]                             │
└─────────────────────────────────────────────────────────┘
```

---

## 8. 迁移策略

### 8.1 分步实施

#### Step 1: 数据库迁移 (Day 1)

```
1. 新建 knowledge_entities 表
2. 新建 entity_relations 表
3. knowledgeFiles 新增字段: sectionMapping, entityIds, enrichedAt, enrichVersion
4. 不删旧表，保持向后兼容
```

#### Step 2: 核心逻辑实现 (Day 2-4)

新增文件，不动现有代码：

```
src/lib/
  entity-extractor.ts    — 单文件实体提取 (AI 调用)
  entity-resolver.ts     — 跨文件实体对齐 (纯规则)
  entity-relations.ts    — 关系推断 (AI 调用)
  entity-context.ts      — 构建管线消费层 (buildEntityContext)
```

新增 API:

```
/api/kb/[baseId]/enrich    POST  触发某个 KB 的实体提取
/api/entities              GET   获取用户的所有实体
/api/entities/graph        GET   获取实体+关系 (前端图谱用)
/api/entities/relations    POST  触发关系推断
/api/entities/[id]         PUT   编辑实体 (名称、重要度等)
/api/entities/merge        POST  手动合并两个实体
```

#### Step 3: 接入构建管线 (Day 5-6)

修改现有文件，添加 entity 消费逻辑：

```
chat-build/route.ts     — 注入 entityContext
compile-spec/route.ts   — 用 entityContext 替代 Legacy items
build-runtime.ts        — ContentModel 增强 + fileRouting
```

**关键: 保持向后兼容。** 如果 entityContext 为空（用户未做实体分析），走现有逻辑不报错。

#### Step 4: 前端改造 (Day 7-10)

```
/knowledge 页      — 实体面板 (列表 + 图谱 + 路由)
/knowledge/[id] 页 — KB 详情增加实体子图
/create 页         — 统一知识选择器
Resources Tab      — 实体概要展示
KnowledgeGraph.tsx — 改数据源为实体图谱 API
```

#### Step 5: 迁移旧数据 + 清理 (Day 11-12)

```
1. 迁移脚本: 现有 knowledgeItems 的 category/useCase →
   为对应的 knowledgeFiles 生成 sectionMapping
2. 灰度: 新用户直接走新系统, 老用户渐进切换
3. 确认无消费者后，前端移除 Legacy upload 入口
4. 后续版本删除旧表和相关代码:
   - knowledgeGroups, knowledgeItems, knowledgeRelations
   - ingestion-worker.ts, /api/ingestion
   - /api/knowledge, /api/knowledge-groups
   - knowledge-router.ts (routeKnowledge)
   - analyze-source/route.ts 中的 aiExtractKnowledge (MECE 提取)
```

### 8.2 向后兼容策略

迁移过程中，构建管线需要同时支持新旧两套数据：

```typescript
// build-runtime.ts 中的兼容逻辑
async function getKnowledgeForBuild(userId: string, baseIds: string[]) {
  // 优先使用新系统
  const entityCtx = await buildEntityContextForBases(userId, baseIds);
  if (entityCtx.entities.length > 0) {
    return { type: "entity", entityCtx, kbContent };
  }

  // 回退到旧系统
  const legacyItems = await db.select().from(knowledgeItemsTable)
    .where(eq(knowledgeItemsTable.userId, userId));
  if (legacyItems.length > 0) {
    return { type: "legacy", legacyItems };
  }

  // 仅有 KB 原文 (未做实体分析)
  return { type: "raw", kbContent };
}
```

---

## 9. 成本分析

### 9.1 AI Token 消耗对比

| 操作 | 现在 (Legacy) | 改后 | 变化 |
|------|-------------|------|------|
| 文件上传 (描述+关键词) | — | ~200 tokens | 不变 |
| MECE 全提取 | ~8,000 tokens | 移除 | **-8,000** |
| 实体提取 | — | ~500 tokens/文件 | 新增 |
| 实体对齐 | — | 0 (纯规则) | 免费 |
| 关系推断 | (包含在 MECE 中) | ~500 tokens/batch | 新增 |
| **单文件总计** | **~8,200 tokens** | **~1,200 tokens** | **-85%** |

### 9.2 存储对比

| | 现在 | 改后 |
|---|---|---|
| 原文 | knowledgeFiles.content | 不变 |
| 碎片 items | knowledgeItems (每文件 10-30 条) | 移除 |
| 实体 | — | knowledgeEntities (每文件 5-15 个，但跨文件复用) |
| 关系 | knowledgeRelations (碎片间) | entityRelations (实体间，数量更少) |
| **总体** | 原文 + 大量碎片 | 原文 + 少量实体 (减少 ~60% 行数) |

### 9.3 构建时延迟

| 阶段 | 现在 | 改后 |
|---|---|---|
| 知识加载 | 分别查 2 套表 + 手动合并 | 查 1 套表 + entityContext |
| Knowledge routing | routeKnowledge() 三轮匹配 | 直接读 fileRouting (预计算) |
| ContentModel 增强 | 不存在 | enrichContentModelFromEntities() |
| **总体** | 类似 | 略快 (预计算的路由 vs 运行时匹配) |

---

## 附录

### A. 涉及的文件清单

#### 新增文件

```
src/lib/
  entity-extractor.ts      实体提取
  entity-resolver.ts       实体对齐
  entity-relations.ts      关系推断
  entity-context.ts        上下文构建 + ContentModel 增强

src/app/api/
  kb/[baseId]/enrich/route.ts    触发增强
  entities/route.ts              实体 CRUD
  entities/graph/route.ts        图谱数据
  entities/relations/route.ts    关系推断
  entities/[id]/route.ts         单实体操作
  entities/merge/route.ts        手动合并
```

#### 修改文件

```
src/lib/db/schema.ts             新增表定义
src/app/api/chat-build/route.ts  注入 entityContext
src/app/api/compile-spec/route.ts  替换 Legacy items
src/lib/build-runtime.ts         3 个阶段的改造
src/components/KnowledgeGraph.tsx 改数据源
src/app/knowledge/page.tsx       实体面板
src/app/create/page.tsx          统一知识选择器
```

#### 最终删除文件

```
src/lib/ingestion-worker.ts      Legacy 上传 worker
src/lib/knowledge-router.ts      Legacy 路由 (routeKnowledge)
src/lib/content-model-utils.ts   Legacy 关系增强 (未使用)
src/app/api/ingestion/           Legacy 上传 API
src/app/api/knowledge/           Legacy items CRUD
src/app/api/knowledge-groups/    Legacy groups CRUD
src/app/api/knowledge-graph/     Legacy 图谱 API
```

### B. 关系类型速查

| 关系类型 | 方向 | 示例 |
|---------|------|------|
| `built_with` | 项目 → 技能/工具 | 推荐系统 → Python |
| `worked_at` | 人 → 公司 | 张三 → 字节跳动 |
| `studied_at` | 人 → 学校 | 张三 → 清华大学 |
| `produced` | 项目/经历 → 成果 | 推荐系统 → 专利 |
| `contributed_to` | 人 → 项目 | 张三 → 推荐系统 |
| `evolved_into` | 经历 → 经历 | 实习 → 全职 |
| `related_to` | 任意 → 任意 | 兜底关联 |

### C. 实体类型速查

| 实体类型 | 默认 sectionHint | 示例 |
|---------|-----------------|------|
| `person` | hero, about | 张三 |
| `project` | projects | 智能推荐系统 |
| `skill` | skills | Python, React |
| `company` | timeline | 字节跳动 |
| `school` | education | 清华大学 |
| `award` | awards | ACM 金牌 |
| `publication` | publications | 论文标题 |
| `tool` | skills | Docker, Redis |
