// footer/minimal.ts
// Extracted from genBrutalistPage — just copyright line.
import type { SectionContext, SectionVariantFn } from "../types";

export const footerMinimal: SectionVariantFn = (ctx) => {
  return `
        <footer className="brutal-footer">{t.footer}</footer>`;
};
