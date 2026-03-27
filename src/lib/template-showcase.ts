export interface TemplateCase {
  id: string;
  name: string;
  nameCn: string;
  client: string;
  clientCn: string;
  description: string;
  descriptionCn: string;
  category: string;
  categoryCn: string;
  previewUrl: string;
  features: string[];
  featuresCn: string[];
  style: string;
  styleCn: string;
  palette: string[];
  tagline: string;
  taglineCn: string;
  theme: string;
  layout: string;
  starterPrompt: string;
  starterPromptCn: string;
  mockPrd: string;
  mockPrdCn: string;
  mockResources: Array<{
    id: string;
    title: string;
    category: string;
    sourceName: string;
    sourceType: string;
  }>;
}

export const TEMPLATE_CASES: TemplateCase[] = [
  {
    id: "portfolio-developer",
    name: "Developer Portfolio",
    nameCn: "开发者个人网站",
    client: "Aiden Zhou",
    clientCn: "周艾登",
    description: "A mock personal portfolio for a senior frontend engineer, with project highlights, work history, tech stack, and a direct contact funnel.",
    descriptionCn: "虚构的高级前端工程师个人网站，包含项目精选、工作经历、技术栈和明确的联系转化入口。",
    category: "portfolio",
    categoryCn: "个人网站",
    previewUrl: "/templates/resume-demo.html",
    features: ["Project case studies", "Work timeline", "Tech stack", "Hire-me CTA"],
    featuresCn: ["项目案例", "工作时间线", "技术栈", "合作 CTA"],
    style: "Cyberpunk / Dark Tech",
    styleCn: "赛博朋克 / 暗色科技",
    palette: ["#00fff0", "#0a0a1a", "#ff00ff"],
    tagline: "A bold personal site for a product-minded engineer.",
    taglineCn: "偏产品思维的工程师个人站案例。",
    theme: "cyberpunk",
    layout: "sidebar",
    starterPrompt: "Use this template, but rewrite it around my own projects, experience, and hiring goals.",
    starterPromptCn: "使用这个模板，但把内容改成基于我的项目经历、工作经验和求职目标。",
    mockPrd: `# Developer Portfolio PRD

## Positioning
Create a bold portfolio for a senior frontend engineer who works across product thinking, design systems, and AI interfaces.

## Audience
- Founders and product leaders looking for an experienced frontend lead
- Design-forward startups looking for a builder with strong execution
- Potential collaborators who want to scan projects quickly

## Goals
- Make the owner's positioning clear within the first screen
- Showcase 3 flagship project case studies
- Present work history and technical depth without feeling like a resume dump
- Drive visitors toward a direct contact action

## Recommended Structure
1. Hero with a strong one-line positioning statement
2. Selected projects with impact metrics
3. Work timeline
4. Technical strengths and preferred stack
5. Contact CTA

## Visual Direction
- Cyberpunk-inspired but still readable
- Terminal-style details and dark tech atmosphere
- High-contrast CTA and compact side navigation
`,
    mockPrdCn: `# 开发者个人网站 PRD

## 定位
为一位兼具产品思维、设计系统经验和 AI 界面经验的高级前端工程师创建一个有冲击力的个人网站。

## 目标用户
- 寻找资深前端负责人或核心工程师的创业者与产品负责人
- 需要设计感和执行力并重的科技团队
- 希望快速了解项目能力的潜在合作方

## 核心目标
- 首屏明确表达站主定位
- 展示 3 个代表性项目及其影响力
- 呈现工作经历和技术深度，但不要像传统简历堆砌
- 把访客引导到直接联系动作

## 推荐结构
1. 有明确定位语的 Hero
2. 带结果指标的精选项目
3. 工作时间线
4. 技术能力与常用栈
5. 联系 CTA

## 视觉方向
- 赛博朋克灵感，但仍然保持可读性
- 带终端感的细节和暗色科技氛围
- 高对比 CTA 和紧凑型侧边导航
`,
    mockResources: [
      { id: "tpl-dev-1", title: "精选项目案例清单", category: "projects", sourceName: "Template Starter Pack", sourceType: "template" },
      { id: "tpl-dev-2", title: "个人经历摘要", category: "about", sourceName: "Template Starter Pack", sourceType: "template" },
      { id: "tpl-dev-3", title: "合作与联系策略", category: "contact", sourceName: "Template Starter Pack", sourceType: "template" },
    ],
  },
  {
    id: "brand-studio",
    name: "Brand Studio Site",
    nameCn: "品牌工作室官网",
    client: "Luma Atelier",
    clientCn: "Luma 品牌工作室",
    description: "A fictional boutique branding studio site with service overview, selected client stories, process walkthrough, and a strong premium tone.",
    descriptionCn: "虚构的精品品牌工作室官网，包含服务介绍、客户案例、合作流程和更强的高级品牌感。",
    category: "brand",
    categoryCn: "品牌官网",
    previewUrl: "/templates/brand-demo.html",
    features: ["Service sections", "Brand case stories", "Process overview", "Lead capture CTA"],
    featuresCn: ["服务模块", "品牌案例故事", "流程介绍", "线索收集 CTA"],
    style: "Glassmorphism / Premium",
    styleCn: "玻璃拟态 / 高级感",
    palette: ["#c89bda", "#1a1225", "#f0e8f5"],
    tagline: "A premium studio homepage with clear conversion flow.",
    taglineCn: "有明确转化路径的高端工作室官网案例。",
    theme: "glassmorphism",
    layout: "split",
    starterPrompt: "Use this as the starting point, but swap in my real services, portfolio, and tone of voice.",
    starterPromptCn: "以这个案例为起点，但把服务内容、作品案例和品牌语气替换成我的真实信息。",
    mockPrd: `# Brand Studio Site PRD

## Positioning
Build a premium homepage for a boutique branding studio focused on strategy, identity systems, and launch support.

## Audience
- Startup founders building a premium brand
- Consumer brands preparing a repositioning
- Marketing leads comparing studio partners

## Goals
- Communicate trust and premium taste immediately
- Explain services clearly without sounding generic
- Present selected case stories and process
- Capture leads through a high-intent CTA

## Recommended Structure
1. Hero with studio promise
2. Service overview
3. Selected case stories
4. Studio process
5. Founder note
6. Inquiry CTA

## Visual Direction
- Premium editorial typography
- Glass layers and soft lighting
- Spacious layout with elegant pacing
`,
    mockPrdCn: `# 品牌工作室官网 PRD

## 定位
为一家专注于品牌策略、视觉识别和发布支持的精品工作室打造高端官网首页。

## 目标用户
- 正在打造高端品牌的创业者
- 准备做品牌升级的消费品牌团队
- 正在筛选合作方的市场负责人

## 核心目标
- 在首屏迅速传达信任感和审美水准
- 清晰解释服务内容，但不能显得过于模板化
- 展示精选案例故事与合作流程
- 通过高意图 CTA 获取线索

## 推荐结构
1. 带工作室承诺的 Hero
2. 服务概览
3. 精选案例故事
4. 合作流程
5. 创始人介绍
6. 咨询 CTA

## 视觉方向
- 高级编辑风排版
- 玻璃层次与柔光效果
- 更舒展的节奏与留白
`,
    mockResources: [
      { id: "tpl-brand-1", title: "服务模块框架", category: "services", sourceName: "Template Starter Pack", sourceType: "template" },
      { id: "tpl-brand-2", title: "案例叙事脚本", category: "storytelling", sourceName: "Template Starter Pack", sourceType: "template" },
      { id: "tpl-brand-3", title: "品牌语气指南", category: "branding", sourceName: "Template Starter Pack", sourceType: "template" },
    ],
  },
  {
    id: "editorial-blog",
    name: "Editorial Blog",
    nameCn: "内容博客网站",
    client: "Mira Notes",
    clientCn: "Mira 内容手记",
    description: "A story-first mock blog for a writer and creative strategist, designed for essays, reading notes, newsletters, and personal ideas.",
    descriptionCn: "面向写作者和创意策略顾问的虚构博客案例，适合长文、阅读笔记、Newsletter 和个人表达。",
    category: "blog",
    categoryCn: "博客",
    previewUrl: "/templates/blog-demo.html",
    features: ["Long-form reading", "Article cards", "Author intro", "Issue archive"],
    featuresCn: ["长文阅读", "文章卡片", "作者介绍", "期刊归档"],
    style: "Editorial / Warm Tones",
    styleCn: "编辑风 / 暖色调",
    palette: ["#b85c38", "#fdf7f0", "#1c1917"],
    tagline: "A soft editorial experience for thoughtful writing.",
    taglineCn: "偏内容叙事的编辑风博客案例。",
    theme: "editorial",
    layout: "single-column",
    starterPrompt: "Use this editorial template, but adapt the sections to my writing topics, audience, and publishing rhythm.",
    starterPromptCn: "使用这个编辑风模板，但把栏目结构改成适合我的写作主题、读者和更新节奏。",
    mockPrd: `# Editorial Blog PRD

## Positioning
Create a calm, writer-first website for essays, reading notes, and newsletter issues.

## Audience
- Readers who enjoy reflective long-form writing
- Creative professionals following the author's thinking
- Newsletter subscribers looking for archives and topic entry points

## Goals
- Make the latest writing feel inviting
- Support long-form reading with strong typography
- Highlight recurring themes and issue archives
- Build an email subscription habit

## Recommended Structure
1. Author intro hero
2. Featured essay
3. Latest writing grid
4. Topic collections
5. Newsletter archive
6. About and subscribe CTA

## Visual Direction
- Warm paper-like tones
- Editorial typography hierarchy
- Quiet, content-first composition
`,
    mockPrdCn: `# 内容博客网站 PRD

## 定位
打造一个偏写作者表达的内容网站，用于发布长文、阅读笔记和 Newsletter。

## 目标用户
- 喜欢思考型长文的读者
- 持续关注作者观点的创意从业者
- 想快速进入归档和主题专栏的订阅者

## 核心目标
- 让最新内容更有吸引力
- 用更好的排版支持长文阅读
- 突出长期主题和归档结构
- 建立邮件订阅习惯

## 推荐结构
1. 作者介绍 Hero
2. 精选长文
3. 最新文章网格
4. 主题专栏
5. Newsletter 归档
6. 关于与订阅 CTA

## 视觉方向
- 温暖纸张质感
- 更明显的编辑排版层级
- 安静、内容优先的构图
`,
    mockResources: [
      { id: "tpl-blog-1", title: "栏目与主题清单", category: "content", sourceName: "Template Starter Pack", sourceType: "template" },
      { id: "tpl-blog-2", title: "Newsletter 归档样例", category: "newsletter", sourceName: "Template Starter Pack", sourceType: "template" },
      { id: "tpl-blog-3", title: "作者简介文案", category: "about", sourceName: "Template Starter Pack", sourceType: "template" },
    ],
  },
  {
    id: "saas-launch",
    name: "SaaS Product Launch",
    nameCn: "SaaS 产品官网",
    client: "SignalDesk",
    clientCn: "SignalDesk",
    description: "A fictional SaaS marketing site focused on product value, feature sections, social proof, pricing callouts, and demo booking.",
    descriptionCn: "虚构的 SaaS 产品官网，突出价值主张、功能区块、社交证明、价格引导和预约演示。",
    category: "saas",
    categoryCn: "SaaS 官网",
    previewUrl: "/templates/saas-demo.html",
    features: ["Feature breakdown", "Social proof", "Pricing CTA", "Demo funnel"],
    featuresCn: ["功能拆解", "社交证明", "价格 CTA", "演示转化"],
    style: "Bold Creative / Launch",
    styleCn: "大胆创意 / 发布页",
    palette: ["#ff6b6b", "#fffbeb", "#4d96ff"],
    tagline: "A high-energy SaaS landing page for launches and demos.",
    taglineCn: "适合新品发布和预约演示的 SaaS 官网案例。",
    theme: "gradient-mesh",
    layout: "split",
    starterPrompt: "Use this SaaS launch structure, but rewrite the value prop, features, and metrics around my product.",
    starterPromptCn: "使用这个 SaaS 发布页结构，但把价值主张、功能和指标改成适合我的产品。",
    mockPrd: `# SaaS Launch Site PRD

## Positioning
Launch a conversion-focused marketing site for a SaaS tool that helps operations teams turn fragmented alerts into actionable workflows.

## Audience
- Operations and support leaders
- Product teams evaluating workflow automation tools
- Founders booking demos for enterprise buyers

## Goals
- Explain the product value in one screen
- Break down the product into 3 to 4 clear capability sections
- Build trust with metrics, logos, and proof
- Push visitors toward demo booking

## Recommended Structure
1. Hero with core outcome and CTA
2. Product workflow breakdown
3. Feature panels
4. Social proof and metrics
5. Pricing or pilot CTA
6. FAQ and demo booking

## Visual Direction
- Launch energy with bright gradients
- Product UI framed inside the page
- Modular panels and metric callouts
`,
    mockPrdCn: `# SaaS 产品官网 PRD

## 定位
为一个帮助运营团队把分散告警转成可执行流程的 SaaS 产品打造强转化的营销官网。

## 目标用户
- 运营和支持团队负责人
- 正在评估流程自动化工具的产品团队
- 需要预约演示的企业客户

## 核心目标
- 在首屏讲清楚产品价值
- 用 3 到 4 个模块清晰拆解产品能力
- 通过指标、客户证明和品牌背书建立信任
- 把访客引导到预约演示

## 推荐结构
1. 带核心结果与 CTA 的 Hero
2. 产品工作流拆解
3. 功能面板
4. 社会证明与指标
5. 价格或试点 CTA
6. FAQ 与演示预约

## 视觉方向
- 带发布感的明亮渐变
- 页面中嵌入产品 UI 画面
- 模块化信息面板与指标提示
`,
    mockResources: [
      { id: "tpl-saas-1", title: "价值主张框架", category: "product", sourceName: "Template Starter Pack", sourceType: "template" },
      { id: "tpl-saas-2", title: "功能模块草案", category: "features", sourceName: "Template Starter Pack", sourceType: "template" },
      { id: "tpl-saas-3", title: "社交证明与 FAQ", category: "proof", sourceName: "Template Starter Pack", sourceType: "template" },
    ],
  },
  {
    id: "story-portfolio",
    name: "Story Portfolio",
    nameCn: "叙事型个人作品集",
    client: "Aya Lin",
    clientCn: "林绫",
    description: "A fictional multidisciplinary designer portfolio with softer storytelling, project narratives, visual mood blocks, and an emotional brand voice.",
    descriptionCn: "虚构的跨学科设计师作品集，强调故事表达、项目叙事、情绪化视觉和更柔和的品牌语气。",
    category: "portfolio",
    categoryCn: "个人网站",
    previewUrl: "/templates/story-demo.html",
    features: ["Story-led sections", "Mood-based layout", "Case narratives", "Soft visual rhythm"],
    featuresCn: ["故事型模块", "情绪化版式", "案例叙事", "柔和节奏"],
    style: "Ghibli / Storytelling",
    styleCn: "吉卜力 / 叙事感",
    palette: ["#7d9b5f", "#f5efe6", "#e8a87c"],
    tagline: "A gentler personal site with stronger narrative presence.",
    taglineCn: "更温柔、更有故事感的个人网站案例。",
    theme: "nature",
    layout: "single-column",
    starterPrompt: "Use this story-driven portfolio, but retell it with my own projects, bio, and emotional tone.",
    starterPromptCn: "使用这个叙事型作品集，但把故事、项目和个人语气替换成我的真实内容。",
    mockPrd: `# Story Portfolio PRD

## Positioning
Build a story-led portfolio for a multidisciplinary designer whose work sits between product, illustration, and visual storytelling.

## Audience
- Creative directors and founders
- Brand teams looking for a designer with a voice
- Collaborators interested in process and narrative

## Goals
- Let the site feel personal and memorable
- Present projects as chapters instead of plain cards
- Balance emotion with professional clarity
- Encourage thoughtful inquiries

## Recommended Structure
1. Mood-setting hero
2. Short personal manifesto
3. Chapter-style project stories
4. Process or values section
5. Gentle contact CTA

## Visual Direction
- Nature-inspired, soft pacing
- Floating decorative elements
- More atmospheric whitespace and storytelling rhythm
`,
    mockPrdCn: `# 叙事型个人作品集 PRD

## 定位
为一位跨产品、插画与视觉叙事的设计师打造一个带故事感的个人作品集。

## 目标用户
- 创意总监与创业者
- 希望找到有个人表达能力设计师的品牌团队
- 关注过程与叙事表达的潜在合作方

## 核心目标
- 让网站更个人化、更容易被记住
- 把项目呈现为章节，而不是普通卡片
- 在情绪感和专业清晰之间取得平衡
- 引导更有质量的合作咨询

## 推荐结构
1. 建立氛围的 Hero
2. 简短个人宣言
3. 章节式项目故事
4. 过程或价值观模块
5. 柔和的联系 CTA

## 视觉方向
- 自然系、缓慢节奏
- 漂浮装饰元素
- 更有情绪层次的留白和叙事节奏
`,
    mockResources: [
      { id: "tpl-story-1", title: "项目章节大纲", category: "storytelling", sourceName: "Template Starter Pack", sourceType: "template" },
      { id: "tpl-story-2", title: "个人宣言草案", category: "about", sourceName: "Template Starter Pack", sourceType: "template" },
      { id: "tpl-story-3", title: "视觉情绪板说明", category: "style", sourceName: "Template Starter Pack", sourceType: "template" },
    ],
  },
  {
    id: "future-product",
    name: "Future Product Site",
    nameCn: "未来感产品页",
    client: "NeonFlow OS",
    clientCn: "NeonFlow OS",
    description: "A fictional product site for an AI operations platform, built around technical trust, modular panels, and a futuristic visual language.",
    descriptionCn: "虚构的 AI 运维平台产品页案例，强调技术可信度、模块化信息面板和未来感视觉语言。",
    category: "product",
    categoryCn: "产品官网",
    previewUrl: "/templates/product-demo.html",
    features: ["System modules", "Feature panels", "Use cases", "Technical trust"],
    featuresCn: ["系统模块", "功能面板", "使用场景", "技术可信度"],
    style: "Neo Tokyo / Product",
    styleCn: "霓虹东京 / 产品页",
    palette: ["#ff2e63", "#0d0d0d", "#08d9d6"],
    tagline: "A future-facing product site with dense but stylish structure.",
    taglineCn: "更偏科技感和信息密度的产品官网案例。",
    theme: "neo-tokyo",
    layout: "card-grid",
    starterPrompt: "Use this future-product template, but adapt the modules, proof points, and product language to my actual offer.",
    starterPromptCn: "使用这个未来感产品页模板，但把模块、背书和产品语言替换成我的真实产品信息。",
    mockPrd: `# Future Product Site PRD

## Positioning
Create a dense but polished product site for an AI operations platform with multiple system modules and a technical buyer audience.

## Audience
- CTOs and engineering managers
- Platform and infra teams
- Buyers who care about reliability, visibility, and integration depth

## Goals
- Build trust through technical structure and clarity
- Introduce the system as a platform, not a single feature
- Show use cases and modular architecture
- Convert enterprise interest into contact or demo actions

## Recommended Structure
1. High-density hero with platform framing
2. System architecture panels
3. Use cases by team
4. Reliability and compliance proof
5. Contact / demo CTA

## Visual Direction
- Futuristic information panels
- Neon accents on dark surfaces
- Dense but highly organized layout
`,
    mockPrdCn: `# 未来感产品页 PRD

## 定位
为一个面向技术采购者、拥有多个系统模块的 AI 运维平台打造高信息密度但仍然精致的产品网站。

## 目标用户
- CTO 与工程负责人
- 平台和基础设施团队
- 在意可靠性、可观测性和集成深度的采购方

## 核心目标
- 通过技术结构和清晰表达建立信任
- 把产品介绍成平台，而不是单个功能
- 展示多种使用场景和模块化架构
- 把企业兴趣转化成咨询或演示

## 推荐结构
1. 高信息密度 Hero
2. 系统架构面板
3. 按团队拆分的使用场景
4. 可靠性与合规证明
5. 联系 / 演示 CTA

## 视觉方向
- 未来感信息面板
- 暗色表面上的霓虹点缀
- 高密度但有秩序的布局
`,
    mockResources: [
      { id: "tpl-product-1", title: "模块化系统地图", category: "architecture", sourceName: "Template Starter Pack", sourceType: "template" },
      { id: "tpl-product-2", title: "使用场景与角色", category: "use-cases", sourceName: "Template Starter Pack", sourceType: "template" },
      { id: "tpl-product-3", title: "合规与可信度文案", category: "trust", sourceName: "Template Starter Pack", sourceType: "template" },
    ],
  },
];
