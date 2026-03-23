import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import type { WorkspaceData } from "@/lib/types";

// ─── Extract all readable text from a zip ───
async function extractAllText(buffer: ArrayBuffer): Promise<{
  texts: { path: string; content: string }[];
  links: string[];
}> {
  const zip = await JSZip.loadAsync(buffer);
  const texts: { path: string; content: string }[] = [];
  const links: string[] = [];

  // URL regex
  const urlRegex = /https?:\/\/[^\s"'<>\])\u4e00-\u9fff]+/g;

  for (const [filePath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;

    // Skip binary / large files
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const textExts = ["json", "md", "txt", "csv", "yaml", "yml", "toml", "html", "xml", "rst", "tex", "log"];
    if (!textExts.includes(ext)) continue;

    try {
      const content = await entry.async("string");
      if (content.length > 0 && content.length < 100_000) {
        texts.push({ path: filePath, content });
        // Extract links
        const foundLinks = content.match(urlRegex);
        if (foundLinks) links.push(...foundLinks);
      }
    } catch {
      // Skip unreadable files
    }
  }

  // Deduplicate links
  const uniqueLinks = [...new Set(links)].filter(
    (l) => !l.includes("schemas.") && !l.includes("xmlns") && !l.includes("w3.org")
  );

  return { texts, links: uniqueLinks };
}

// ─── Call AI model to analyze content ───
async function aiAnalyze(
  allContent: string,
  rawLinks: string[],
): Promise<WorkspaceData> {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    throw new Error("SILICONFLOW_API_KEY not configured");
  }

  const linksSection = rawLinks.length > 0
    ? `\n\n## 文件中发现的链接:\n${rawLinks.join("\n")}`
    : "";

  const systemPrompt = `你是一个专业的个人信息分析师。用户会提供他们上传的各种文件内容（可能是简历、GitHub资料、个人文章、工作区数据等任何个人相关信息）。

你的任务：
1. 分析所有内容，提取个人信息、技能、项目、工作经历、教育背景等
2. 判断哪些内容适合在个人网站上展示
3. 找出所有重要链接（GitHub、LinkedIn、个人网站、作品集、文章链接等）
4. 生成中英文双语内容
5. 决定网站应该展示哪些模块

你必须返回一个严格的 JSON 对象（不要添加任何其他文本），格式如下：
{
  "name": "中文姓名",
  "nameEn": "English Name (如果无法确定就音译拼音)",
  "title": "职位/头衔（中文）",
  "titleEn": "Title in English",
  "email": "邮箱地址",
  "location": "所在城市",
  "locationEn": "City in English",
  "bio": "基于文件内容总结的个人简介（中文，2-4句话，只用文件中的事实）",
  "bioEn": "Bio in English based on file content only",
  "bioTags": ["标签1", "标签2", "标签3", "...最多6个中文特征标签"],
  "bioTagsEn": ["Tag1", "Tag2", "...对应英文标签"],
  "skills": [
    { "title": "技能分类名（中文）", "skills": ["技能1", "技能2"] }
  ],
  "skillsEn": [
    { "title": "Category Name", "skills": ["Skill1", "Skill2"] }
  ],
  "projects": [
    {
      "title": "项目名称",
      "org": "所属组织/公司",
      "desc": "项目描述（中文，一两句话）",
      "tags": ["技术标签1", "技术标签2"],
      "image": "",
      "link": "项目链接（如有）"
    }
  ],
  "projectsEn": [
    {
      "title": "Project Name",
      "org": "Organization",
      "desc": "Description in English",
      "tags": ["Tag1", "Tag2"],
      "image": "",
      "link": ""
    }
  ],
  "timeline": [
    {
      "date": "起止时间",
      "title": "公司 · 职位",
      "desc": "工作描述（中文）",
      "active": true
    }
  ],
  "timelineEn": [
    {
      "date": "Period",
      "title": "Company · Position",
      "desc": "Description in English",
      "active": true
    }
  ],
  "education": [
    {
      "school": "从文件中提取的学校名",
      "degree": "从文件中提取的学历",
      "highlights": ["只填文件中明确提到的成就，没有就留空数组[]"]
    }
  ],
  "educationEn": [
    {
      "school": "School name from file",
      "degree": "Degree from file",
      "highlights": ["Only achievements explicitly mentioned in file, empty [] if none"]
    }
  ],
  "tags": ["前6个核心技能标签"],
  "tagsEn": ["Top 6 skill tags"],
  "links": [
    {
      "label": "链接显示名（中文）",
      "labelEn": "Link Label",
      "url": "https://...",
      "icon": "github|linkedin|twitter|website|article|portfolio|email|other"
    }
  ],
  "visibleSections": ["about", "skills", "projects", "timeline", "education", "links"]
}

## 关于 visibleSections 的判断规则:
- "about": 只要有姓名和任何个人信息就显示
- "skills": 有技能信息才显示
- "projects": 有项目信息才显示
- "timeline": 有工作经历才显示
- "education": 有教育背景才显示
- "links": 有重要外部链接才显示

## 关于 links 的规则:
- 收集所有对访客有价值的链接：GitHub、LinkedIn、个人博客、作品集、发表的文章等
- 不要放内部系统链接、API链接、CDN链接等无意义的链接
- icon 字段用于显示图标，从这些中选：github, linkedin, twitter, website, article, portfolio, email, other

## 最重要的规则（必须严格遵守）：
- **只使用文件中实际存在的信息，绝对不要编造、猜测、推断任何不存在的内容**
- 如果文件中有学校名称但没有具体亮点/成就，highlights 就留空数组 []，不要写"请参考学籍档案"之类的话
- 如果某个字段在文件中找不到对应信息，直接留空（空字符串""或空数组[]）
- 不要添加任何提示用户补充信息的文字（如"待补充"、"请提供"、"参考XX"等）
- 项目描述不超过200字
- timeline 第一项（最近的）设 active: true，其余 false
- 只返回 JSON，不要有任何其他文字`;

  const userMessage = `请分析以下上传文件的内容，提取个人信息并生成网站数据：

${allContent}${linksSection}`;

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
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI analysis failed: ${response.status} ${errText}`);
  }

  const result = await response.json();
  const rawContent = result.choices?.[0]?.message?.content || "";

  // Extract JSON from response (might be wrapped in markdown code blocks)
  let jsonStr = rawContent;
  const codeBlockMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1];
  }

  const parsed = JSON.parse(jsonStr.trim());

  // Clean hallucinated placeholder text from AI output
  const placeholderPatterns = /请参考|待补充|请提供|暂无|待填写|参考.*档案|需要.*补充/g;
  const cleanStr = (s: unknown): string => {
    if (typeof s !== "string") return "";
    return placeholderPatterns.test(s) ? "" : s;
  };
  const cleanArr = (arr: unknown): string[] => {
    if (!Array.isArray(arr)) return [];
    return arr.map(String).filter(s => !placeholderPatterns.test(s));
  };

  // Clean education highlights specifically
  if (Array.isArray(parsed.education)) {
    for (const edu of parsed.education) {
      edu.highlights = cleanArr(edu.highlights);
    }
  }
  if (Array.isArray(parsed.educationEn)) {
    for (const edu of parsed.educationEn) {
      edu.highlights = cleanArr(edu.highlights);
    }
  }

  // Ensure all required fields exist with defaults
  return {
    name: parsed.name || "Your Name",
    nameEn: parsed.nameEn || parsed.name || "Your Name",
    title: parsed.title || "",
    titleEn: parsed.titleEn || parsed.title || "",
    email: parsed.email || "",
    location: parsed.location || "",
    locationEn: parsed.locationEn || parsed.location || "",
    skills: parsed.skills || [],
    skillsEn: parsed.skillsEn || parsed.skills || [],
    projects: (parsed.projects || []).map((p: Record<string, unknown>) => ({
      title: p.title || "",
      org: p.org || "",
      desc: String(p.desc || "").slice(0, 200),
      tags: p.tags || [],
      image: p.image || "",
      link: p.link || "",
    })),
    projectsEn: (parsed.projectsEn || parsed.projects || []).map((p: Record<string, unknown>) => ({
      title: p.title || "",
      org: p.org || "",
      desc: String(p.desc || "").slice(0, 200),
      tags: p.tags || [],
      image: p.image || "",
      link: p.link || "",
    })),
    timeline: parsed.timeline || [],
    timelineEn: parsed.timelineEn || parsed.timeline || [],
    education: parsed.education || [],
    educationEn: parsed.educationEn || parsed.education || [],
    tags: parsed.tags || [],
    tagsEn: parsed.tagsEn || parsed.tags || [],
    bio: cleanStr(parsed.bio),
    bioEn: parsed.bioEn || parsed.bio || "",
    bioTags: parsed.bioTags || [],
    bioTagsEn: parsed.bioTagsEn || parsed.bioTags || [],
    github: parsed.links?.find((l: { icon: string }) => l.icon === "github")?.url || "",
    linkedin: parsed.links?.find((l: { icon: string }) => l.icon === "linkedin")?.url || "",
    links: parsed.links || [],
    visibleSections: parsed.visibleSections || ["about", "skills", "projects", "timeline", "education"],
    chatbotContext: "", // Will be built separately
  };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();

    // 1. Extract all text content and links from the zip
    const { texts, links } = await extractAllText(buffer);

    if (texts.length === 0) {
      return NextResponse.json(
        { error: "No readable text files found in the uploaded archive" },
        { status: 400 },
      );
    }

    // 2. Build combined content (truncate to fit model context)
    const combined = texts
      .map((t) => `=== FILE: ${t.path} ===\n${t.content}`)
      .join("\n\n");
    // Limit to ~60k chars to stay within model context
    const truncated = combined.length > 60000
      ? combined.slice(0, 60000) + "\n\n... (content truncated)"
      : combined;

    // 3. Call AI to analyze
    const data = await aiAnalyze(truncated, links);

    // 4. Build chatbot context from all raw content
    data.chatbotContext = buildKnowledgeBase(texts);

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Analyze error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── Build knowledge base from all raw content ───
function buildKnowledgeBase(
  texts: { path: string; content: string }[],
): string {
  const chunks: string[] = [];
  for (const t of texts) {
    // Skip very small files
    if (t.content.trim().length < 20) continue;
    chunks.push(`## ${t.path}\n${t.content}`);
  }
  return chunks.join("\n\n");
}
