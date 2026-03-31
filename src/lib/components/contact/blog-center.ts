// contact/blog-center.ts
// Extracted from genBlogPage — centered box with CTA text.
import type { SectionContext, SectionVariantFn } from "../types";

export const contactBlogCenter: SectionVariantFn = (ctx) => {
  return `
      <section className="blog-section" id="contact">
        <div className="blog-section-header blog-reveal">
          <div className="blog-section-label">Contact</div>
          <h2 className="blog-section-title">{t.sections.contact || t.nav.contact}</h2>
          <div className="blog-section-line" />
        </div>
        <div className="blog-contact-box blog-reveal blog-reveal-d1">
          <p>{t.ui.openForOpportunities}</p>
          ${ctx.data.email ? `<a href="mailto:${ctx.data.email}" className="blog-contact-btn">{"\\u2709 "}${ctx.data.email}</a>` : ""}
        </div>
      </section>`;
};
