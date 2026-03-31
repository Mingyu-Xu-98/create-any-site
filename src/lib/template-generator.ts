import fs from "fs/promises";
import path from "path";
import type { WorkspaceData, UserSelections, ThemeStyle } from "./types";
import { getInstalledNextVersion } from "./next-version";

const TEMPLATES_BASE = path.join(process.cwd(), "..", "create-any-web");

const TEMPLATE_STYLES: ThemeStyle[] = [
  "tpl-business",
];

export function isTemplateStyle(theme: ThemeStyle | null): boolean {
  return !!theme && TEMPLATE_STYLES.includes(theme);
}

// Map template ID to directory path (Next.js templates)
const NEXTJS_TEMPLATE_DIRS: Partial<Record<ThemeStyle, string>> = {
  "tpl-business": "portfolio-templates/bussiness-portfolio",
};

export async function generateFromTemplate(
  data: WorkspaceData,
  selections: UserSelections,
): Promise<Record<string, string>> {
  const theme = selections.theme!;
  const files: Record<string, string> = {};

  // Common config files (same as regular generator)
  files["package.json"] = genTemplatePackageJson();
  files["next.config.ts"] = `import type { NextConfig } from "next";\nconst nextConfig: NextConfig = {};\nexport default nextConfig;\n`;
  files["tsconfig.json"] = genTemplateTsConfig();
  files["postcss.config.mjs"] = `const config = { plugins: { "@tailwindcss/postcss": {} } };\nexport default config;\n`;
  files[".gitignore"] = "node_modules/\n.next/\n.env.local\n.DS_Store\n";

  const templateDir = NEXTJS_TEMPLATE_DIRS[theme];
  if (templateDir) {
    // ---- Next.js template: read source files from disk ----
    await copyNextjsTemplate(path.join(TEMPLATES_BASE, templateDir), files);
  }

  // Generate data-dependent files (overwrite template's originals)
  files["src/i18n/translations.ts"] = genTemplateTranslations(data);

  // Chat API route
  files["src/app/api/chat/route.ts"] = genTemplateChatRoute(data);

  return files;
}

// ---- Copy Next.js template files ----

async function copyNextjsTemplate(
  templateDir: string,
  files: Record<string, string>,
): Promise<void> {
  const srcDir = path.join(templateDir, "src");
  await walkDir(srcDir, async (filePath) => {
    const relativePath = path.relative(templateDir, filePath);
    // Skip translations — we generate our own
    if (relativePath === path.join("src", "i18n", "translations.ts")) return;
    const content = await fs.readFile(filePath, "utf-8");
    files[relativePath] = content;
  });

  // Also copy public/ if it exists
  const publicDir = path.join(templateDir, "public");
  try {
    await fs.access(publicDir);
    await walkDir(publicDir, async (filePath) => {
      const relativePath = path.relative(templateDir, filePath);
      const content = await fs.readFile(filePath, "utf-8");
      files[relativePath] = content;
    });
  } catch {
    // public/ may not exist — that's fine
  }
}

async function walkDir(
  dir: string,
  callback: (filePath: string) => Promise<void>,
): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(fullPath, callback);
    } else if (entry.isFile()) {
      await callback(fullPath);
    }
  }
}

// ---- Convert single HTML file to Next.js ----

