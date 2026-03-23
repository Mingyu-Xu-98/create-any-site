import type { QuestionOption, SiteType, LayoutType, ThemeStyle, WizardStep } from "./types";

export const WIZARD_STEPS: WizardStep[] = [
  { id: "upload",   title: "上传工作区",   subtitle: "上传你的工作区压缩包" },
  { id: "siteType", title: "网站类型",     subtitle: "选择要构建的网站类型" },
  { id: "theme",    title: "视觉风格",     subtitle: "选择一种独特的设计风格" },
  { id: "features", title: "功能选项",     subtitle: "开关额外功能" },
  { id: "generate", title: "生成网站",     subtitle: "预览你的网站" },
];

/** Auto-assign a recommended layout based on visual style + site type */
const STYLE_LAYOUT_MAP: Record<string, LayoutType> = {
  cyberpunk: "interactive",
  minimalist: "f-shape",
  ghibli: "hero-media",
  glassmorphism: "card-grid",
  retro: "two-column",
  brutalist: "asymmetric",
  cinematic: "hero-media",
  "bold-creative": "masonry",
  editorial: "magazine",
  nature: "hero-media",
  "gradient-mesh": "z-shape",
  "neo-tokyo": "fixed-nav",
  "tpl-business": "card-grid",
  "tpl-resume-bold": "card-grid",
  "tpl-resume-dark": "hidden-nav",
  "tpl-blog": "hero-media",
  custom: "card-grid",
};

/**
 * Auto-determine layout from theme. For "custom" theme, try to infer
 * from the user's description text; otherwise fall back to card-grid.
 */
export function getAutoLayout(theme: string | null, _siteType: string | null, customThemeDesc?: string): LayoutType {
  if (theme === "custom" && customThemeDesc) {
    const desc = customThemeDesc.toLowerCase();
    if (/图片|背景图|hero|banner|全屏|大图|image|photo/.test(desc)) return "hero-media";
    if (/杂志|magazine|editorial|编辑/.test(desc)) return "magazine";
    if (/瀑布|masonry|pinterest|waterfall/.test(desc)) return "masonry";
    if (/极简|minimal|简洁|clean/.test(desc)) return "f-shape";
    if (/科技|cyber|neon|霓虹|赛博/.test(desc)) return "interactive";
    if (/分屏|split|双栏|sidebar/.test(desc)) return "split-screen";
    if (/卡片|card|grid|网格|bento/.test(desc)) return "card-grid";
    return "card-grid";
  }
  return STYLE_LAYOUT_MAP[theme || "custom"] || "card-grid";
}

export const SITE_TYPE_OPTIONS: QuestionOption<SiteType>[] = [
  {
    value: "portfolio",
    icon: "briefcase",
    label: "个人简历网站",
    labelEn: "Personal Resume Website",
    desc: "展示你的职业经历、项目、技能和教育背景",
    descEn: "Showcase your career experience, projects, skills, and education",
  },
  {
    value: "brand",
    icon: "star",
    label: "品牌官网",
    labelEn: "Brand Website",
    desc: "专业品牌形象，强烈视觉识别",
    descEn: "Professional brand presence with a strong identity",
  },
  {
    value: "custom",
    icon: "pencil",
    label: "自定义",
    labelEn: "Custom",
    desc: "用自己的话描述理想的网站类型",
    descEn: "Describe your ideal website type in your own words",
  },
];

// ---- All 12 layout options ----

