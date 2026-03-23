import JSZip from "jszip";
import type { WorkspaceData, SkillGroup, ProjectItem, TimelineItem, EducationItem } from "./types";

/**
 * Parse a workspace zip and extract structured data for site generation.
 */
export async function analyzeWorkspace(file: File): Promise<WorkspaceData> {
  const zip = await JSZip.loadAsync(file);

  // Helper: read a file inside the zip (trying multiple path prefixes)
  const readFile = async (relativePath: string): Promise<string | null> => {
    // The zip might have a root folder or not
    for (const prefix of ["", "workspace/", findRootFolder(zip)]) {
      const entry = zip.file(prefix + relativePath);
      if (entry) return entry.async("string");
    }
    return null;
  };

  // Read all JSON files under skus/factual/
  const factualData: Record<string, unknown> = {};
  const factualHeaders: Record<string, string> = {};

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const match = path.match(/skus\/factual\/(sku_\d+)\/(content\.json|header\.md)$/);
    if (match) {
      const skuId = match[1];
      const fileName = match[2];
      const content = await entry.async("string");
      if (fileName === "content.json") {
        try { factualData[skuId] = JSON.parse(content); } catch { /* skip */ }
      } else {
        factualHeaders[skuId] = content;
      }
    }
  }

  // Read procedural skill headers
  const proceduralHeaders: Record<string, string> = {};
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const match = path.match(/skus\/procedural\/(skill_\d+)\/header\.md$/);
    if (match) {
      proceduralHeaders[match[1]] = await entry.async("string");
    }
  }

  // Read eureka insights
  const eureka = await readFile("eureka.md");

  // ---- Extract personal info ----
  const personalInfo = findByHeaderKeyword(factualHeaders, factualData, ["个人", "基本信息", "personal"]);
  const educationData = findByHeaderKeyword(factualHeaders, factualData, ["教育", "education"]);
  const skillsData = findByHeaderKeyword(factualHeaders, factualData, ["技能", "skills", "特长"]);
  const workData = findByHeaderKeyword(factualHeaders, factualData, ["工作", "经历", "work", "experience"]);
  const projectData = findAllByHeaderKeyword(factualHeaders, factualData, ["项目", "project", "github", "开源", "作品"]);

  // Parse personal info
  const person = (personalInfo ?? {}) as Record<string, string>;
  const name = person["姓名"] || person["name"] || "Your Name";
  const email = person["邮箱"] || person["email"] || "";
  const location = person["现居住地址"] || person["location"] || "";

  // Parse education
  const education = parseEducation(educationData);

  // Parse skills
  const skills = parseSkills(skillsData);

  // Parse work experience -> timeline + projects
  const workItems = Array.isArray(workData) ? workData : workData ? [workData] : [];
  const { timeline, projects: workProjects } = parseWork(workItems as Record<string, unknown>[]);

  // Parse standalone projects (GitHub, personal projects, etc.)
  const standaloneProjects = parseStandaloneProjects(projectData);
  const projects = [...workProjects, ...standaloneProjects].slice(0, 12);

  // Read any other markdown files at the root level
  const rootMarkdowns: Record<string, string> = {};
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    // Match markdown files at the root (or under the root folder prefix) that aren't inside skus/
    const mdMatch = path.match(/^(?:[^/]+\/)?([^/]+\.md)$/);
    if (mdMatch && !path.includes("/skus/")) {
      const filename = mdMatch[1];
      if (filename !== "eureka.md") {
        rootMarkdowns[filename] = await entry.async("string");
      }
    }
  }

  // Build chatbot context from all factual data
  const chatbotContext = buildChatbotContext(
    name, person, education, skills, workItems, eureka,
    factualData, factualHeaders, proceduralHeaders, rootMarkdowns,
  );

  // Generate English versions (simplified transliteration placeholders)
  const nameEn = guessEnglishName(name);
  const title = guessTitle(workItems as Record<string, unknown>[]);
  const titleEn = guessTitleEn(workItems as Record<string, unknown>[]);

  // Generate bio and characteristic tags
  const { bio, bioEn, bioTags, bioTagsEn } = generateBio(
    name, nameEn, title, titleEn, education, skills, workItems as Record<string, unknown>[], projects, eureka,
  );

  return {
    name,
    nameEn,
    title,
    titleEn,
    email,
    location,
    locationEn: location, // keep as-is for cities
    skills,
    skillsEn: skills.map(g => ({ ...g })), // same for now
    projects,
    projectsEn: projects.map(p => ({ ...p })),
    timeline,
    timelineEn: timeline.map(t => ({ ...t })),
    education,
    educationEn: education.map(e => ({ ...e })),
    tags: extractTags(skills),
    tagsEn: extractTags(skills),
    bio,
    bioEn,
    bioTags,
    bioTagsEn,
    github: extractGithub(person),
    linkedin: "",
    links: [],
    visibleSections: [
      "about",
      ...(projects.length > 0 ? ["projects"] : []),
      ...(timeline.length > 0 ? ["timeline"] : []),
      ...(skills.length > 0 ? ["skills"] : []),
      ...(education.length > 0 ? ["education"] : []),
    ],
    chatbotContext,
  };
}

