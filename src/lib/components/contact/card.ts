// contact/card.ts
// Extracted from genMinimalistPage — contact info card embedded in the about section.
// The minimalist page includes location + email inline in the about section.
// This variant provides a standalone contact card for composition.
import type { SectionContext, SectionVariantFn } from "../types";

export const contactCard: SectionVariantFn = (ctx) => {
  return `
        <section id="contact" className="mb-16">
          <h2 className="section-heading">{t.sections.contact || t.nav.contact}</h2>
          <div className="mini-about">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-text-muted">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <span>{lang === "zh" ? "${ctx.data.location}" : "${ctx.data.locationEn}"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-text-muted">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                <span>${ctx.data.email}</span>
              </div>
              ${ctx.data.github ? `<div className="flex items-center gap-3 text-sm text-text-muted">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                <a href="${ctx.data.github}" target="_blank" className="hover:text-text transition-colors">GitHub</a>
              </div>` : ""}
            </div>
          </div>
        </section>`;
};
