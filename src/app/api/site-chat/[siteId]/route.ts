import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { sites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { internalErrorWithHeaders } from "@/lib/api-errors";
import { startTrace } from "@/lib/llm-trace";

// Rate limit configuration — override at deploy time via env vars.
// Defaults are intentionally conservative for a public chatbot endpoint
// that calls SiliconFlow on every POST. A normal human visitor sends at
// most a few messages per minute; these limits leave plenty of headroom
// for real use while blocking any automated abuse long before it becomes
// expensive.
const RL_IP_PER_MIN = Number(process.env.SITE_CHAT_RL_IP_PER_MIN || 15);
const RL_SITE_PER_MIN = Number(process.env.SITE_CHAT_RL_SITE_PER_MIN || 60);
const RL_SITE_PER_DAY = Number(process.env.SITE_CHAT_RL_SITE_PER_DAY || 1000);

interface KnowledgeChunk {
  topic: string;
  content: string;
}

function findRelevantChunks(question: string, chunks: KnowledgeChunk[]): string {
  if (chunks.length === 0) return "";
  // If total knowledge is small enough, just return everything
  const totalLen = chunks.reduce((a, c) => a + c.content.length, 0);
  if (totalLen < 6000) return chunks.map(c => c.content).join("\n\n");

  const q = question.toLowerCase();
  const topicKeywords: Record<string, string[]> = {
    personal: ["name", "who", "介绍", "你是谁", "叫什么", "姓名", "邮箱", "email", "位置", "location", "about", "关于"],
    skills: ["skill", "技能", "会什么", "擅长", "技术", "能力", "tools", "framework", "stack"],
    projects: ["project", "项目", "做过", "作品", "portfolio", "开发了", "案例"],
    experience: ["experience", "work", "经历", "工作", "公司", "company", "career", "job", "实习"],
    education: ["education", "school", "学校", "学历", "学位", "university", "毕业"],
    links: ["link", "链接", "github", "网站", "blog", "contact", "联系"],
  };

  const scored = chunks.map(chunk => {
    let score = 0;
    // Match by topic name (known categories)
    const keywords = topicKeywords[chunk.topic] || [];
    for (const kw of keywords) {
      if (q.includes(kw)) score += 3;
    }
    // Also match topic name against category keywords (KB chunks may use file names as topics)
    const topicLower = chunk.topic.toLowerCase();
    for (const [, kws] of Object.entries(topicKeywords)) {
      for (const kw of kws) {
        if (topicLower.includes(kw) && q.includes(kw)) score += 2;
      }
    }
    // Content keyword matching
    const words = q.split(/[\s，。？！,?!]+/).filter(w => w.length > 1);
    for (const word of words) {
      if (chunk.content.toLowerCase().includes(word)) score += 1;
    }
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const relevant = scored.filter(s => s.score > 0).slice(0, 4).map(s => s.chunk);

  if (relevant.length === 0) {
    // No specific match — return all chunks (truncated)
    return chunks.map(c => c.content).join("\n\n").slice(0, 6000);
  }

  return relevant.map(c => c.content).join("\n\n").slice(0, 6000);
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const { messages } = await req.json();

  // Verify the site exists (public chatbot — no user auth required, but site must exist)
  const site = await db.select({ id: sites.id }).from(sites).where(eq(sites.id, siteId)).get();
  if (!site) {
    return new Response(JSON.stringify({ error: "Site not found" }), { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }

  // ─── Rate limiting ─────────────────────────────────────────────────────
  // Three layers, first hit rejects:
  //   1. per-IP per-minute    — caps single-actor bursts
  //   2. per-site per-minute  — caps concurrent traffic on one popular site
  //   3. per-site per-day     — hard daily ceiling per site (runaway guard)
  // All three counters share the in-memory store in src/lib/rate-limit.ts.
  // State is per-process, single-instance — acceptable for the current
  // single-Node deployment. Revisit when scaling web horizontally.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const rateLimitChecks = [
    { key: `site-chat:ip:${ip}`, limit: RL_IP_PER_MIN, windowMs: 60_000, layer: "ip-per-minute" },
    { key: `site-chat:site:${siteId}`, limit: RL_SITE_PER_MIN, windowMs: 60_000, layer: "site-per-minute" },
    { key: `site-chat:site-day:${siteId}`, limit: RL_SITE_PER_DAY, windowMs: 86_400_000, layer: "site-per-day" },
  ];
  for (const check of rateLimitChecks) {
    const result = checkRateLimit(check.key, check.limit, check.windowMs);
    if (!result.ok) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          layer: check.layer,
          limit: check.limit,
          retryAfterSec: result.retryAfterSec,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(result.retryAfterSec),
            "X-RateLimit-Limit": String(check.limit),
            "X-RateLimit-Layer": check.layer,
            ...CORS_HEADERS,
          },
        },
      );
    }
  }

  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key not configured" }), { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }

  // Load site knowledge
  const knowledgePath = path.join(process.cwd(), "sites-data", siteId, "src", "data", "knowledge.json");
  let chunks: KnowledgeChunk[] = [];
  try {
    const raw = await fs.readFile(knowledgePath, "utf-8");
    const data = JSON.parse(raw);
    chunks = data.chunks || [];
  } catch {
    return new Response(JSON.stringify({ error: "Site knowledge not found" }), { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }

  // Load site name from translations — try multiple key patterns
  let siteName = "";
  try {
    const transPath = path.join(process.cwd(), "sites-data", siteId, "src", "i18n", "translations.ts");
    const transRaw = await fs.readFile(transPath, "utf-8");
    // Try patterns in priority order: hero.name (advanced mode), heyIm (legacy), name at top level
    const patterns = [
      /hero:\s*\{[^}]*?name:\s*"([^"]+)"/,           // hero: { name: "..." }
      /"name":\s*"([^"]+)"/,                           // "name": "..."
      /name:\s*"([^"]+)"/,                             // name: "..."
      /"heyIm":\s*"[^"]*?([\u4e00-\u9fff]+|[A-Za-z ]+)/, // legacy heyIm
    ];
    for (const p of patterns) {
      const m = transRaw.match(p);
      if (m) { siteName = m[1]; break; }
    }
  } catch {}

  const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === "user")?.content || "";
  const relevantKnowledge = findRelevantChunks(lastUserMsg, chunks);

  const systemPrompt = `You are ${siteName || "the site owner"}'s AI avatar. Answer based on the following profile knowledge. Use first person. Be concise (under 200 words). If the user speaks Chinese, reply in Chinese. If in English, reply in English.

${relevantKnowledge}`;

  // ── Trace: start span before LLM call ──
  const traceSpan = startTrace({
    traceId: crypto.randomUUID().slice(0, 8),
    phase: "site-chat",
    siteId,
  });

  const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "Pro/Qwen/Qwen2.5-7B-Instruct",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.7,
      max_tokens: 1024,
      stream: true,
    }),
  });

  if (!response.ok) {
    // Log upstream error body server-side but NEVER leak it to the
    // public chatbot caller — it can contain siliconflow internals.
    const upstreamBody = await response.text();
    const upstreamErr = new Error(`siliconflow ${response.status}: ${upstreamBody.slice(0, 500)}`);
    traceSpan.error(upstreamErr, {
      provider: "siliconflow", model: "Pro/Qwen/Qwen2.5-7B-Instruct",
      systemPrompt, userPrompt: lastUserMsg,
      temperature: 0.7, maxTokens: 1024,
    });
    return internalErrorWithHeaders(
      upstreamErr,
      "site-chat",
      CORS_HEADERS,
      { clientMessage: "Chat service temporarily unavailable", status: 502 },
    );
  }

  // Accumulate streamed content for the trace
  let fullContent = "";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") {
            // ── Trace: record on stream complete ──
            traceSpan.end({
              provider: "siliconflow", model: "Pro/Qwen/Qwen2.5-7B-Instruct",
              systemPrompt, userPrompt: lastUserMsg,
              rawResponse: fullContent,
              temperature: 0.7, maxTokens: 1024,
              outcome: "success",
            });
            controller.close();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              controller.enqueue(encoder.encode(content));
            }
          } catch {}
        }
      }
      // Stream ended without [DONE] — still record what we got
      traceSpan.end({
        provider: "siliconflow", model: "Pro/Qwen/Qwen2.5-7B-Instruct",
        systemPrompt, userPrompt: lastUserMsg,
        rawResponse: fullContent,
        temperature: 0.7, maxTokens: 1024,
        outcome: "success",
      });
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", ...CORS_HEADERS } });
}
