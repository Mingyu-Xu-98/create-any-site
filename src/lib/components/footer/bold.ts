// footer/bold.ts
// Extracted from genBoldResumePage — with social links.
import type { SectionContext, SectionVariantFn } from "../types";

export const footerBold: SectionVariantFn = (ctx) => {
  return `
      <footer className="bold-footer">
        <p>{t.footer}</p>
      </footer>`;
};
