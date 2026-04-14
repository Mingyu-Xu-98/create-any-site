/**
 * Edit Intent Classifier
 *
 * Rule-based classification of edit instructions into intent categories.
 * Each intent determines which files are passed to the Edit Agent,
 * keeping context small and focused.
 */

export type EditIntent = "style" | "content" | "component" | "structure" | "fix";

interface IntentRule {
  intent: EditIntent;
  /** Keywords/patterns that indicate this intent */
  patterns: RegExp[];
}

const INTENT_RULES: IntentRule[] = [
  {
    intent: "fix",
    patterns: [
      /\b(bug|fix|broken|错误|修复|不工作|不显示|白屏|报错|crash|error|issue)\b/i,
      /\b(spacing issue|alignment|misaligned|overlapping|overflow)\b/i,
      /build.*(fail|error)/i,
    ],
  },
  {
    intent: "style",
    patterns: [
      /\b(颜色|配色|color|colour|字体|font|间距|spacing|padding|margin)\b/i,
      /\b(动画|animation|transition|暗色|dark.?mode|亮色|light.?mode)\b/i,
      /\b(圆角|radius|阴影|shadow|边框|border|背景|background)\b/i,
      /\b(css|样式|style|视觉|visual|外观|appearance|主题|theme)\b/i,
      /\b(大小|size|粗细|weight|bold|italic|透明|opacity)\b/i,
    ],
  },
  {
    intent: "content",
    patterns: [
      /\b(文字|文案|text|标题|title|描述|description|名字|name)\b/i,
      /\b(翻译|translation|内容|content|项目名|wording|copy)\b/i,
      /\b(介绍|bio|简介|about|经历|experience.*(文字|text))\b/i,
      /\b(添加项目|add.*(project|item)|删除项目|remove.*(project|item))\b/i,
    ],
  },
  {
    intent: "structure",
    patterns: [
      /\b(布局|layout|重排|reorder|rearrange|添加页面|add.*page)\b/i,
      /\b(删除.*(section|部分)|remove.*section|移动|move)\b/i,
      /\b(导航结构|nav.*structure|侧边栏|sidebar|改为.*布局)\b/i,
      /\b(重构|restructure|reorganize|重新组织)\b/i,
    ],
  },
  {
    intent: "component",
    patterns: [
      /\b(导航|navbar|nav|页脚|footer|hero|卡片|card)\b/i,
      /\b(section|区块|组件|component|模块|module)\b/i,
      /\b(按钮|button|表单|form|modal|弹窗|对话框)\b/i,
      /\b(图标|icon|图片|image|头像|avatar)\b/i,
    ],
  },
];

/**
 * Classify an edit instruction into an intent category.
 * Returns the first matching intent, or "component" as a safe default.
 */
export function classifyEditIntent(instruction: string): EditIntent {
  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((p) => p.test(instruction))) {
      return rule.intent;
    }
  }
  return "component"; // safe default — gives Code Agent access to most files
}

/**
 * Determine which files the Edit Agent needs based on intent.
 * Returns a list of file keys to extract from the site's fileMap.
 */
export function getFileScopeForIntent(intent: EditIntent): string[] {
  switch (intent) {
    case "style":
      return ["src/app/globals.css"];
    case "content":
      return ["src/i18n/translations.ts"];
    case "component":
      return ["src/app/page.tsx", "src/app/globals.css"];
    case "structure":
      return ["src/app/page.tsx", "src/app/layout.tsx", "src/app/globals.css"];
    case "fix":
      return [
        "src/app/page.tsx",
        "src/app/globals.css",
        "src/app/layout.tsx",
        "src/i18n/translations.ts",
        "src/components/LanguageProvider.tsx",
      ];
  }
}
