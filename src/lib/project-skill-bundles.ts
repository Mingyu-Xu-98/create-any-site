import fs from "fs/promises";
import path from "path";

export type BuildAgentStage = "ideation" | "planning" | "execution";

interface SkillDoc {
  label: string;
  relativePath: string;
  maxChars?: number;
}

const STAGE_DOCS: Record<BuildAgentStage, SkillDoc[]> = {
  ideation: [
    { label: "Obra Brainstorming", relativePath: "skills/obra-superpowers/skills/brainstorming/SKILL.md", maxChars: 6500 },
    { label: "Style Skills Index", relativePath: "skills/style-skills/index.md", maxChars: 6000 },
    { label: "UI Skill Index", relativePath: "skills/ui-skill/index.md", maxChars: 5000 },
    { label: "Storytelling Index", relativePath: "skills/storytelling-for-user-experience-crafting-stories-for-better-design-skill.pdf/index.md", maxChars: 7000 },
  ],
  planning: [
    { label: "Write a PRD", relativePath: "skills/mattpocock-skills/write-a-prd/SKILL.md", maxChars: 5000 },
    { label: "PRD to Plan", relativePath: "skills/mattpocock-skills/prd-to-plan/SKILL.md", maxChars: 5000 },
    { label: "Style Skills Index", relativePath: "skills/style-skills/index.md", maxChars: 4500 },
    { label: "UI Skill Index", relativePath: "skills/ui-skill/index.md", maxChars: 4000 },
    { label: "Storytelling Index", relativePath: "skills/storytelling-for-user-experience-crafting-stories-for-better-design-skill.pdf/index.md", maxChars: 5000 },
  ],
  execution: [
    { label: "Style Skills Index", relativePath: "skills/style-skills/index.md", maxChars: 4500 },
    { label: "UI Skill Index", relativePath: "skills/ui-skill/index.md", maxChars: 4000 },
    { label: "Storytelling Index", relativePath: "skills/storytelling-for-user-experience-crafting-stories-for-better-design-skill.pdf/index.md", maxChars: 4500 },
  ],
};

async function readSkillDoc(doc: SkillDoc): Promise<string> {
  const fullPath = path.join(process.cwd(), doc.relativePath);

  try {
    const content = await fs.readFile(fullPath, "utf-8");
    const trimmed = content.trim();
    const maxChars = doc.maxChars ?? trimmed.length;
    const clipped = trimmed.length > maxChars
      ? `${trimmed.slice(0, maxChars)}\n\n[truncated]`
      : trimmed;
    return `## ${doc.label}\nPath: ${doc.relativePath}\n\n${clipped}`;
  } catch {
    return `## ${doc.label}\nPath: ${doc.relativePath}\n\n[missing]`;
  }
}

export async function loadStageSkillBundle(stage: BuildAgentStage): Promise<string> {
  const docs = await Promise.all(STAGE_DOCS[stage].map(readSkillDoc));
  return docs.join("\n\n---\n\n");
}