function generateBio(
  name: string,
  nameEn: string,
  title: string,
  titleEn: string,
  education: EducationItem[],
  skills: SkillGroup[],
  workItems: Record<string, unknown>[],
  projects: ProjectItem[],
  eureka: string | null,
): { bio: string; bioEn: string; bioTags: string[]; bioTagsEn: string[] } {
  // Build bio from available data
  const parts: string[] = [];
  const partsEn: string[] = [];

  // Intro
  const school = education.length > 0 && education[0].school ? education[0].school : "";
  const degree = education.length > 0 && education[0].degree ? education[0].degree : "";
  if (school) {
    parts.push(`${name}，${school}${degree}。`);
    partsEn.push(`${nameEn}, ${degree} from ${school}.`);
  } else {
    parts.push(`${name}，${title}。`);
    partsEn.push(`${nameEn}, ${titleEn}.`);
  }

  // Work experience summary
  if (workItems.length > 0) {
    const companies = workItems.map(w => String(w["公司"] || w["company"] || "")).filter(Boolean);
    const yearsOfExp = workItems.length;
    if (companies.length > 0) {
      parts.push(`曾就职于${companies.slice(0, 3).join("、")}等公司，拥有丰富的${title}经验。`);
      partsEn.push(`Worked at ${companies.slice(0, 3).join(", ")} with extensive ${titleEn} experience.`);
    } else if (yearsOfExp > 0) {
      parts.push(`拥有丰富的${title}经验。`);
      partsEn.push(`Extensive experience as a ${titleEn}.`);
    }
  }

  // Skills highlight
  const topSkills = skills.flatMap(g => g.skills).slice(0, 5);
  if (topSkills.length > 0) {
    parts.push(`擅长${topSkills.join("、")}。`);
    partsEn.push(`Skilled in ${topSkills.join(", ")}.`);
  }

  // Projects highlight
  if (projects.length > 0) {
    const count = projects.length;
    parts.push(`主导或参与了${count}个项目，涵盖${projects.slice(0, 3).map(p => p.title).join("、")}等。`);
    partsEn.push(`Led or participated in ${count} projects including ${projects.slice(0, 3).map(p => p.title).join(", ")}.`);
  }

  // Eureka insight if available
  if (eureka) {
    const firstLine = eureka.split("\n").find(l => l.trim().length > 10)?.trim();
    if (firstLine && firstLine.length < 100) {
      parts.push(firstLine);
    }
  }

  const bio = parts.join("");
  const bioEn = partsEn.join(" ");

  // Generate characteristic tags
  const bioTags: string[] = [];
  const bioTagsEn: string[] = [];

  // From education
  if (school) {
    bioTags.push(school.length > 6 ? school.slice(0, 6) : school);
    bioTagsEn.push(school);
  }

  // From title
  if (title) {
    bioTags.push(title);
    bioTagsEn.push(titleEn);
  }

  // From top skills (pick 2-3 distinctive ones)
  const distinctiveSkills = skills.flatMap(g => g.skills).filter(s => s.length <= 10).slice(0, 3);
  for (const s of distinctiveSkills) {
    bioTags.push(s);
    bioTagsEn.push(s);
  }

  // From work (latest company)
  if (workItems.length > 0) {
    const company = String(workItems[0]["公司"] || workItems[0]["company"] || "");
    if (company) {
      bioTags.push(company.length > 6 ? company.slice(0, 6) : company);
      bioTagsEn.push(company);
    }
  }

  return {
    bio,
    bioEn,
    bioTags: bioTags.slice(0, 6),
    bioTagsEn: bioTagsEn.slice(0, 6),
  };
}

// ---- Helpers ----

function findRootFolder(zip: JSZip): string {
  const folders = Object.keys(zip.files).filter(p => zip.files[p].dir);
  if (folders.length > 0) {
    const first = folders[0];
    if (!first.includes("/") || first.split("/").filter(Boolean).length === 1) {
      return first.endsWith("/") ? first : first + "/";
    }
  }
  return "";
}

