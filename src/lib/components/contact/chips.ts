// contact/chips.ts
// Extracted from genBoldResumePage — chip-style links.
import type { SectionContext, SectionVariantFn } from "../types";

export const contactChips: SectionVariantFn = (ctx) => {
  return `
        <section id="contact" className="bold-contact bold-reveal">
          <h2>{t.ui.letsCollaborate}</h2>
          <p>{t.ui.openForOpportunities}</p>
          <div className="bold-contact-links">
            <a href="mailto:${ctx.data.email}" className="contact-chip">${ctx.data.email}</a>
            ${ctx.data.github ? `<a href="${ctx.data.github}" target="_blank" className="contact-chip">GitHub</a>` : ""}
            ${ctx.data.linkedin ? `<a href="${ctx.data.linkedin}" target="_blank" className="contact-chip">LinkedIn</a>` : ""}
            ${ctx.data.location ? `<span className="contact-chip">{lang === "zh" ? "${ctx.data.location}" : "${ctx.data.locationEn || ctx.data.location}"}</span>` : ""}
          </div>
        </section>`;
};
