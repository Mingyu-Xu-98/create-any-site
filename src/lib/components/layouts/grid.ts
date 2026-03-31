// layouts/grid.ts
// Extracted from genGridPage — grid-based layout (same shell as single, for grid project variants).
import type { SectionContext, LayoutWrapperFn, PageParts } from "../types";
import { getStyleBgMarkup } from "../../generator-utils";

export const layoutGrid: LayoutWrapperFn = (ctx, parts) => {
  const styleBg = getStyleBgMarkup(ctx.theme);
  const effectImports = parts.effects.flatMap(e => e.imports).filter(Boolean);
  const effectJsx = parts.effects.map(e => e.jsx).filter(Boolean).join("\n");
  const sectionJsx = parts.sections.map(s => s.content).join("\n\n");

  const allImports = [
    `"use client";`,
    `import { useLanguage } from "@/components/LanguageProvider";`,
    `import Image from "next/image";`,
    `import ChatBot from "@/components/ChatBot";`,
    `import SharePoster from "@/components/SharePoster";`,
    ...effectImports,
  ].filter(Boolean).join("\n");

  return `${allImports}

export default function Home() {
  const { lang, t, toggle } = useLanguage();

  return (
    <div className="min-h-screen relative bg-bg text-text theme-divider-${ctx.theme}">
      ${styleBg}
      ${effectJsx}
      <div className="relative z-10">
        ${parts.nav}

        ${parts.hero}

        ${sectionJsx}

        ${parts.footer}
      </div>
      <SharePoster />
      <ChatBot />
    </div>
  );
}
`;
};