export const ALL_LAYOUT_OPTIONS: QuestionOption<LayoutType>[] = [
  {
    value: "two-column",
    icon: "layout-two",
    label: "双栏布局",
    labelEn: "Two Column",
    desc: "内容 + 侧边栏，用于导航或辅助信息",
    descEn: "Content + sidebar for navigation or supplementary info",
  },
  {
    value: "split-screen",
    icon: "layout-split",
    label: "分屏布局",
    labelEn: "Split Screen",
    desc: "50/50 双面板，适合对比展示或视觉平衡",
    descEn: "50/50 dual-panel for contrast, comparison, or visual balance",
  },
  {
    value: "asymmetric",
    icon: "layout-asym",
    label: "不对称布局",
    labelEn: "Asymmetric",
    desc: "非对称构图，富有创意动感和现代感",
    descEn: "Off-balance composition for creative dynamism and modern feel",
  },
  {
    value: "f-shape",
    icon: "layout-f",
    label: "F 型布局",
    labelEn: "F-Shape",
    desc: "左对齐层级，符合自然阅读习惯",
    descEn: "Left-aligned hierarchy matching natural reading patterns",
  },
  {
    value: "z-shape",
    icon: "layout-z",
    label: "Z 型布局",
    labelEn: "Z-Shape",
    desc: "引导视觉路径，左右交替内容区块",
    descEn: "Guided visual path with alternating left/right content sections",
  },
  {
    value: "card-grid",
    icon: "layout-bento",
    label: "卡片 / 便当盒网格",
    labelEn: "Card / Bento Grid",
    desc: "模块化卡片响应式网格，适合项目展示",
    descEn: "Modular cards in a responsive grid — great for projects & dashboards",
  },
  {
    value: "hero-media",
    icon: "layout-hero",
    label: "全屏首图",
    labelEn: "Hero Media",
    desc: "顶部全宽大图/视频，下方展示内容",
    descEn: "Full-width hero image/video at top with content below",
  },
  {
    value: "masonry",
    icon: "layout-masonry",
    label: "瀑布流",
    labelEn: "Masonry / Waterfall",
    desc: "Pinterest 风格交错列布局，适合视觉展示",
    descEn: "Pinterest-style staggered columns for visual portfolios",
  },
  {
    value: "magazine",
    icon: "layout-magazine",
    label: "杂志布局",
    labelEn: "Magazine",
    desc: "多栏编辑式布局，丰富的视觉层次",
    descEn: "Rich multi-column editorial layout with visual hierarchy",
  },
  {
    value: "fixed-nav",
    icon: "layout-fixednav",
    label: "固定导航",
    labelEn: "Fixed Navigation",
    desc: "常驻顶部导航栏，快速访问各区块",
    descEn: "Prominent sticky nav for quick access to all sections",
  },
  {
    value: "hidden-nav",
    icon: "layout-hiddennav",
    label: "隐藏导航",
    labelEn: "Hidden Navigation",
    desc: "极简沉浸式体验，汉堡菜单导航",
    descEn: "Minimalist immersive experience with hamburger menu",
  },
  {
    value: "interactive",
    icon: "layout-interactive",
    label: "交互式 / 滚动驱动",
    labelEn: "Interactive / Scroll",
    desc: "滚动驱动动画，动态视觉叙事",
    descEn: "Scroll-driven animations and dynamic visual storytelling",
  },
  {
    value: "custom",
    icon: "pencil",
    label: "自定义",
    labelEn: "Custom",
    desc: "用自己的话描述理想的页面结构",
    descEn: "Describe your ideal page structure in your own words",
  },
];

// ---- Site type → recommended layouts (4-5 per type) ----

const LAYOUT_RECOMMENDATIONS: Record<string, LayoutType[]> = {
  portfolio:  ["split-screen", "asymmetric", "card-grid", "masonry", "hero-media"],
  brand:      ["split-screen", "z-shape", "hero-media", "hidden-nav", "interactive"],
  blog:       ["two-column", "f-shape", "card-grid", "magazine", "fixed-nav"],
  landing:    ["z-shape", "hero-media", "split-screen", "fixed-nav", "interactive"],
  custom:     ["card-grid", "split-screen", "hero-media", "z-shape", "two-column"],
};

/**
 * Return the recommended layout options for a given site type.
 * Always appends the "Custom" option at the end.
 */
export function getLayoutsForSiteType(siteType: string | null): QuestionOption<LayoutType>[] {
  const recommended = LAYOUT_RECOMMENDATIONS[siteType || "custom"] || LAYOUT_RECOMMENDATIONS.custom;
  const filtered = ALL_LAYOUT_OPTIONS.filter(
    (opt) => recommended.includes(opt.value) || opt.value === "custom",
  );
  // Preserve recommendation order
  const ordered = recommended
    .map((v) => filtered.find((o) => o.value === v))
    .filter(Boolean) as QuestionOption<LayoutType>[];
  const customOpt = filtered.find((o) => o.value === "custom");
  if (customOpt) ordered.push(customOpt);
  return ordered;
}

