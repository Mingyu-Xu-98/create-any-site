import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { sites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const { messages } = await req.json();

  // Verify the site exists (public chatbot — no user auth required, but site must exist)
  const site = await db.select({ id: sites.id }).from(sites).where(eq(sites.id, siteId)).get();
  if (!site) {
    return new Response(JSON.stringify({ error: "Site not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  }

  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  // Load site knowledge
  const knowledgePath = path.join(process.cwd(), "sites-data", siteId, "src", "data", "knowledge.json");
  let chunks: KnowledgeChunk[] = [];
  try {
    const raw = await fs.readFile(knowledgePath, "utf-8");
    const data = JSON.parse(raw);
    chunks = data.chunks || [];
  } catch {
    return new Response(JSON.stringify({ error: "Site knowledge not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
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
    const err = await response.text();
    return new Response(JSON.stringify({ error: err }), { status: response.status, headers: { "Content-Type": "application/json" } });
  }

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
          if (data === "[DONE]") { controller.close(); return; }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) controller.enqueue(encoder.encode(content));
          } catch {}
        }
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
