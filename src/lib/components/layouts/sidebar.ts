// layouts/sidebar.ts
// Extracted from genSidebarPage — two-column with sidebar panel.
import type { SectionContext, LayoutWrapperFn, PageParts } from "../types";
import { getStyleBgMarkup } from "../../generator-utils";

export const layoutSidebar: LayoutWrapperFn = (ctx, parts) => {
  const styleBg = getStyleBgMarkup(ctx.theme);
  const effectImports = parts.effects.flatMap(e => e.imports).filter(Boolean);
  const effectJsx = parts.effects.map(e => e.jsx).filter(Boolean).join("\n");
  const sectionJsx = parts.sections.map(s => s.content).join("\n\n");

  const allImports = [
    `"use client";`,
    `import Image from "next/image";`,
    `import { useLanguage } from "@/components/LanguageProvider";`,
    `import ChatBot from "@/components/ChatBot";`,
    `import SharePoster from "@/components/SharePoster";`,
    ...effectImports,
  ].filter(Boolean).join("\n");

  return `${allImports}

export default function Home() {
  const { lang, t, toggle } = useLanguage();

  return (
    <>${styleBg}
      ${effectJsx}
      <div className="two-column-layout">
        ${parts.nav}

        <main className="content-panel theme-divider-${ctx.theme}">
          ${parts.hero}

          ${sectionJsx}

          ${parts.footer}
        </main>
      </div>
      <SharePoster />
      <ChatBot />
    </>
  );
}
`;
};
