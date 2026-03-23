import { NextRequest, NextResponse } from "next/server";
import type { KnowledgeItem } from "@/lib/knowledge";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    logger.error("chat-build", `[${requestId}] SILICONFLOW_API_KEY not configured`);
    return NextResponse.json({ error: "SILICONFLOW_API_KEY not configured" }, { status: 500 });
  }

  const { messages, knowledge, currentSelections } = await req.json();
  logger.info("chat-build", `[${requestId}] Chat request: ${messages.length} messages, ${(knowledge as KnowledgeItem[]).filter(k => k.selected).length} knowledge items`);

  // Build knowledge context from selected items
  const knowledgeContext = (knowledge as KnowledgeItem[])
    .filter((k) => k.selected)
    .map((k) => `[${k.category}] ${k.title}: ${k.content}`)
    .join("\n\n");

  const systemPrompt = `You are a website building assistant. You help users create websites based on their knowledge base.

## Available Knowledge:
${knowledgeContext}

## Current Site Configuration:
${JSON.stringify(currentSelections || {}, null, 2)}

## Your Role:
1. Help users decide what kind of website to build based on their knowledge
2. Suggest site type, theme, layout based on the content
3. When the user confirms, output a JSON action block to update the configuration
4. Answer questions about the content or site building process

## Action Format:
When you need to update site configuration, include an action block in your response:
\`\`\`action
{
  "type": "update_config",
  "siteType": "portfolio|brand|blog|landing|custom",
  "theme": "cyberpunk|minimalist|ghibli|glassmorphism|retro|brutalist|cinematic|bold-creative|editorial|nature|gradient-mesh|neo-tokyo|tpl-business|tpl-resume-bold|tpl-resume-dark|tpl-blog|custom",
  "customTheme": "optional custom description"
}
\`\`\`

When ready to generate the site:
\`\`\`action
{
  "type": "generate",
  "siteType": "...",
  "theme": "...",
  "layout": "..."
}
\`\`\`

## Guidelines:
- Be concise but helpful
- Proactively suggest configurations based on the knowledge content
- If the knowledge looks like a developer's profile → suggest portfolio
- If it's a business/brand → suggest brand site
- If it's articles/content → suggest blog
- Always explain your suggestions briefly
- Respond in the same language the user uses (Chinese or English)`;

  const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "Pro/zai-org/GLM-5",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      temperature: 0.5,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    logger.error("chat-build", `[${requestId}] AI error: ${response.status}`, { response: errText.slice(0, 300) });
    return NextResponse.json({ error: `AI error: ${response.status} ${errText}` }, { status: 500 });
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || "";
  const tokenUsage = result.usage;

  logger.info("chat-build", `[${requestId}] AI response received`, {
    tokens: tokenUsage,
    responseLength: content.length,
  });

  // Extract action if present
  let action = null;
  const actionMatch = content.match(/```action\s*([\s\S]*?)```/);
  if (actionMatch) {
    try {
      action = JSON.parse(actionMatch[1].trim());
      logger.info("chat-build", `[${requestId}] Action detected: ${action.type}`, action);
    } catch {
      logger.warn("chat-build", `[${requestId}] Invalid action JSON in response`);
    }
  }

  return NextResponse.json({ content, action });
}
