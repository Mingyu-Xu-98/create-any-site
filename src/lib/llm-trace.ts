/**
 * LLM Trace — records every LLM call for debugging, replay, and eval.
 *
 * Why this exists:
 *   - When a build fails, you need to see the exact prompt the Code
 *     Agent received and what it produced. Without traces that context
 *     is lost the moment the request ends.
 *   - Eval harnesses need recorded input/output pairs to score.
 *   - Failure taxonomy needs per-call outcome tags to aggregate stats.
 *   - Trajectory replay needs the full prompt to re-run locally.
 *
 * Design choices:
 *   - Writes synchronously (better-sqlite3 is sync) but fire-and-forget
 *     from the call site. A failed trace write never blocks the LLM call.
 *   - Full prompts and responses are stored. At ~50-100KB per trace and
 *     ~1000 calls/day this is 50-100MB/day. A background sweeper prunes
 *     rows older than TRACE_RETENTION_DAYS (default 14).
 *   - The table is created via initDb in db/index.ts alongside the rest
 *     of the schema, so it exists from first import.
 *
 * Usage (automatic):
 *   chatCompletion() in llm.ts calls recordTrace() internally — any
 *   caller of chatCompletion gets tracing for free.
 *
 * Usage (manual, for direct-fetch callers):
 *   const span = startTrace({ phase: "site-chat", traceId: reqId, ... });
 *   // ... your fetch logic ...
 *   span.end({ content, provider, model, usage, outcome: "success" });
 *   // or on error:
 *   span.error(err);
 */

import { sqlite } from "@/lib/db";

// ---- Types ----

export interface TraceInput {
  traceId: string;          // groups all calls within one user request
  parentSpanId?: string;    // links retries (attempt 2 → attempt 1)
  phase: string;            // "planning" | "design" | "code" | "code-repair" | "compile-spec" | "site-chat" | "kb-describe" | "analyze" | "analyze-source" | "template-gen" | "generator-shared" | "verification"
  userId?: string;
  siteId?: string;
  buildId?: string;
}

export interface TraceEndInput {
  provider: string;
  model: string;
  systemPrompt?: string;
  userPrompt?: string;
  messages?: string;        // JSON-stringified full message array (for multi-turn)
  rawResponse?: string;     // full LLM output
  parsedOutput?: string;    // structured extraction if applicable
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  temperature?: number;
  maxTokens?: number;
  outcome?: string;         // "success" | "error" | "parse_error" | "guardrail_fix" | "build_fail" | "verification_fail"
  outcomeTags?: string[];   // failure taxonomy tags: ["CODE-001", "CODE-004"]
  errorMessage?: string;
}

export interface TraceSpan {
  spanId: string;
  startedAt: number;        // Date.now() at creation
  end(result: TraceEndInput): void;
  error(err: unknown, extra?: Partial<TraceEndInput>): void;
}

// ---- Prepared statements (lazy-init) ----

let insertStmt: ReturnType<typeof sqlite.prepare> | null = null;

function getInsertStmt() {
  if (!insertStmt) {
    insertStmt = sqlite.prepare(`
      INSERT INTO llm_traces (
        id, trace_id, parent_span_id, phase,
        provider, model,
        system_prompt, user_prompt, messages,
        raw_response, parsed_output,
        input_tokens, output_tokens, total_tokens,
        latency_ms, temperature, max_tokens,
        outcome, outcome_tags, error_message,
        user_id, site_id, build_id,
        created_at
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?
      )
    `);
  }
  return insertStmt;
}

// ---- Public API ----

/**
 * Start a trace span. Call .end() or .error() when the LLM call
 * finishes. If you forget to call either, nothing bad happens —
 * you just don't get a trace row for that call.
 */