function findByHeaderKeyword(
  headers: Record<string, string>,
  data: Record<string, unknown>,
  keywords: string[]
): unknown | null {
  for (const [skuId, header] of Object.entries(headers)) {
    const lower = header.toLowerCase();
    if (keywords.some(kw => lower.includes(kw))) {
      return data[skuId] ?? null;
    }
  }
  return null;
}

function findAllByHeaderKeyword(
  headers: Record<string, string>,
  data: Record<string, unknown>,
  keywords: string[]
): unknown[] {
  const results: unknown[] = [];
  for (const [skuId, header] of Object.entries(headers)) {
    const lower = header.toLowerCase();
    if (keywords.some(kw => lower.includes(kw))) {
      const d = data[skuId];
      if (d !== undefined) {
        if (Array.isArray(d)) results.push(...d);
        else results.push(d);
      }
    }
  }
  return results;
}

function parseStandaloneProjects(items: unknown[]): ProjectItem[] {
  const projects: ProjectItem[] = [];
  for (const item of items) {
    const r = item as Record<string, unknown>;
    const name = String(r["项目名称"] || r["name"] || r["title"] || r["名称"] || "");
    if (!name) continue;
    const desc = String(r["描述"] || r["description"] || r["简介"] || r["工作内容"] || r["内容"] || "");
    const link = String(r["链接"] || r["link"] || r["url"] || r["github"] || "");
    const tagsRaw = r["标签"] || r["tags"] || r["技术栈"] || r["tech"] || [];
    const tags = Array.isArray(tagsRaw) ? tagsRaw.map(String).slice(0, 4) : extractProjectTags(desc);
    projects.push({
      title: name,
      org: String(r["组织"] || r["org"] || ""),
      desc: desc.slice(0, 200),
      tags,
      image: `/images/project-${projects.length + 1}.png`,
      link: link || undefined,
    });
  }
  return projects;
}

function parseEducation(raw: unknown): EducationItem[] {
  if (!raw) return [{ school: "Your University", degree: "Your Degree", highlights: [] }];
  const items = Array.isArray(raw) ? raw : [raw];
  return items.map((item: unknown) => {
    const r = item as Record<string, unknown>;
    return {
      school: String(r["学校"] || r["school"] || ""),
      degree: String(r["学位"] || r["学历"] || r["degree"] || ""),
      highlights: Array.isArray(r["亮点"] || r["highlights"])
        ? (r["亮点"] || r["highlights"]) as string[]
        : typeof r["亮点"] === "string" || typeof r["highlights"] === "string"
          ? [String(r["亮点"] || r["highlights"])]
          : [],
    };
  });
}

function parseSkills(raw: unknown): SkillGroup[] {
  if (!raw) return [{ title: "Skills", skills: ["Skill 1", "Skill 2"] }];
  if (Array.isArray(raw)) {
    return raw.map((item: unknown) => {
      const r = item as Record<string, unknown>;
      return {
        title: String(r["类别"] || r["title"] || r["category"] || "Skills"),
        skills: Array.isArray(r["技能"] || r["skills"] || r["items"])
          ? ((r["技能"] || r["skills"] || r["items"]) as string[])
          : [],
      };
    });
  }
  // Single object with category keys
  const obj = raw as Record<string, unknown>;
  return Object.entries(obj).map(([key, val]) => ({
    title: key,
    skills: Array.isArray(val) ? val.map(String) : [String(val)],
  }));
}

function parseWork(items: Record<string, unknown>[]): {
  timeline: TimelineItem[];
  projects: ProjectItem[];
} {
  const timeline: TimelineItem[] = [];
  const projects: ProjectItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const company = String(item["公司"] || item["company"] || "");
    const position = String(item["职位"] || item["position"] || "");
    const time = String(item["时间"] || item["time"] || "");

    timeline.push({
      date: time,
      title: company ? `${company} · ${position}` : position,
      desc: String(item["职责概述"] || item["description"] || ""),
      active: i === 0,
    });

    const projectList = (item["项目经历"] || item["projects"] || []) as Record<string, unknown>[];
    if (Array.isArray(projectList)) {
      for (const proj of projectList) {
        const workContent = Array.isArray(proj["工作内容"] || proj["content"])
          ? ((proj["工作内容"] || proj["content"]) as string[]).join("；")
          : String(proj["工作内容"] || proj["content"] || "");

        projects.push({
          title: String(proj["项目名称"] || proj["name"] || company),
          org: `${company} · ${time.split("-")[0]?.trim() || ""}`,
          desc: workContent.slice(0, 200),
          tags: extractProjectTags(workContent),
          image: `/images/project-${projects.length + 1}.png`,
          badge: i === 0 ? "Current" : undefined,
        });
      }
    }
  }

  return { timeline, projects: projects.slice(0, 12) };
}

