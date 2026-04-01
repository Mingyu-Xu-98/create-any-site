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
  /** Use advanced model (for Design Agent / high-quality generation) */
  useAdvancedModel?: boolean;
}

interface ChatCompletionResult {
  content: string;
  usage?: unknown;
  provider: "anthropic" | "openrouter" | "siliconflow";
  model: string;
}

type ProviderConfig =
  | {
      provider: "anthropic";
      apiKey: string;
      baseUrl: string;
      model: string;
    }
  | {
      provider: "openrouter";
      apiKey: string;
      baseUrl: string;
      model: string;
      referer: string;
      title: string;
    }
  | {
      provider: "siliconflow";
      apiKey: string;
      baseUrl: string;
      model: string;
    };

function getAnthropicConfig(): ProviderConfig | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    provider: "anthropic",
    apiKey,
    baseUrl: (process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com").replace(/\/+$/, ""),
    model: process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-6-20250514",
  };
}

function getOpenRouterConfig(): ProviderConfig | null {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    provider: "openrouter",
    apiKey,
    baseUrl: (process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1").replace(/\/+$/, ""),
    model: process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4.1-mini",
    referer: process.env.OPENROUTER_HTTP_REFERER?.trim() || process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000",
    title: process.env.OPENROUTER_APP_NAME?.trim() || "CreateAnySite",
  };
}

function getSiliconFlowConfig(): ProviderConfig | null {
  const apiKey = process.env.SILICONFLOW_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    provider: "siliconflow",
    apiKey,
    baseUrl: "https://api.siliconflow.cn/v1",
    model: process.env.SILICONFLOW_MODEL?.trim() || "Pro/zai-org/GLM-5",
  };
}

/** Provider priority: Anthropic > OpenRouter > SiliconFlow */
function getProviderConfig() {
  return getAnthropicConfig() || getOpenRouterConfig() || getSiliconFlowConfig();
}

/** Get a stronger model config for advanced mode */
function getAdvancedProviderConfig(): ProviderConfig | null {
  // Priority 1: Anthropic native API (best quality for Claude models)
  const anthropicConfig = getAnthropicConfig();
  if (anthropicConfig) {
    const advancedModel = process.env.ADVANCED_MODEL?.trim() || "claude-sonnet-4-6-20250514";
    return { ...anthropicConfig, model: advancedModel };
  }
  // Priority 2: OpenRouter with Claude Sonnet 4.6
  const orConfig = getOpenRouterConfig();
  if (orConfig) {
    const advancedModel = process.env.ADVANCED_MODEL?.trim() || "anthropic/claude-sonnet-4-6";
    return { ...orConfig, model: advancedModel };
  }
  // Fallback: SiliconFlow
  return getSiliconFlowConfig();
}

/** Get provider config based on mode */
export function getProviderForMode(mode: "default" | "advanced" = "default"): ProviderConfig | null {
  return mode === "advanced" ? getAdvancedProviderConfig() : getProviderConfig();
}

export function getChatProviderSummary(): string {
  const config = getProviderConfig();
  if (!config) return "No LLM provider configured";
  return `${config.provider}:${config.model}`;
}

export function hasChatProvider(): boolean {
  return Boolean(getProviderConfig());
}

function shouldRetryNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /terminated|fetch failed|socket|econnreset|timeout|timed out|network|aborted|aborterror|this operation was aborted/i.test(message);
}

/** Call Anthropic Messages API (different format from OpenAI-compatible) */
async function callAnthropicProvider(config: ProviderConfig & { provider: "anthropic" }, input: ChatCompletionInput, messages: ChatMessage[]): Promise<ChatCompletionResult> {
  // Separate system message from conversation messages
  const systemContent = messages.filter(m => m.role === "system").map(m => m.content).join("\n\n");
  const conversationMessages = messages.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 240_000);
  try {
    const response = await fetch(`${config.baseUrl}/v1/messages`, {
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
      throw new Error(`${input.label} AI error (anthropic/${config.model}): ${response.status} ${text}`);
    }

    const result = await response.json();
    const content = result.content?.map((c: { type: string; text?: string }) => c.type === "text" ? c.text : "").join("") || "";
    return {
      content,
      usage: result.usage,
      provider: "anthropic",
      model: config.model,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Call OpenAI-compatible provider (OpenRouter / SiliconFlow) */
async function callOpenAICompatibleProvider(config: ProviderConfig, input: ChatCompletionInput, messages: ChatMessage[]): Promise<ChatCompletionResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };

  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = (config as { referer: string }).referer;
    headers["X-Title"] = (config as { title: string }).title;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 240_000);
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
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
      throw new Error(`${input.label} AI error (${config.provider}/${config.model}): ${response.status} ${text}`);
    }

    const result = await response.json();
    return {
      content: result.choices?.[0]?.message?.content || "",
      usage: result.usage,
      provider: config.provider,
      model: config.model,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callProvider(config: ProviderConfig, input: ChatCompletionInput, messages: ChatMessage[]): Promise<ChatCompletionResult> {
  if (config.provider === "anthropic") {
    return callAnthropicProvider(config as ProviderConfig & { provider: "anthropic" }, input, messages);
  }
  return callOpenAICompatibleProvider(config, input, messages);
}

export async function chatCompletion(input: ChatCompletionInput): Promise<ChatCompletionResult> {
  const config = input.useAdvancedModel ? (getAdvancedProviderConfig() || getProviderConfig()) : getProviderConfig();
  if (!config) {
    throw new Error("No LLM provider configured. Set ANTHROPIC_API_KEY, OPENROUTER_API_KEY, or SILICONFLOW_API_KEY.");
  }

  const history = input.history || [];
  const messages: ChatMessage[] = [
    { role: "system", content: input.systemPrompt },
    ...history,
    { role: "user", content: input.userPrompt },
  ];

  try {
    return await callProvider(config, input, messages);
  } catch (error) {
    if (!shouldRetryNetworkError(error)) throw error;
  }

  try {
    return await callProvider(config, input, messages);
  } catch (retryError) {
    if (!shouldRetryNetworkError(retryError)) throw retryError;
    // Fallback chain: try next available provider
    const fallback = config.provider === "anthropic"
      ? (getOpenRouterConfig() || getSiliconFlowConfig())
      : config.provider === "openrouter"
        ? getSiliconFlowConfig()
        : null;
    if (!fallback) throw retryError;
    return callProvider(fallback, input, messages);
  }
}