export function startTrace(input: TraceInput): TraceSpan {
  const spanId = crypto.randomUUID().slice(0, 12);
  const startedAt = Date.now();

  return {
    spanId,
    startedAt,

    end(result: TraceEndInput) {
      const latencyMs = Date.now() - startedAt;
      safeInsert({
        id: spanId,
        traceId: input.traceId,
        parentSpanId: input.parentSpanId ?? null,
        phase: input.phase,
        provider: result.provider,
        model: result.model,
        systemPrompt: truncate(result.systemPrompt, 30_000),
        userPrompt: truncate(result.userPrompt, 60_000),
        messages: truncate(result.messages, 80_000),
        rawResponse: truncate(result.rawResponse, 60_000),
        parsedOutput: truncate(result.parsedOutput, 30_000),
        inputTokens: result.inputTokens ?? 0,
        outputTokens: result.outputTokens ?? 0,
        totalTokens: result.totalTokens ?? 0,
        latencyMs,
        temperature: result.temperature ?? null,
        maxTokens: result.maxTokens ?? null,
        outcome: result.outcome ?? "success",
        outcomeTags: result.outcomeTags ? JSON.stringify(result.outcomeTags) : null,
        errorMessage: result.errorMessage ?? null,
        userId: input.userId ?? null,
        siteId: input.siteId ?? null,
        buildId: input.buildId ?? null,
        createdAt: new Date().toISOString(),
      });
    },

    error(err: unknown, extra?: Partial<TraceEndInput>) {
      const latencyMs = Date.now() - startedAt;
      const msg = err instanceof Error ? err.message : String(err);
      safeInsert({
        id: spanId,
        traceId: input.traceId,
        parentSpanId: input.parentSpanId ?? null,
        phase: input.phase,
        provider: extra?.provider ?? "unknown",
        model: extra?.model ?? "unknown",
        systemPrompt: truncate(extra?.systemPrompt, 30_000),
        userPrompt: truncate(extra?.userPrompt, 60_000),
        messages: truncate(extra?.messages, 80_000),
        rawResponse: null,
        parsedOutput: null,
        inputTokens: extra?.inputTokens ?? 0,
        outputTokens: extra?.outputTokens ?? 0,
        totalTokens: extra?.totalTokens ?? 0,
        latencyMs,
        temperature: extra?.temperature ?? null,
        maxTokens: extra?.maxTokens ?? null,
        outcome: extra?.outcome ?? "error",
        outcomeTags: extra?.outcomeTags ? JSON.stringify(extra.outcomeTags) : null,
        errorMessage: msg.slice(0, 2000),
        userId: input.userId ?? null,
        siteId: input.siteId ?? null,
        buildId: input.buildId ?? null,
        createdAt: new Date().toISOString(),
      });
    },
  };
}

/**
 * One-shot convenience for callers that don't want the span pattern.
 * Records a complete trace in one call.
 */
export function recordTrace(
  input: TraceInput & TraceEndInput & { latencyMs: number },
): void {
  safeInsert({
    id: crypto.randomUUID().slice(0, 12),
    traceId: input.traceId,
    parentSpanId: input.parentSpanId ?? null,
    phase: input.phase,
    provider: input.provider,
    model: input.model,
    systemPrompt: truncate(input.systemPrompt, 30_000),
    userPrompt: truncate(input.userPrompt, 60_000),
    messages: truncate(input.messages, 80_000),
    rawResponse: truncate(input.rawResponse, 60_000),
    parsedOutput: truncate(input.parsedOutput, 30_000),
    inputTokens: input.inputTokens ?? 0,
    outputTokens: input.outputTokens ?? 0,
    totalTokens: input.totalTokens ?? 0,
    latencyMs: input.latencyMs,
    temperature: input.temperature ?? null,
    maxTokens: input.maxTokens ?? null,
    outcome: input.outcome ?? "success",
    outcomeTags: input.outcomeTags ? JSON.stringify(input.outcomeTags) : null,
    errorMessage: input.errorMessage ?? null,
    userId: input.userId ?? null,
    siteId: input.siteId ?? null,
    buildId: input.buildId ?? null,
    createdAt: new Date().toISOString(),
  });
}

// ---- Background sweeper ----

const TRACE_RETENTION_DAYS = Number(process.env.TRACE_RETENTION_DAYS || 14);
let sweepTimer: ReturnType<typeof setInterval> | null = null;

function startSweeper() {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    try {
      const cutoff = new Date(Date.now() - TRACE_RETENTION_DAYS * 86_400_000).toISOString();
      const result = sqlite.prepare("DELETE FROM llm_traces WHERE created_at < ?").run(cutoff);
      if ((result.changes ?? 0) > 0) {
        console.log(`[llm-trace] swept ${result.changes} traces older than ${TRACE_RETENTION_DAYS}d`);
      }
    } catch {
      // sweep is best-effort
    }
  }, 6 * 3_600_000); // every 6 hours
  sweepTimer.unref();
}

startSweeper();

// ---- Internals ----

interface TraceRow {
  id: string;
  traceId: string;
  parentSpanId: string | null;
  phase: string;
  provider: string;
  model: string;
  systemPrompt: string | null;
  userPrompt: string | null;
  messages: string | null;
  rawResponse: string | null;
  parsedOutput: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  temperature: number | null;
  maxTokens: number | null;
  outcome: string;
  outcomeTags: string | null;
  errorMessage: string | null;
  userId: string | null;
  siteId: string | null;
  buildId: string | null;
  createdAt: string;
}

function safeInsert(row: TraceRow): void {
  try {
    const params = [
      row.id, row.traceId, row.parentSpanId, row.phase,
      row.provider, row.model,
      row.systemPrompt, row.userPrompt, row.messages,
      row.rawResponse, row.parsedOutput,
      row.inputTokens, row.outputTokens, row.totalTokens,
      row.latencyMs, row.temperature, row.maxTokens,
      row.outcome, row.outcomeTags, row.errorMessage,
      row.userId, row.siteId, row.buildId,
      row.createdAt,
    ];
    getInsertStmt().run(params);
  } catch (err) {
    // Trace writes must NEVER crash the caller. Log and move on.
    console.error("[llm-trace] insert failed:", err instanceof Error ? err.message : String(err));
  }
}

function truncate(s: string | undefined | null, maxLen: number): string | null {
  if (!s) return null;
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + `\n...[truncated at ${maxLen} chars]`;
}