function extractProjectTags(text: string): string[] {
  const tagKeywords = [
    "Python", "SQL", "JavaScript", "TypeScript", "React", "Next.js",
    "FastAPI", "Tailwind", "AI", "LLM", "GPT", "RAG",
    "数据分析", "提示工程", "需求分析", "产品设计", "知识库",
    "DSL", "机器学习", "数据可视化", "PRD",
  ];
  return tagKeywords.filter(kw => text.includes(kw)).slice(0, 4);
}

function extractTags(skills: SkillGroup[]): string[] {
  const all = skills.flatMap(g => g.skills);
  return all.slice(0, 6);
}

function guessTitle(workItems: Record<string, unknown>[]): string {
  if (workItems.length > 0) {
    return String(workItems[0]["职位"] || workItems[0]["position"] || "Creator");
  }
  return "Creator";
}

function guessTitleEn(workItems: Record<string, unknown>[]): string {
  const title = guessTitle(workItems);
  const map: Record<string, string> = {
    "助理业务经理": "Business Analyst",
    "数据分析师": "Data Analyst",
    "产品经理": "Product Manager",
  };
  return map[title] || title;
}

function guessEnglishName(name: string): string {
  // Simple: if Chinese, return pinyin-style; otherwise return as-is
  if (/[\u4e00-\u9fff]/.test(name)) {
    return "Your Name"; // User should customize
  }
  return name;
}

function extractGithub(person: Record<string, string>): string {
  for (const val of Object.values(person)) {
    if (typeof val === "string" && val.includes("github.com")) return val;
  }
  return "";
}

function buildChatbotContext(
  name: string,
  person: Record<string, string>,
  education: EducationItem[],
  skills: SkillGroup[],
  workItems: unknown[],
  eureka: string | null,
  factualData: Record<string, unknown>,
  factualHeaders: Record<string, string>,
  proceduralHeaders: Record<string, string>,
  rootMarkdowns: Record<string, string>,
): string {
  const parts: string[] = [];

  // Basic info summary
  parts.push(`## Basic Info\nName: ${name}\nEmail: ${person["邮箱"] || ""}\nLocation: ${person["现居住地址"] || ""}`);

  // All factual SKUs — include full raw content
  const skuIds = Array.from(
    new Set([...Object.keys(factualHeaders), ...Object.keys(factualData)])
  ).sort();

  if (skuIds.length > 0) {
    parts.push("## All Factual SKUs");
    for (const skuId of skuIds) {
      const header = factualHeaders[skuId];
      const data = factualData[skuId];
      const skuParts: string[] = [`### ${skuId}`];
      if (header) skuParts.push(`**Header:**\n${header}`);
      if (data !== undefined) skuParts.push(`**Content:**\n${JSON.stringify(data, null, 2)}`);
      parts.push(skuParts.join("\n"));
    }
  }

  // All procedural skills — include full raw headers
  const procIds = Object.keys(proceduralHeaders).sort();
  if (procIds.length > 0) {
    parts.push("## All Procedural Skills");
    for (const skillId of procIds) {
      parts.push(`### ${skillId}\n${proceduralHeaders[skillId]}`);
    }
  }

  // Eureka insights — full text
  if (eureka) {
    parts.push(`## Eureka Insights\n${eureka}`);
  }

  // Other root-level markdown files — full text
  for (const [filename, content] of Object.entries(rootMarkdowns)) {
    parts.push(`## ${filename}\n${content}`);
  }

  // Parsed summaries for convenience
  if (education.length) {
    parts.push("## Education (Parsed)\n" + education.map(e => `- ${e.school}, ${e.degree}${e.highlights.length ? ": " + e.highlights.join("; ") : ""}`).join("\n"));
  }
  if (skills.length) {
    parts.push("## Skills (Parsed)\n" + skills.map(g => `- ${g.title}: ${g.skills.join(", ")}`).join("\n"));
  }
  if (workItems.length) {
    parts.push("## Work Experience (Parsed)\n" + JSON.stringify(workItems, null, 2));
  }

  return parts.join("\n\n");
}
