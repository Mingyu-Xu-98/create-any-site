# 数据库与用户管理方案

> 版本: v1.1 | 日期: 2026-04-02 | 状态: 设计阶段

## 目录

- [1. 数据库策略](#1-数据库策略)
- [2. 用量统计系统](#2-用量统计系统)
- [3. 额度控制与计费扩展](#3-额度控制与计费扩展)
- [4. 管理后台增强](#4-管理后台增强)
- [5. 实施计划](#5-实施计划)

---

## 1. 数据库策略

### 1.1 决策：现阶段保持 SQLite

```
当前环境:
  部署: 单台云服务器
  用户规模: 个人/小规模使用
  数据库: SQLite (data/app.db, 单文件)
  ORM: Drizzle ORM 0.45
  驱动: better-sqlite3 12

结论: 继续使用 SQLite, 不做迁移
```

**SQLite 在当前场景下的优势：**
- 零运维：无需安装/配置/维护数据库服务
- 零成本：不需要额外的数据库服务器或云服务
- 低延迟：本地文件读写，无网络开销
- 易备份：整个数据库就是一个文件，`cp` 即可备份
- 易迁移：拷贝 `data/app.db` 到新服务器即可运行

**SQLite 的已知限制（当前不构成问题）：**
- 并发写入限制 → 单服务器单进程，不受影响
- 无远程连接 → 应用和数据库在同一台服务器，不需要
- 无原生 JSON 索引 → 当前数据量下全表扫描性能足够
- 类型系统弱 → Drizzle ORM 在应用层补齐了类型安全

### 1.2 数据备份策略

**自动备份（必须配置）：**

```bash
# 添加到 crontab (crontab -e)
# 每天凌晨 3 点备份, 保留最近 30 天
0 3 * * * cp /path/to/project/data/app.db /path/to/backup/app_$(date +\%Y\%m\%d).db
0 4 * * * find /path/to/backup/ -name "app_*.db" -mtime +30 -delete
```

**手动备份（重大操作前）：**

```bash
cp data/app.db data/app_backup_$(date +%Y%m%d_%H%M%S).db
```

**服务器迁移：**

```bash
# 从旧服务器
scp /path/to/project/data/app.db user@new-server:/path/to/project/data/

# 新服务器上启动即可, 无需任何配置
```

### 1.3 未来迁移到 PostgreSQL 的预留

当出现以下信号时再考虑迁移：
- 多台服务器需要访问同一个数据库
- 并发写入用户 > 50
- 需要迁移到企业环境且对方要求统一数据库

**迁移成本评估：**

Drizzle ORM 的查询 API（`select/insert/update/where/eq/and` 等）是跨数据库通用的。
迁移时只需要改两个文件：

| 文件 | 改动 |
|------|------|
| `src/lib/db/schema.ts` | `sqliteTable` → `pgTable`，类型映射（text→timestamp, integer→boolean 等） |
| `src/lib/db/index.ts` | 连接方式从 better-sqlite3 改为 pg |

所有 API 路由和业务逻辑**不需要改动**。

**类型映射参考（迁移时查阅）：**

| SQLite 现状 | PostgreSQL | 涉及字段 |
|-------------|-----------|---------|
| `text("id")` + `crypto.randomUUID()` | `uuid("id").defaultRandom()` | 所有主键/外键 |
| `text("created_at")` + `Date.toISOString()` | `timestamp("created_at").defaultNow()` | 所有时间字段 |
| `integer("selected").default(1)` | `boolean("selected").default(true)` | 布尔字段 |
| `text("tags")` (JSON string) | `jsonb("tags")` | JSON 字段 |

**数据迁移方式：**

```bash
# 方案 A: pgloader 自动迁移
pgloader sqlite:///data/app.db postgresql://user:pass@host/db

# 方案 B: Node 脚本逐表迁移 (更精确)
npx tsx scripts/migrate-sqlite-to-pg.ts
```

### 1.4 新增表（用量统计）

与现有表保持一致的 SQLite 风格，在 `src/lib/db/schema.ts` 中新增。详见 [第 2 节](#2-用量统计系统)。

---

## 2. 用量统计系统

### 2.1 设计原则

1. **先记录后控制** — 现阶段只埋点不限制，积累数据后再决定额度策略
2. **异步写入** — 用量记录不阻塞主流程，记录失败不影响用户操作
3. **预留扩展** — 数据结构支持未来的计费、限额、套餐功能
4. **最小侵入** — 在 LLM 调用的汇聚点埋点，不改每个业务函数

### 2.2 新增表

与现有表保持一致的 SQLite + Drizzle 风格。

#### `userQuotas` — 用户额度配置

```typescript
// src/lib/db/schema.ts 新增

export const userQuotas = sqliteTable("user_quotas", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),

  // 套餐: free | pro | enterprise | custom
  plan: text("plan").notNull().default("free"),

  // 月度限额
  monthlyTokenLimit: integer("monthly_token_limit").notNull().default(500000),  // 0=无限
  monthlyBuildLimit: integer("monthly_build_limit").notNull().default(20),
  storageLimitMb: integer("storage_limit_mb").notNull().default(100),

  // 当月累计用量 (每月自动重置)
  currentMonthTokens: integer("current_month_tokens").notNull().default(0),
  currentMonthBuilds: integer("current_month_builds").notNull().default(0),
  currentStorageMb: integer("current_storage_mb").notNull().default(0),
  periodStart: text("period_start").$defaultFn(() => new Date().toISOString()),

  // 扩展
  metadata: text("metadata"),  // JSON string

  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});
```

#### `usageLogs` — 用量明细

```typescript
export const usageLogs = sqliteTable("usage_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // 事件类型: llm_call | build | file_upload | entity_extract | relation_infer
  action: text("action").notNull(),

  // LLM 调用详情 (action=llm_call 时填写)
  provider: text("provider"),          // siliconflow | openrouter | anthropic
  model: text("model"),                // Pro/zai-org/GLM-5 等
  inputTokens: integer("input_tokens").default(0),
  outputTokens: integer("output_tokens").default(0),
  totalTokens: integer("total_tokens").default(0),
  durationMs: integer("duration_ms"),  // 调用耗时 (毫秒)

  // 上下文
  label: text("label"),                // 调用来源: chat-build, compile-spec 等
  siteId: text("site_id"),             // 关联的网站 (可选)
  status: text("status").default("success"),  // success | error
  errorMessage: text("error_message"),

  // 扩展
  metadata: text("metadata"),          // JSON string

  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

```

**索引（在 `db/index.ts` 的建表逻辑中添加）：**

```sql
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_time ON usage_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_action ON usage_logs(action, created_at);
```

### 2.3 用量记录模块

**新增文件: `src/lib/usage.ts`**

```typescript
import { db } from "@/lib/db";
import { usageLogs, userQuotas } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

// ---- 记录用量 ----

export interface UsageRecord {
  action: "llm_call" | "build" | "file_upload" | "entity_extract" | "relation_infer";
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  durationMs?: number;
  label?: string;
  siteId?: string;
  status?: "success" | "error";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 记录一次用量。异步执行，不阻塞调用方。
 */
export async function recordUsage(userId: string, record: UsageRecord): Promise<void> {
  try {
    // 1. 写入明细日志
    await db.insert(usageLogs).values({
      userId,
      action: record.action,
      provider: record.provider || null,
      model: record.model || null,
      inputTokens: record.inputTokens || 0,
      outputTokens: record.outputTokens || 0,
      totalTokens: record.totalTokens || 0,
      durationMs: record.durationMs || null,
      label: record.label || null,
      siteId: record.siteId || null,
      status: record.status || "success",
      errorMessage: record.errorMessage || null,
      metadata: record.metadata ? JSON.stringify(record.metadata) : null,
    });

    // 2. 更新月度累计 (确保 quota 记录存在)
    await ensureQuota(userId);

    const tokenDelta = record.totalTokens || 0;
    const buildDelta = record.action === "build" ? 1 : 0;

    if (tokenDelta > 0 || buildDelta > 0) {
      await db.update(userQuotas).set({
        currentMonthTokens: sql`current_month_tokens + ${tokenDelta}`,
        currentMonthBuilds: sql`current_month_builds + ${buildDelta}`,
        updatedAt: new Date().toISOString(),
      }).where(eq(userQuotas.userId, userId));
    }
  } catch (err) {
    // 记录失败不影响主流程
    logger.warn("usage", `Failed to record usage for ${userId}: ${err instanceof Error ? err.message : "unknown"}`);
  }
}

/**
 * 确保用户有 quota 记录。首次调用时创建默认 free 配额。
 */
async function ensureQuota(userId: string): Promise<void> {
  const existing = await db.select({ id: userQuotas.id })
    .from(userQuotas)
    .where(eq(userQuotas.userId, userId))
    .get();

  if (!existing) {
    await db.insert(userQuotas).values({
      userId,
      plan: "free",
      monthlyTokenLimit: 500000,
      monthlyBuildLimit: 20,
      storageLimitMb: 100,
    }).onConflictDoNothing();
  }
}

// ---- 周期重置 ----

/**
 * 检查是否需要重置月度计数。
 * 如果 periodStart 不在当前自然月，重置为 0。
 */
export async function maybeResetPeriod(userId: string): Promise<void> {
  const quota = await db.select({
    periodStart: userQuotas.periodStart,
  }).from(userQuotas).where(eq(userQuotas.userId, userId)).get();

  if (!quota) return;

  const now = new Date();
  const periodStart = new Date(quota.periodStart);
  const sameMonth = now.getFullYear() === periodStart.getFullYear()
    && now.getMonth() === periodStart.getMonth();

  if (!sameMonth) {
    await db.update(userQuotas).set({
      currentMonthTokens: 0,
      currentMonthBuilds: 0,
      periodStart: now.toISOString(),
      updatedAt: now.toISOString(),
    }).where(eq(userQuotas.userId, userId));
  }
}

// ---- 查询用量 ----

export interface UserUsageSummary {
  plan: string;
  monthlyTokenLimit: number;
  monthlyBuildLimit: number;
  currentMonthTokens: number;
  currentMonthBuilds: number;
  currentStorageMb: number;
  storageLimitMb: number;
  tokenUsagePercent: number;
  buildUsagePercent: number;
}

export async function getUserUsageSummary(userId: string): Promise<UserUsageSummary> {
  await ensureQuota(userId);
  await maybeResetPeriod(userId);

  const quota = await db.select().from(userQuotas)
    .where(eq(userQuotas.userId, userId)).get();

  if (!quota) throw new Error("Quota not found");

  return {
    plan: quota.plan,
    monthlyTokenLimit: quota.monthlyTokenLimit,
    monthlyBuildLimit: quota.monthlyBuildLimit,
    currentMonthTokens: quota.currentMonthTokens,
    currentMonthBuilds: quota.currentMonthBuilds,
    currentStorageMb: quota.currentStorageMb,
    storageLimitMb: quota.storageLimitMb,
    tokenUsagePercent: quota.monthlyTokenLimit > 0
      ? Math.round(quota.currentMonthTokens / quota.monthlyTokenLimit * 100)
      : 0,
    buildUsagePercent: quota.monthlyBuildLimit > 0
      ? Math.round(quota.currentMonthBuilds / quota.monthlyBuildLimit * 100)
      : 0,
  };
}
```

### 2.4 LLM 调用埋点

**改造 `src/lib/llm.ts`：**

在现有 `chatCompletion()` 函数中增加 userId 参数和自动记录：

```typescript
export async function chatCompletion(opts: {
  requestId: string;
  label: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  userId?: string;         // 新增
  siteId?: string;         // 新增
}): Promise<{ content: string; usage?: TokenUsage }> {

  const startTime = Date.now();

  // ... 现有的 LLM 调用逻辑 ...
  const result = await callProvider(provider, messages, opts);
  const durationMs = Date.now() - startTime;

  // 新增: 异步记录用量
  if (opts.userId) {
    import("./usage").then(({ recordUsage }) => {
      recordUsage(opts.userId!, {
        action: "llm_call",
        provider: currentProvider,
        model: currentModel,
        inputTokens: result.usage?.prompt_tokens,
        outputTokens: result.usage?.completion_tokens,
        totalTokens: result.usage?.total_tokens,
        durationMs,
        label: opts.label,
        siteId: opts.siteId,
      }).catch(() => {});
    });
  }

  return result;
}
```

**改造 `src/lib/build-agents.ts`：**

`callSiliconFlow()` 是所有 Agent 调用的汇聚点：

```typescript
async function callSiliconFlow(
  requestId: string,
  agentName: string,
  systemPrompt: string,
  userPrompt: string,
  extraMessages: Array<{ role: string; content: string }> = [],
  useAdvanced = false,
  userId?: string,         // 新增
  siteId?: string,         // 新增
): Promise<AgentRunResult> {
  // ... 现有调用逻辑 ...

  // 新增: 记录用量
  if (userId && result.usage) {
    import("./usage").then(({ recordUsage }) => {
      recordUsage(userId, {
        action: "llm_call",
        provider: useAdvanced ? "openrouter" : "siliconflow",
        model: useAdvanced ? advancedModel : defaultModel,
        inputTokens: result.usage.prompt_tokens,
        outputTokens: result.usage.completion_tokens,
        totalTokens: result.usage.total_tokens,
        label: agentName,
        siteId,
      }).catch(() => {});
    });
  }
}
```

### 2.5 完整埋点位置

| 文件 | 调用函数 | label | action |
|------|---------|-------|--------|
| `build-agents.ts` | `callSiliconFlow()` | 各 agent 名 | `llm_call` |
| `llm.ts` | `chatCompletion()` | 调用方传入 | `llm_call` |
| `analyze-source/route.ts` | `aiExtractKnowledge()` | `knowledge-extract` | `llm_call` |
| `kb/[baseId]/files/route.ts` | `generateFileDescription()` | `kb-describe` | `llm_call` |
| `build-runtime.ts` | `enrichWorkspaceDataFromKB()` | `kb-enrich` | `llm_call` |
| `build-runtime.ts` | 构建完成时 | `build` | `build` |
| `kb/[baseId]/files/route.ts` | 上传完成时 | `file-upload` | `file_upload` |
| **新增** `entity-extractor.ts` | `aiExtractEntities()` | `entity-extract` | `llm_call` |
| **新增** `entity-relations.ts` | `aiInferRelations()` | `relation-infer` | `llm_call` |

**核心汇聚点:** `callSiliconFlow()` 和 `chatCompletion()` 是两个最关键的埋点位置。在这两个函数加入 userId 参数后，覆盖率 > 95%。

---

## 3. 额度控制与计费扩展

### 3.1 额度检查（预留，暂不启用）

```typescript
// src/lib/usage.ts

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;        // 拒绝原因 (给用户看)
  remaining?: number;     // 剩余额度
  upgradeHint?: string;   // 升级提示
}

/**
 * 检查用户是否有足够额度执行操作。
 *
 * 现阶段: 始终返回 allowed=true，只记录不限制。
 * 后续启用: 取消下方注释即可生效。
 */
export async function checkQuota(
  userId: string,
  action: "llm_call" | "build" | "file_upload",
  estimatedTokens?: number,
): Promise<QuotaCheckResult> {
  await ensureQuota(userId);
  await maybeResetPeriod(userId);

  const quota = await db.select().from(userQuotas)
    .where(eq(userQuotas.userId, userId)).get();

  if (!quota) return { allowed: true };

  // ---- 现阶段: 始终放行 ----
  return { allowed: true };

  // ---- 后续启用: 取消以下注释 ----
  //
  // // Token 限额检查
  // if (action === "llm_call" && quota.monthlyTokenLimit > 0) {
  //   const remaining = quota.monthlyTokenLimit - quota.currentMonthTokens;
  //   if (remaining <= 0) {
  //     return {
  //       allowed: false,
  //       reason: `本月 Token 额度已用完 (${quota.currentMonthTokens.toLocaleString()} / ${quota.monthlyTokenLimit.toLocaleString()})`,
  //       remaining: 0,
  //       upgradeHint: quota.plan === "free" ? "升级到 Pro 获取更多额度" : undefined,
  //     };
  //   }
  //   // 预估检查: 如果剩余额度不够本次调用
  //   if (estimatedTokens && remaining < estimatedTokens) {
  //     return {
  //       allowed: false,
  //       reason: `剩余 Token 额度不足 (剩余 ${remaining.toLocaleString()}, 预计需要 ${estimatedTokens.toLocaleString()})`,
  //       remaining,
  //       upgradeHint: quota.plan === "free" ? "升级到 Pro 获取更多额度" : undefined,
  //     };
  //   }
  //   return { allowed: true, remaining };
  // }
  //
  // // 构建次数检查
  // if (action === "build" && quota.monthlyBuildLimit > 0) {
  //   if (quota.currentMonthBuilds >= quota.monthlyBuildLimit) {
  //     return {
  //       allowed: false,
  //       reason: `本月构建次数已用完 (${quota.currentMonthBuilds} / ${quota.monthlyBuildLimit})`,
  //       remaining: 0,
  //       upgradeHint: quota.plan === "free" ? "升级到 Pro 获取更多构建次数" : undefined,
  //     };
  //   }
  //   return { allowed: true, remaining: quota.monthlyBuildLimit - quota.currentMonthBuilds };
  // }
  //
  // // 存储检查
  // if (action === "file_upload" && quota.storageLimitMb > 0) {
  //   if (quota.currentStorageMb >= quota.storageLimitMb) {
  //     return {
  //       allowed: false,
  //       reason: `存储空间已满 (${quota.currentStorageMb}MB / ${quota.storageLimitMb}MB)`,
  //       remaining: 0,
  //       upgradeHint: "清理不需要的知识库文件，或升级套餐",
  //     };
  //   }
  //   return { allowed: true, remaining: quota.storageLimitMb - quota.currentStorageMb };
  // }
  //
  // return { allowed: true };
}
```

**启用限制时，在 API 路由中加一行：**

```typescript
// 示例: chat-build/route.ts
const check = await checkQuota(session.user.id, "llm_call");
if (!check.allowed) {
  return NextResponse.json({
    error: check.reason,
    quota: true,              // 前端据此显示额度提示 UI
    upgradeHint: check.upgradeHint,
  }, { status: 429 });
}
```

### 3.2 套餐体系（预留设计）

```
free (默认):
  Token: 500,000/月
  构建: 20 次/月
  存储: 100 MB
  模型: 基础模型 (SiliconFlow GLM-5)

pro:
  Token: 5,000,000/月
  构建: 200 次/月
  存储: 1 GB
  模型: 高级模型 (Claude Sonnet)
  优先构建队列

enterprise:
  Token: 无限
  构建: 无限
  存储: 10 GB
  模型: 最强模型 (Claude Opus)
  专属构建资源
  自定义域名部署

custom:
  管理员手动配置各项限额
```

**套餐变更流程（后续实现）：**

```
用户点击"升级" → 支付 (Stripe / 支付宝)
  → webhook 回调 → 更新 user_quotas.plan + 限额
  → 前端刷新额度显示
```

### 3.3 前端额度提示（预留设计）

**Dashboard 页面增加用量卡片：**

```
┌─────────────────────────────────────────────────┐
│  本月用量                                        │
│                                                  │
│  Token   45,230 / 500,000  ████░░░░░░ 9%       │
│  构建    8 / 20            ████████░░░ 40%      │
│  存储    23MB / 100MB      ██░░░░░░░░░ 23%     │
│                                                  │
│  套餐: 免费版                    [升级到 Pro →]  │
└─────────────────────────────────────────────────┘
```

**额度耗尽时的 Toast 提示：**

```
⚠️ 本月 Token 额度已用完 (500,000 / 500,000)
   升级到 Pro 获取 10 倍额度 [了解更多]
```

---

## 4. 管理后台增强

### 4.1 全局统计（admin 首页）

**改造 `GET /api/admin/stats`：**

```typescript
// 现有返回:
{ users, sites, skills, knowledgeItems, templates }

// 新增返回:
{
  users, sites, skills, knowledgeItems, templates,

  // Token 统计
  usage: {
    todayTokens: 125430,       // 今日 token 消耗
    monthTokens: 2340000,      // 本月 token 消耗
    todayBuilds: 23,           // 今日构建次数
    monthBuilds: 456,          // 本月构建次数
    todayCalls: 180,           // 今日 LLM 调用次数
    monthCalls: 3200,          // 本月 LLM 调用次数
    avgTokensPerBuild: 5131,   // 平均每次构建消耗
  },

  // Top 用户
  topUsers: [
    { id, email, monthTokens: 45230, monthBuilds: 8 },
    { id, email, monthTokens: 38100, monthBuilds: 12 },
    ...
  ],
}
```

**前端首页增加卡片：**

```
┌─────────────────────────────────────────────────────────┐
│  管理后台                                                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐              │
│  │ 128  │ │ 342  │ │ 10   │ │ 24   │ │ 1.2K │            │
│  │用户  │ │网站  │ │模板  │ │技能  │ │知识  │            │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘              │
│                                                          │
│  ┌───────────────────┐ ┌───────────────────┐            │
│  │ 今日 Token         │ │ 本月 Token         │            │
│  │ 125,430            │ │ 2,340,000          │            │
│  │ 180 次调用 · 23 构建│ │ 3200 次调用 · 456 构│            │
│  └───────────────────┘ └───────────────────┘            │
│                                                          │
│  Token 消耗 Top 用户 (本月)                               │
│  1. zhang@email.com    45,230 tokens   8 builds         │
│  2. li@email.com       38,100 tokens   12 builds        │
│  3. wang@email.com     22,500 tokens   5 builds         │
└─────────────────────────────────────────────────────────┘
```

### 4.2 用户管理增强

**改造 `GET /api/admin/users`：**

```typescript
// 现有返回:
[{ id, name, email, role, createdAt, siteCount, knowledgeCount }]

// 新增字段:
[{
  id, name, email, role, createdAt, siteCount, knowledgeCount,
  plan: "free",                    // 套餐
  monthTokens: 45230,             // 本月 token
  monthBuilds: 8,                 // 本月构建
  tokenUsagePercent: 9,           // 额度使用率
}]
```

**用户列表页增加列：**

```
┌──────────────────────────────────────────────────────────────────┐
│  用户管理                                                        │
├────────┬────────────────┬──────┬──────┬────────┬────────┬───────┤
│ 名称   │ 邮箱            │ 角色 │ 套餐  │ 本月Token │ 构建   │ 注册   │
├────────┼────────────────┼──────┼──────┼────────┼────────┼───────┤
│ 张三   │ zhang@mail.com │ user │ free │ 45.2K  │ 8/20   │ 03-15 │
│ 李四   │ li@mail.com    │ user │ pro  │ 38.1K  │ 12/200 │ 02-20 │
│ Admin  │ admin@site.com │ admin│ -    │ 2.1K   │ 1/∞    │ 01-01 │
└────────┴────────────────┴──────┴──────┴────────┴────────┴───────┘
```

### 4.3 用户详情页（新增）

**新增路由: `/admin/users/[id]`**
**新增 API: `GET /api/admin/users/[id]/usage`**

```typescript
// 返回:
{
  user: { id, name, email, role, createdAt },

  quota: {
    plan: "free",
    monthlyTokenLimit: 500000,
    currentMonthTokens: 45230,
    monthlyBuildLimit: 20,
    currentMonthBuilds: 8,
    storageLimitMb: 100,
    currentStorageMb: 23,
  },

  // 最近调用明细
  recentLogs: [
    {
      action: "llm_call",
      label: "chat-build",
      model: "Pro/zai-org/GLM-5",
      totalTokens: 1200,
      durationMs: 3400,
      createdAt: "2026-04-02T10:30:00Z",
    },
    ...
  ],

  // 月度趋势 (近 6 月)
  monthlyTrend: [
    { month: "2025-11", tokens: 0, builds: 0, calls: 0 },
    { month: "2025-12", tokens: 12000, builds: 3, calls: 45 },
    { month: "2026-01", tokens: 28000, builds: 6, calls: 89 },
    { month: "2026-02", tokens: 35000, builds: 8, calls: 120 },
    { month: "2026-03", tokens: 45230, builds: 8, calls: 156 },
    { month: "2026-04", tokens: 12300, builds: 3, calls: 42 },
  ],

  // 按 label 分布
  labelBreakdown: [
    { label: "chat-build", tokens: 22000, calls: 45 },
    { label: "compile-spec", tokens: 8000, calls: 12 },
    { label: "code-agent", tokens: 10000, calls: 8 },
    { label: "kb-describe", tokens: 3000, calls: 60 },
    { label: "knowledge-extract", tokens: 2230, calls: 5 },
  ],
}
```

**前端页面布局：**

```
┌─────────────────────────────────────────────────────────┐
│ ← 用户管理   张三 (zhang@email.com)                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  基本信息                    额度配置                     │
│  角色: user                  套餐: free       [调整]     │
│  注册: 2026-03-15            Token: 500,000/月           │
│  网站: 3 个                  构建: 20/月                 │
│  知识库: 2 个                存储: 100MB                 │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  本月用量                                                │
│                                                          │
│  Tokens ████░░░░░░ 9%      45,230 / 500,000            │
│  构建   ████████░░ 40%     8 / 20                      │
│  存储   ██░░░░░░░░ 23%     23MB / 100MB                │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  Token 消耗分布                                          │
│                                                          │
│  chat-build       ██████████████  22,000 (49%)          │
│  code-agent       ██████          10,000 (22%)          │
│  compile-spec     █████            8,000 (18%)          │
│  kb-describe      ██               3,000 (7%)           │
│  其他             █                2,230 (5%)            │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  月度趋势 (近 6 月)                                      │
│                                                          │
│  50K ┤                                                   │
│  40K ┤              █                                    │
│  30K ┤           █  █                                    │
│  20K ┤        █  █  █                                    │
│  10K ┤  █  █  █  █  █  █                                │
│    0 ┤──┴──┴──┴──┴──┴──┴──                              │
│       11  12  01  02  03  04                             │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  最近调用                                                │
│                                                          │
│  chat-build    GLM-5    1,200 tokens   3.4s   2分钟前   │
│  compile-spec  GLM-5      800 tokens   2.1s   5分钟前   │
│  kb-describe   GLM-5      150 tokens   0.8s   1小时前   │
│  code-agent    Claude    3,200 tokens   8.5s   1小时前   │
│  ...                                                     │
└─────────────────────────────────────────────────────────┘
```

### 4.4 管理员调整额度

**新增 API: `PUT /api/admin/users/[id]/quota`**

```typescript
// 请求:
{ plan: "pro", monthlyTokenLimit: 5000000, monthlyBuildLimit: 200 }

// 逻辑: 只有 admin 能调用, 直接更新 user_quotas
```

**前端: 用户详情页的 [调整] 按钮弹窗：**

```
┌────────────────────────────────────────┐
│  调整用户额度                           │
│                                        │
│  套餐:  [free ▾]  → [pro ▾]           │
│                                        │
│  月度 Token: [5,000,000]               │
│  月度构建:   [200]                     │
│  存储上限:   [1000] MB                 │
│                                        │
│           [取消]  [确认调整]            │
└────────────────────────────────────────┘
```

---

## 5. 实施计划

### 5.1 阶段划分

#### Phase 1: 用量统计基础 (2 天)

```
Day 1:
  1. schema.ts 新增 userQuotas, usageLogs 表定义
  2. db/index.ts 新增 CREATE TABLE + 索引
  3. 实现 src/lib/usage.ts (recordUsage, ensureQuota, maybeResetPeriod)
  4. 改造 llm.ts — chatCompletion() 增加 userId 和自动记录

Day 2:
  5. 改造 build-agents.ts — callSiliconFlow() 增加 userId
  6. 各 API 路由传入 userId 到 LLM 调用
  7. build-runtime.ts 构建完成时记录 action=build
  8. kb 文件上传时记录 action=file_upload
  9. 验证 usage_logs 数据正确写入
```

#### Phase 2: 管理后台增强 (2-3 天)

```
Day 3:
  1. GET /api/admin/stats 增加 usage 统计
  2. GET /api/admin/users 增加 plan, monthTokens 字段
  3. 前端 admin 首页增加 Token 统计卡片
  4. 前端用户列表增加额度列

Day 4:
  5. GET /api/admin/users/[id]/usage 新增
  6. PUT /api/admin/users/[id]/quota 新增
  7. 前端 /admin/users/[id] 用户详情页

Day 5 (可选):
  8. 月度趋势图表
  9. Label 分布图表
  10. 导出用量报表
```

#### Phase 3: 额度控制 (后续，按需启用)

```
  1. 取消 checkQuota() 中的注释
  2. 在需要限制的 API 路由中调用 checkQuota()
  3. 前端 429 响应处理 → 显示额度提示
  4. Dashboard 用量卡片
  5. 升级入口和支付集成
```

#### Phase 4: 数据库迁移 (未来，按需)

```
  触发条件: 多服务器部署 / 企业环境要求 / 并发用户 > 50
  1. schema.ts: sqliteTable → pgTable + 类型映射
  2. db/index.ts: better-sqlite3 → pg
  3. package.json: 依赖替换
  4. 数据迁移脚本
  预计工作量: 1-2 天
```

### 5.2 文件变更清单

#### 新增文件

```
src/lib/usage.ts                              用量记录 + 额度检查
src/app/api/admin/users/[id]/route.ts         用户详情
src/app/api/admin/users/[id]/usage/route.ts   用量明细
src/app/api/admin/users/[id]/quota/route.ts   额度调整
src/app/admin/users/[id]/page.tsx             用户详情页
```

#### 修改文件

```
src/lib/db/schema.ts               新增 userQuotas, usageLogs 表
src/lib/db/index.ts                新增建表 SQL + 索引
src/lib/llm.ts                     chatCompletion() 增加 userId 埋点
src/lib/build-agents.ts            callSiliconFlow() 增加 userId 埋点
src/app/api/admin/stats/route.ts   增加 usage 统计
src/app/api/admin/users/route.ts   增加 plan, token 字段
src/app/admin/page.tsx             首页增加 Token 卡片
src/app/admin/users/page.tsx       列表增加额度列
```