export const ALL_THEME_OPTIONS: QuestionOption<ThemeStyle>[] = [
  {
    value: "cyberpunk",
    icon: "style-cyber",
    label: "赛博朋克 / 暗黑科技",
    labelEn: "Cyberpunk / Dark Tech",
    desc: "霓虹光效、粒子动画、玻璃拟态、等宽字体",
    descEn: "Neon glow, particle animations, glassmorphism, monospace, dynamic",
    preview: "linear-gradient(135deg, #0a0a1a 0%, #0d0d2b 50%, #00fff0 200%)",
  },
  {
    value: "minimalist",
    icon: "style-minimal",
    label: "极简主义",
    labelEn: "Minimalist",
    desc: "大量留白、锐利排版、无装饰、静态",
    descEn: "Maximum whitespace, sharp typography, no decoration, static",
    preview: "linear-gradient(135deg, #ffffff 0%, #f8f8f8 100%)",
  },
  {
    value: "ghibli",
    icon: "style-ghibli",
    label: "吉卜力幻想",
    labelEn: "Ghibli Fantasy",
    desc: "水彩质感、手绘风格、温暖有机、AI 插画",
    descEn: "Watercolor textures, hand-drawn feel, warm organic, AI illustrations",
    preview: "linear-gradient(135deg, #f5efe6 0%, #d4e7c5 50%, #a8d8ea 100%)",
  },
  {
    value: "glassmorphism",
    icon: "style-glass",
    label: "玻璃拟态",
    labelEn: "Glassmorphism",
    desc: "磨砂玻璃、模糊效果、半透明卡片、渐变动画背景",
    descEn: "Frosted glass, blur effects, translucent cards, animated gradient bg",
    preview: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
  },
  {
    value: "retro",
    icon: "style-retro",
    label: "复古 / 怀旧",
    labelEn: "Retro / Vintage",
    desc: "胶片噪点、复古排版、柔和配色、纸张质感",
    descEn: "Film grain overlay, vintage typography, muted palette, paper texture",
    preview: "linear-gradient(135deg, #f4e8c1 0%, #ddb892 50%, #c0392b 200%)",
  },
  {
    value: "brutalist",
    icon: "style-brutal",
    label: "暗码终端",
    labelEn: "Dark Terminal",
    desc: "深色背景、等宽字体、极简排版、开发者风格",
    descEn: "Dark background, monospace font, minimal layout, developer-style",
    preview: "linear-gradient(135deg, #1d1d1d 0%, #2a2a2a 50%, #4493f8 200%)",
  },
  {
    value: "cinematic",
    icon: "style-cinema",
    label: "电影 / 影视",
    labelEn: "Cinematic / Film",
    desc: "戏剧性光影、宽屏比例、暗调配色、胶片质感",
    descEn: "Dramatic lighting, widescreen ratio, dark moody palette, film grain",
    preview: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #e94560 200%)",
  },
  {
    value: "bold-creative",
    icon: "style-bold",
    label: "大胆创意",
    labelEn: "Bold Creative",
    desc: "鲜明撞色、超大字体、不规则布局、充满活力",
    descEn: "Vivid clashing colors, oversized type, irregular layouts, energetic",
    preview: "linear-gradient(135deg, #ff6b6b 0%, #ffd93d 33%, #6bcb77 66%, #4d96ff 100%)",
  },
  {
    value: "editorial",
    icon: "style-editorial",
    label: "编辑 / 杂志",
    labelEn: "Editorial / Magazine",
    desc: "杂志排版、优雅衬线字体、精致留白、高端质感",
    descEn: "Magazine typography, elegant serifs, refined whitespace, premium feel",
    preview: "linear-gradient(135deg, #faf9f6 0%, #ede8e0 100%)",
  },
  {
    value: "nature",
    icon: "style-nature",
    label: "自然 / 有机",
    labelEn: "Nature / Organic",
    desc: "大地色调、有机形状、自然纹理、温暖厚实",
    descEn: "Earth tones, organic shapes, natural textures, warm & grounded",
    preview: "linear-gradient(135deg, #2d5016 0%, #5a7247 50%, #c4a882 100%)",
  },
  {
    value: "gradient-mesh",
    icon: "style-gradient",
    label: "渐变网格",
    labelEn: "Gradient Mesh",
    desc: "鲜艳渐变网格背景、流动色彩、现代吸睛",
    descEn: "Vivid gradient mesh backgrounds, flowing colors, modern & eye-catching",
    preview: "linear-gradient(135deg, #ff9a9e 0%, #a18cd1 50%, #fbc2eb 100%)",
  },
  {
    value: "neo-tokyo",
    icon: "style-neotokyo",
    label: "新东京",
    labelEn: "Neo-Tokyo",
    desc: "日本都市美学、霓虹与传统融合、动漫风格",
    descEn: "Japanese urban aesthetic, neon meets tradition, anime-inspired",
    preview: "linear-gradient(135deg, #0d0d0d 0%, #1a0a2e 50%, #ff2e63 100%)",
  },
  {
    value: "tpl-business",
    icon: "style-tpl-business",
    label: "商务科技简历",
    labelEn: "Business Tech Resume",
    desc: "紫色玻璃拟态、便当盒网格、打字机首屏、专业",
    descEn: "Purple glassmorphism, bento grid, typewriter hero, professional",
    preview: "linear-gradient(135deg, #0a0a1a 0%, #1a1040 50%, #6c63ff 200%)",
  },
  {
    value: "tpl-resume-dark",
    icon: "style-tpl-dark",
    label: "暗色玻璃简历",
    labelEn: "Dark Glass Resume",
    desc: "超暗背景、药丸导航、氛围光斑、噪点纹理",
    descEn: "Ultra-dark background, pill nav, ambient blobs, grain texture",
    preview: "linear-gradient(135deg, #050506 0%, #111118 50%, #5E6AD2 200%)",
  },
  {
    value: "tpl-resume-bold",
    icon: "style-tpl-bold",
    label: "撞色波普简历",
    labelEn: "Pop Clash Resume",
    desc: "粗边框、硬阴影、粉青撞色、浮动标签",
    descEn: "Thick borders, hard shadows, pink+cyan clash, floating tags",
    preview: "linear-gradient(135deg, #FDF2F8 0%, #EC4899 50%, #0891B2 100%)",
  },
  {
    value: "tpl-blog",
    icon: "style-tpl-blog",
    label: "暖调书卷",
    labelEn: "Warm Literary",
    desc: "暖色调、衬线字体、纸质纹理、博客卡片、时间线",
    descEn: "Warm earthy tones, serif fonts, grain texture, blog cards, timeline",
    preview: "linear-gradient(135deg, #fdfbf7 0%, #f5f0e8 50%, #b85c38 200%)",
  },
  {
    value: "custom",
    icon: "pencil",
    label: "自定义",
    labelEn: "Custom",
    desc: "用自己的话描述理想的视觉风格",
    descEn: "Describe your ideal visual style in your own words",
    preview: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  },
];

// Keep backward compat export
export const THEME_OPTIONS = ALL_THEME_OPTIONS;

/** Styles to hide when site type is "portfolio" */
const PORTFOLIO_HIDDEN_STYLES: ThemeStyle[] = [
  "cyberpunk",
  "cinematic",
  "neo-tokyo",
  "gradient-mesh",
  "nature",
  "tpl-resume-dark",
  "bold-creative",
  "editorial",
  "tpl-business",
  "retro",
];

/**
 * Return style options filtered by site type.
 */
export function getStylesForSiteType(siteType: string | null): QuestionOption<ThemeStyle>[] {
  if (siteType === "portfolio") {
    return ALL_THEME_OPTIONS.filter(o => !PORTFOLIO_HIDDEN_STYLES.includes(o.value));
  }
  return ALL_THEME_OPTIONS;
}

