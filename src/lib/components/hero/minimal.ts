// hero/minimal.ts
// Extracted from genMinimalistPage — badge + centered avatar + stats cards below.
// Clean, airy hero with welcome badge, avatar, name, title, bio text, CTA buttons,
// and a scroll indicator. Stats cards rendered separately after the hero.
import type { SectionContext, SectionVariantFn } from "../types";

export const heroMinimal: SectionVariantFn = (ctx) => {
  const { data } = ctx;
  const projectCount = data.projects.length;
  const skillCount = data.skills.reduce((acc, g) => acc + g.skills.length, 0);
  const timelineCount = data.timeline.length;
  const eduCount = data.education.length;

  return `
      {/* Hero aurora background */}
      <div className="mini-hero-bg" />

      {/* ===== HERO SECTION ===== */}
      <section className="mini-hero">
        <div className="relative w-20 h-20 mx-auto mb-5">
          <Image src="/images/avatar.png" alt="" width={80} height={80} className="w-full h-full rounded-full object-cover border-2 border-line shadow-md" unoptimized />
        </div>
        <div className="mini-hero-badge">
          <span className="dot" />
          <span>{t.ui.welcomeToSite}</span>
        </div>
        <h1>{lang === "zh" ? "${data.name}" : "${data.nameEn}"}</h1>
        <p className="subtitle">{lang === "zh" ? "${data.title}" : "${data.titleEn}"}</p>
        <p className="text-sm text-text-muted max-w-lg mx-auto leading-relaxed">{t.about.text}</p>
        <div className="mini-hero-buttons">
          ${data.github ? `<a href="${data.github}" target="_blank" className="mini-btn-primary">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            GitHub
          </a>` : ""}
          <a href="mailto:${data.email}" className="mini-btn-secondary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            {t.ui.contactMe}
          </a>
        </div>
        <div className="mini-scroll-indicator">
          <span>{t.ui.scrollDown}</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
        </div>
      </section>

      {/* ===== STATS CARDS ===== */}
      <div className="mini-stats">
        <div className="mini-stat-card">
          <div className="mini-stat-value">${projectCount}</div>
          <div className="mini-stat-label">{t.ui.statLabels.projects}</div>
        </div>
        <div className="mini-stat-card">
          <div className="mini-stat-value">${skillCount}</div>
          <div className="mini-stat-label">{t.ui.statLabels.skills}</div>
        </div>
        <div className="mini-stat-card">
          <div className="mini-stat-value">${timelineCount}</div>
          <div className="mini-stat-label">{t.ui.statLabels.experiences}</div>
        </div>
        <div className="mini-stat-card">
          <div className="mini-stat-value">${eduCount}</div>
          <div className="mini-stat-label">{t.ui.statLabels.education}</div>
        </div>
      </div>`;
};
