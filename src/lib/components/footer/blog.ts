// footer/blog.ts
// Extracted from genBlogPage — grain effect + copyright.
import type { SectionContext, SectionVariantFn } from "../types";

export const footerBlog: SectionVariantFn = (ctx) => {
  return `
      <footer className="blog-footer">
        <div className="blog-footer-inner">
          <div className="blog-footer-copy">{t.footer}</div>
        </div>
      </footer>`;
};
