// footer/standard.ts
// Common pattern from genSingleColumnPage / genSidebarPage / genSplitPage — copyright + name.
import type { SectionContext, SectionVariantFn } from "../types";

export const footerStandard: SectionVariantFn = (ctx) => {
  return `
        <footer className="border-t border-line">
          <div className="max-w-[1100px] mx-auto px-6 py-8 text-center">
            <p className="text-sm text-text-muted">{t.footer}</p>
          </div>
        </footer>`;
};
