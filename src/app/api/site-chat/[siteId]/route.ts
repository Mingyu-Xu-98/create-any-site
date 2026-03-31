import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";

interface KnowledgeChunk {
  topic: string;
  content: string;
}

function findRelevantChunks(question: string, chunks: KnowledgeChunk[]): string {
  const q = question.toLowerCase();
  const topicKeywords: Record<string, string[]> = {
    personal: ["name", "who", "介绍", "你是谁", "叫什么", "姓名", "邮箱", "email", "位置", "location"],
    skills: ["skill", "技能", "会什么", "擅长", "技术", "能力", "tools", "framework"],
    projects: ["project", "项目", "做过", "作品", "portfolio", "开发了"],
    experience: ["experience", "work", "经历", "工作", "公司", "company", "career", "job"],
    education: ["education", "school", "学校", "学历", "学位", "university", "毕业"],
    links: ["link", "链接", "github", "网站", "blog", "contact", "联系"],
  };

  const scored = chunks.map(chunk => {
    let score = 0;
    const keywords = topicKeywords[chunk.topic] || [];
    for (const kw of keywords) {
      if (q.includes(kw)) score += 3;
    }
    const words = q.split(/\s+/).filter(w => w.length > 1);
    for (const word of words) {
      if (chunk.content.toLowerCase().includes(word)) score += 1;
    }
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const personal = chunks.find(c => c.topic === "personal");
  const relevant = scored.filter(s => s.score > 0).slice(0, 3).map(s => s.chunk);

  if (relevant.length === 0) {
    return chunks.map(c => c.content).join("\n\n");
  }

  const selected = personal ? [personal, ...relevant.filter(c => c.topic !== "personal")] : relevant;
  return selected.map(c => c.content).join("\n\n");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const { messages } = await req.json();

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

  // Load site name from translations
  let siteName = "";
  try {
    const transPath = path.join(process.cwd(), "sites-data", siteId, "src", "i18n", "translations.ts");
    const transRaw = await fs.readFile(transPath, "utf-8");
    const nameMatch = transRaw.match(/"heyIm":\s*"[^"]*?([\u4e00-\u9fff]+|[A-Za-z ]+)/);
    if (nameMatch) siteName = nameMatch[1];
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
