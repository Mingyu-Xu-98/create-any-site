// layouts/split.ts
// Extracted from genSplitPage — 50/50 split layout.
import type { SectionContext, LayoutWrapperFn, PageParts } from "../types";
import { getStyleBgMarkup } from "../../generator-utils";

export const layoutSplit: LayoutWrapperFn = (ctx, parts) => {
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
    <>
      ${styleBg}
      ${effectJsx}
      <div className="split-layout theme-divider-${ctx.theme}">
        ${parts.nav}

        <div className="split-right">
          ${parts.hero}

          ${sectionJsx}

          ${parts.footer}
        </div>
      </div>
      <SharePoster />
      <ChatBot />
    </>
  );
}
`;
};
