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
}

interface ChatCompletionResult {
  content: string;
  usage?: unknown;
  provider: "openrouter" | "siliconflow";
  model: string;
}

type ProviderConfig =
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

function getProviderConfig() {
  return getOpenRouterConfig() || getSiliconFlowConfig();
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

async function callProvider(config: ProviderConfig, input: ChatCompletionInput, messages: ChatMessage[]): Promise<ChatCompletionResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };

  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = config.referer;
    headers["X-Title"] = config.title;
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

export async function chatCompletion(input: ChatCompletionInput): Promise<ChatCompletionResult> {
  const config = getProviderConfig();
  if (!config) {
    throw new Error("No LLM provider configured. Set OPENROUTER_API_KEY or SILICONFLOW_API_KEY.");
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
    if (config.provider !== "openrouter" || !shouldRetryNetworkError(retryError)) throw retryError;
    const fallback = getSiliconFlowConfig();
    if (!fallback) throw retryError;
    return callProvider(fallback, input, messages);
  }
}