async function convertHtmlTemplate(
  htmlPath: string,
  files: Record<string, string>,
): Promise<void> {
  const html = await fs.readFile(htmlPath, "utf-8");

  // Extract <style> content
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const cssContent = styleMatch ? styleMatch[1].trim() : "";

  // Extract <body> content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let bodyContent = bodyMatch ? bodyMatch[1].trim() : "";

  // Extract <script> content(s)
  const scriptMatches = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  const scriptContent = scriptMatches
    .map((m) => m[1].trim())
    .filter(Boolean)
    .join("\n\n");

  // Remove <script> tags from body content
  bodyContent = bodyContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").trim();

  // Extract font links from <head>
  const fontLinks = [...html.matchAll(/<link[^>]*href="([^"]*fonts\.googleapis[^"]*)"[^>]*>/gi)];
  const fontUrls = fontLinks.map((m) => m[1]);

  // globals.css
  files["src/app/globals.css"] = `@import "tailwindcss";\n\n${cssContent}\n`;

  // layout.tsx
  const fontImports = fontUrls.length > 0
    ? fontUrls.map((url) => `<link rel="preconnect" href="https://fonts.googleapis.com" />\n            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />\n            <link href="${url}" rel="stylesheet" />`).join("\n            ")
    : "";

  files["src/app/layout.tsx"] = `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "My Portfolio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        ${fontImports ? fontImports : ""}
      </head>
      <body>{children}</body>
    </html>
  );
}
`;

  // Client-side script component
  if (scriptContent) {
    const escapedScript = scriptContent.replace(/`/g, "\\`").replace(/\$/g, "\\$");
    files["src/components/ClientScripts.tsx"] = `"use client";

import { useEffect } from "react";

export default function ClientScripts() {
  useEffect(() => {
    const fn = new Function(\`${escapedScript}\`);
    fn();
  }, []);
  return null;
}
`;
  }

  // page.tsx
  const escapedBody = bodyContent.replace(/`/g, "\\`").replace(/\$/g, "\\$");
  const scriptImport = scriptContent
    ? `import ClientScripts from "@/components/ClientScripts";\n`
    : "";
  const scriptTag = scriptContent ? `\n      <ClientScripts />` : "";

  files["src/app/not-found.tsx"] = `export default function NotFound() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <h1>404 - Page Not Found</h1>
    </div>
  );
}
`;

  files["src/app/page.tsx"] = `${scriptImport}
export default function Home() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: \`${escapedBody}\` }} />${scriptTag}
    </>
  );
}
`;
}

// ---- Data-dependent generators ----

function genTemplateTranslations(data: WorkspaceData): string {
  const year = new Date().getFullYear();

  const zhProjects = data.projects.map((p) => ({
    title: p.title,
    org: p.org,
    badge: p.badge || "",
    desc: p.desc,
    tags: p.tags,
    image: p.image,
  }));
  const enProjects = data.projectsEn.map((p) => ({
    title: p.title,
    org: p.org,
    badge: p.badge || "",
    desc: p.desc,
    tags: p.tags,
    image: p.image,
  }));

  const zhTimeline = data.timeline.map((t) => ({
    date: t.date,
    title: t.title,
    desc: t.desc,
    active: t.active || false,
  }));
  const enTimeline = data.timelineEn.map((t) => ({
    date: t.date,
    title: t.title,
    desc: t.desc,
    active: t.active || false,
  }));

  const zhSkills = data.skills.map((s) => ({
    title: s.title,
    skills: s.skills,
  }));
  const enSkills = data.skillsEn.map((s) => ({
    title: s.title,
    skills: s.skills,
  }));

  const zhEducation = data.education.map((e) => ({
    school: e.school,
    degree: e.degree,
    highlights: e.highlights,
  }));
  const enEducation = data.educationEn.map((e) => ({
    school: e.school,
    degree: e.degree,
    highlights: e.highlights,
  }));

  const obj = {
    zh: {
      nav: {
        projects: "项目",
        timeline: "经历",
        skills: "技能",
        education: "教育",
        contact: "联系",
      },
      hero: {
        lines: [
          "> Hello World",
          `> ${data.name}`,
          `> ${data.title}`,
          `> ${data.location} · ${data.email}`,
        ],
        tags: data.tags,
      },
      sections: {
        projects: "项目作品",
        timeline: "时间线",
        skills: "技术栈",
        education: "教育背景",
        contact: "联系方式",
      },
      projects: zhProjects,
      timeline: zhTimeline,
      skills: zhSkills,
      education: zhEducation,
      footer: `\u00A9 ${year} ${data.name}`,
      chatbot: {
        title: "AI 助手",
        subtitle: `和 ${data.name} 的 AI 分身聊天`,
        welcome: `你好！我是 ${data.name} 的 AI 助手，有什么想了解的？`,
        placeholder: "输入你的问题...",
        send: "发送",
        tooltip: "和 AI 聊天",
        suggestions: ["介绍一下你自己", "你有哪些项目经验？", "你的技术栈是什么？"],
      },
    },
    en: {
      nav: {
        projects: "Projects",
        timeline: "Timeline",
        skills: "Skills",
        education: "Education",
        contact: "Contact",
      },
      hero: {
        lines: [
          "> Hello World",
          `> ${data.nameEn}`,
          `> ${data.titleEn}`,
          `> ${data.locationEn} · ${data.email}`,
        ],
        tags: data.tagsEn,
      },
      sections: {
        projects: "Projects",
        timeline: "Timeline",
        skills: "Skills",
        education: "Education",
        contact: "Contact",
      },
      projects: enProjects,
      timeline: enTimeline,
      skills: enSkills,
      education: enEducation,
      footer: `\u00A9 ${year} ${data.nameEn}`,
      chatbot: {
        title: "AI Assistant",
        subtitle: `Chat with ${data.nameEn}'s AI avatar`,
        welcome: `Hi! I'm ${data.nameEn}'s AI assistant. What would you like to know?`,
        placeholder: "Type your question...",
        send: "Send",
        tooltip: "Chat with AI",
        suggestions: ["Tell me about yourself", "What projects have you worked on?", "What's your tech stack?"],
      },
    },
  };

  return `export const translations = ${JSON.stringify(obj, null, 2)};\n`;
}

function genTemplateChatRoute(data: WorkspaceData): string {
  const ctx = data.chatbotContext.replace(/`/g, "\\`").replace(/\$/g, "\\$");
  return `import { NextRequest } from "next/server";

const SYSTEM_PROMPT = \`You are ${data.name}'s AI avatar. Answer based on the following profile. Use first person. Be concise (under 200 words).

${ctx}\`;

export async function POST(req: NextRequest) {
  const { messages } = await req.json();
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key not configured. Set SILICONFLOW_API_KEY in .env.local" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: \`Bearer \${apiKey}\` },
    body: JSON.stringify({
      model: "Pro/zai-org/GLM-5",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.7, max_tokens: 1024, stream: true,
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
        const lines = buffer.split("\\n");
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
`;
}

// ---- Config file generators (same as regular generator) ----

function genTemplatePackageJson(): string {
  const nextVersion = getInstalledNextVersion();
  return JSON.stringify({
    name: "my-portfolio",
    version: "1.0.0",
    type: "module",
    scripts: { dev: "next dev", build: "next build", start: "next start" },
    dependencies: {
      "@tailwindcss/postcss": "^4.2.1",
      "@types/node": "^25.4.0",
      "@types/qrcode": "^1.5.5",
      "@types/react": "^19.2.14",
      dijkstrajs: "^1.0.3",
      next: nextVersion,
      pngjs: "^7.0.0",
      postcss: "^8.5.8",
      qrcode: "^1.5.4",
      react: "^19.2.4",
      "react-dom": "^19.2.4",
      tailwindcss: "^4.2.1",
      typescript: "^5.9.3",
    },
  }, null, 2);
}

function genTemplateTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2017", lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true, skipLibCheck: true, strict: true, noEmit: true,
      esModuleInterop: true, module: "esnext", moduleResolution: "bundler",
      resolveJsonModule: true, isolatedModules: true, jsx: "preserve",
      incremental: true, plugins: [{ name: "next" }],
      paths: { "@/*": ["./src/*"] },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  }, null, 2);
}
