/**
 * LLM Provider — unified, env-driven.
 *
 * All configuration in .env.local:
 *
 *   # Provider fallback chain (comma-separated, tried in order)
 *   LLM_PROVIDER_CHAIN=anthropic,openrouter,siliconflow
 *
 *   # Provider credentials & models
 *   ANTHROPIC_API_KEY=sk-ant-...
 *   ANTHROPIC_MODEL=claude-sonnet-4-20250514
 *
 *   OPENROUTER_API_KEY=sk-or-v1-...
 *   OPENROUTER_MODEL=anthropic/claude-sonnet-4.6
 *
 *   SILICONFLOW_API_KEY=sk-...
 *   SILICONFLOW_MODEL=Pro/zai-org/GLM-5
 *
 *   # Image generation
 *   IMAGE_PROVIDER=siliconflow
 *   IMAGE_MODEL=Kwai-Kolors/Kolors
 */

import { Agent } from "undici";
import { startTrace } from "@/lib/llm-trace";

// Node.js built-in fetch uses undici whose default headersTimeout/bodyTimeout
// is 300 s. LLM code-generation calls routinely exceed that, so we create a
// long-timeout dispatcher shared by all LLM fetches.
const LLM_TIMEOUT_MS = 1_200_000; // 20 min — Code Agent on slow providers can take 8-15 min

const llmDispatcher = new Agent({
  headersTimeout: LLM_TIMEOUT_MS,   // wait for first byte
  bodyTimeout: LLM_TIMEOUT_MS,      // wait for full body
  connect: { timeout: 30_000 },     // 30 s connection timeout
});

/** fetch() wrapper that bypasses Node.js undici's default 300 s timeout. */
function llmFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, dispatcher: llmDispatcher } as RequestInit);
}

type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface ChatCompletionInput {
  requestId: string;
  label: string;
  systemPrompt: string;
  userPrompt: string;
  history?: Array<{ role: Exclude<ChatRole, "system">; content: string }>;
  temperature?: number;
  maxTokens?: number;
  useAdvancedModel?: boolean;
  /** Pass userId to auto-record token usage */
  userId?: string;
  /** Optional site context for usage tracking */
  siteId?: string;
}

interface ChatCompletionResult {
  content: string;
  usage?: unknown;
  provider: string;
  model: string;
}

// ---- Provider configs ----

interface ProviderConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  style: "anthropic" | "openai";  // API format
  extraHeaders?: Record<string, string>;
}

