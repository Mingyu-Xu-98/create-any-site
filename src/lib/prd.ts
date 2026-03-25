// PRD (Product Requirements Document) types

export interface PRDSection {
  title: string;
  content: string;
}

export interface PRDSkillPlan {
  skillName: string;
  purpose: string;  // why this skill is used
}

export interface PRD {
  version: number;
  // Project overview
  siteType: string;
  targetAudience: string;
  coreGoal: string;
  // Content planning
  contentSections: string[];
  narrativeSkills: PRDSkillPlan[];
  // Visual design
  theme: string;
  colorScheme: string;
  typography: string;
  designSkills: PRDSkillPlan[];
  // Tech
  techStack: string;
  features: string[];
  // Page structure
  pages: string[];
  // Knowledge mapping
  knowledgeSources: string[];
  knowledgeCount: number;
  // Full markdown text
  markdown: string;
  // Meta
  createdAt: string;
  note: string;
}

export interface PRDHistoryEntry {
  version: number;
  prd: PRD;
  createdAt: string;
  note: string;
}

export function createEmptyPRD(): PRD {
  return {
    version: 1,
    siteType: "",
    targetAudience: "",
    coreGoal: "",
    contentSections: [],
    narrativeSkills: [],
    theme: "",
    colorScheme: "",
    typography: "",
    designSkills: [],
    techStack: "Next.js 16 + React 19 + Tailwind CSS 4",
    features: [],
    pages: [],
    knowledgeSources: [],
    knowledgeCount: 0,
    markdown: "",
    createdAt: new Date().toISOString(),
    note: "Initial version",
  };
}
