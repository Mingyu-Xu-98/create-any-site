# UI Skill — 设计系统搜索与生成引擎

> **Note:** This file is superseded by `SKILL.md` (standard skill format with YAML frontmatter). This file is kept for backward compatibility with platforms that read `index.md`.

## 触发条件（When to Activate）

当需要为网站生成配色方案、字体搭配、设计系统推荐、或查询专业 UI/UX 最佳实践时激活。适用于选择设计方向、生成完整设计系统、查询特定领域的设计规范。

## 概述

UI Skill 是一个基于 BM25 的设计知识搜索引擎 + 智能设计系统生成器。内置 15 个 CSV 知识库（涵盖风格、配色、排版、图表、落地页、UX 指南等），支持按领域搜索和跨领域推理，能够为任何产品类型自动生成完整的设计系统。

## 架构

```
用户需求 → BM25 搜索引擎（core.py）→ 设计系统推理器（design_system.py）→ 结构化推荐
                                    ↓
                         15 个 CSV 知识库（data/）
```

## 核心工作流

### 第 1 步：分析需求
确定产品类型、目标受众、风格关键词、技术栈。

### 第 2 步：生成设计系统（核心功能）
```bash
python scripts/search.py "<产品描述>" --design-system
```
自动推理并生成完整设计系统，包括：配色方案、字体搭配、设计模式、效果建议、反模式警告。

### 第 3 步：按需补充搜索
```bash
python scripts/search.py "<关键词>" --domain <领域>
```

## 知识库清单（15 个 CSV）

| 文件 | 内容 | 条目规模 |
|------|------|---------|
| **products.csv** | 按产品类型的设计推荐（SaaS/电商/金融等） | 58KB |
| **styles.csv** | 完整 UI 风格数据库，含技术关键词和设计变量 | 143KB |
| **colors.csv** | 按产品类型的配色方案，含语义化色彩 token | 32KB |
| **typography.csv** | 字体搭配数据库，含氛围/风格关键词 | 50KB |
| **charts.csv** | 图表类型推荐，含可访问性和库选择指南 | 20KB |
| **landing.csv** | 落地页模式，含 CTA 策略和转化优化 | 17KB |
| **ux-guidelines.csv** | UX 最佳实践，含 Do's/Don'ts 和代码示例 | 19KB |
| **google-fonts.csv** | 完整 Google Fonts 数据库 | 745KB |
| **icons.csv** | 图标推荐及语义含义 | 21KB |
| **design.csv** | 综合设计知识库 | 106KB |
| **app-interface.csv** | App 界面规范（iOS/Android/React Native） | 10KB |
| **react-performance.csv** | React/Next.js 性能优化最佳实践 | 15KB |
| **ui-reasoning.csv** | AI 推理规则（用于设计系统生成） | 53KB |
| **draft.csv** | 备选推荐 | 106KB |
| **stacks/react-native.csv** | React Native 专属指南 | — |

## 搜索领域（10 个 Domain）

| 领域 | 关键词示例 | 用途 |
|------|-----------|------|
| `style` | minimalist, brutalist, glassmorphism | 查询 UI 风格指南 |
| `color` | SaaS, fintech, healthcare | 按产品类型获取配色 |
| `typography` | modern, editorial, playful | 查询字体搭配 |
| `chart` | time series, comparison, distribution | 图表类型选择 |
| `landing` | SaaS pricing, startup hero | 落地页模式 |
| `product` | e-commerce, social media | 产品类型推荐 |
| `ux` | form validation, empty states | UX 最佳实践 |
| `google-fonts` | serif, display, handwriting | Google 字体搜索 |
| `icons` | navigation, action, status | 图标推荐 |
| `app-interface` | iOS navigation, Android material | App 界面规范 |

## 设计系统输出格式

生成的设计系统包含：
- **配色方案**：Primary, Secondary, Accent, Background, Surface, 语义色彩（success/error/warning）
- **字体搭配**：Heading Font + Body Font + 氛围关键词 + CSS Import
- **设计模式**：适合的布局模式、组件风格
- **效果建议**：阴影、动效、hover 状态
- **反模式警告**：该产品类型应避免的设计错误

## 持久化模式（Master + Overrides）

```bash
# 首次生成并持久化
python scripts/search.py "SaaS dashboard" --design-system --persist -p "MyProject"

# 按页面覆盖
python scripts/search.py "landing page" --design-system --persist -p "MyProject" --page "landing"
```

## 专业 UI 检查清单

交付前检查：
- [ ] 图标：矢量 SVG，无 emoji，品牌 logo 用官方资源
- [ ] 交互：点击反馈 <100ms，动画 200-500ms，禁用态明确
- [ ] 对比度：文字对比度 ≥ 4.5:1，可交互元素 ≥ 3:1
- [ ] 布局：安全区域适配，8dp 间距节奏，文本最大宽度 65-75ch
- [ ] 暗色模式：token 驱动，避免纯黑 #000，语义色彩适配

## 平台适配

支持 20+ 开发平台的模板：Claude Code, Cursor, Copilot, Windsurf, Codebuddy, Gemini 等。