const DEFAULTS: Record<string, { baseUrl: string; model: string; style: "anthropic" | "openai" }> = {
  anthropic: { baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-20250514", style: "anthropic" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "anthropic/claude-sonnet-4.6", style: "openai" },
  siliconflow: { baseUrl: "https://api.siliconflow.cn/v1", model: "Pro/zai-org/GLM-5", style: "openai" },
};

function env(key: string, fallback = ""): string {
  return process.env[key]?.trim() || fallback;
}

function buildProviderConfig(name: string): ProviderConfig | null {
  const prefix = name.toUpperCase();
  const apiKey = env(`${prefix}_API_KEY`);
  if (!apiKey) return null;

  const defaults = DEFAULTS[name];
  if (!defaults) return null;

  const config: ProviderConfig = {
    name,
    apiKey,
    baseUrl: env(`${prefix}_BASE_URL`, defaults.baseUrl).replace(/\/+$/, ""),
    model: env(`${prefix}_MODEL`, defaults.model),
    style: defaults.style,
  };

  // OpenRouter needs extra headers
  if (name === "openrouter") {
    config.extraHeaders = {
      "HTTP-Referer": env("OPENROUTER_HTTP_REFERER") || env("NEXTAUTH_URL") || "http://localhost:3000",
      "X-Title": env("OPENROUTER_APP_NAME") || "CreateAnySite",
    };
  }

  return config;
}

/** Read provider chain from env, default: anthropic,openrouter,siliconflow */
function getProviderChain(): ProviderConfig[] {
  const chainStr = env("LLM_PROVIDER_CHAIN", "anthropic,openrouter,siliconflow");
  const names = chainStr.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  const configs: ProviderConfig[] = [];
  for (const name of names) {
    const config = buildProviderConfig(name);
    if (config) configs.push(config);
  }
  return configs;
}

// ---- Public helpers ----

export function hasChatProvider(): boolean {
  return getProviderChain().length > 0;
}

export function getChatProviderSummary(): string {
  const chain = getProviderChain();
  if (chain.length === 0) return "No LLM provider configured";
  return chain.map(c => `${c.name}:${c.model}`).join(" → ");
}

export function getProviderForMode(_mode: "default" | "advanced" = "default"): ProviderConfig | null {
  const chain = getProviderChain();
  return chain[0] || null;
}

/** Image generation config */
export function getImageProviderConfig(): { provider: string; apiKey: string; baseUrl: string; model: string } | null {
  const provider = env("IMAGE_PROVIDER", "siliconflow");
  const prefix = provider.toUpperCase();
  const apiKey = env(`${prefix}_API_KEY`);
  if (!apiKey) return null;
  const defaults = DEFAULTS[provider];
  return {
    provider,
    apiKey,
    baseUrl: env(`${prefix}_BASE_URL`, defaults?.baseUrl || ""),
    model: env("IMAGE_MODEL") || env("SILICONFLOW_IMAGE_MODELS") || "Kwai-Kolors/Kolors",
  };
}

// ---- API callers ----

async function callAnthropic(config: ProviderConfig, input: ChatCompletionInput, messages: ChatMessage[]): Promise<ChatCompletionResult> {
  const systemContent = messages.filter(m => m.role === "system").map(m => m.content).join("\n\n");
  const conversationMessages = messages.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const response = await llmFetch(`${config.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        max_tokens: input.maxTokens ?? 8192,
        temperature: input.temperature ?? 0.35,
        ...(systemContent ? { system: systemContent } : {}),
        messages: conversationMessages,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${input.label} error (${config.name}/${config.model}): ${response.status} ${text}`);
    }

    const result = await response.json();
    const content = result.content?.map((c: { type: string; text?: string }) => c.type === "text" ? c.text : "").join("") || "";
    return { content, usage: result.usage, provider: config.name, model: config.model };
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAICompatible(config: ProviderConfig, input: ChatCompletionInput, messages: ChatMessage[]): Promise<ChatCompletionResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
    ...config.extraHeaders,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const response = await llmFetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: input.temperature ?? 0.35,
        max_tokens: input.maxTokens ?? 8192,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${input.label} error (${config.name}/${config.model}): ${response.status} ${text}`);
    }

    const result = await response.json();
    return {
      content: result.choices?.[0]?.message?.content || "",
      usage: result.usage,
      provider: config.name,
      model: config.model,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callProvider(config: ProviderConfig, input: ChatCompletionInput, messages: ChatMessage[]): Promise<ChatCompletionResult> {
  if (config.style === "anthropic") return callAnthropic(config, input, messages);
  return callOpenAICompatible(config, input, messages);
}

function isFallbackEligible(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  // Network errors
  if (/terminated|fetch failed|socket|econnreset|timeout|timed out|network|aborted|aborterror|this operation was aborted/i.test(message)) return true;
  // Provider-specific billing/rate errors — next provider may succeed
  if (/\b(402|429|503|529)\b/.test(message)) return true;
  if (/credits|quota|rate.?limit|overloaded|capacity/i.test(message)) return true;
  return false;
}

// ---- Main entry point ----

export async function chatCompletion(input: ChatCompletionInput): Promise<ChatCompletionResult> {
  const chain = getProviderChain();
  if (chain.length === 0) {
    throw new Error("No LLM provider configured. Set ANTHROPIC_API_KEY, OPENROUTER_API_KEY, or SILICONFLOW_API_KEY in .env.local, and optionally LLM_PROVIDER_CHAIN to control fallback order.");
  }

  const history = input.history || [];
  const messages: ChatMessage[] = [
    { role: "system", content: input.systemPrompt },
    ...history,
    { role: "user", content: input.userPrompt },
  ];

  const startTime = Date.now();

  // Start a trace span — automatically records prompt, response, latency,
  // outcome on success or error. The trace write is fire-and-forget and
  // never blocks or crashes the LLM call.
  const span = startTrace({
    traceId: input.requestId,
    phase: input.label,
    userId: input.userId,
    siteId: input.siteId,
  });

  // Try each provider in chain order
  let lastError: Error | null = null;
  for (const config of chain) {
    try {
      const result = await callProvider(config, input, messages);

      // Auto-record usage when userId is provided
      if (input.userId) {
        const durationMs = Date.now() - startTime;
        const usage = result.usage as Record<string, number> | undefined;
        import("./usage").then(({ recordUsage }) => {
          recordUsage(input.userId!, {
            action: "llm_call",
            provider: result.provider,
            model: result.model,
            inputTokens: usage?.prompt_tokens || usage?.input_tokens || 0,
            outputTokens: usage?.completion_tokens || usage?.output_tokens || 0,
            totalTokens: usage?.total_tokens || 0,
            durationMs,
            label: input.label,
            siteId: input.siteId,
          }).catch(() => {});
        });
      }

      // Record successful trace
      const usage = result.usage as Record<string, number> | undefined;
      span.end({
        provider: result.provider,
        model: result.model,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
        messages: history.length > 0 ? JSON.stringify(history) : undefined,
        rawResponse: result.content,
        inputTokens: usage?.prompt_tokens || usage?.input_tokens || 0,
        outputTokens: usage?.completion_tokens || usage?.output_tokens || 0,
        totalTokens: usage?.total_tokens || 0,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        outcome: "success",
      });

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const eligible = isFallbackEligible(error);
      // Always log provider failures so we can see the fallback chain in action
      console.warn(`[llm] ${input.label} failed on ${config.name}/${config.model}: ${lastError.message.slice(0, 200)}${eligible ? " → trying next provider" : " (non-retryable)"}`);
      // Fallback to next provider on network, billing, and rate-limit errors.
      // Auth errors (401/403) are not retried — they indicate misconfiguration.
      if (!eligible && chain.indexOf(config) === 0) {
        span.error(lastError, {
          provider: config.name,
          model: config.model,
          systemPrompt: input.systemPrompt,
          userPrompt: input.userPrompt,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
        });
        throw lastError;
      }
      // Try next provider
    }
  }

  // All providers failed — record error trace
  span.error(lastError || new Error("All LLM providers failed"), {
    provider: chain[chain.length - 1]?.name ?? "unknown",
    model: chain[chain.length - 1]?.model ?? "unknown",
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
  });

  throw lastError || new Error("All LLM providers failed");
}
