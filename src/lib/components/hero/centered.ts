// hero/centered.ts
// Extracted from genThemeShowcaseHero — used by genSingleColumnPage and genGridPage.
// Two-column layout: copy block (kicker + title + subtitle + CTA buttons + tag row)
// paired with a theme-specific visual panel (terminal, poster, retro card, etc.).
import type { SectionContext, SectionVariantFn } from "../types";
import { getSemanticsFromContext } from "../theme-semantics";

// ---- Visual panels keyed by semantic heroVisual, not theme name ----

const HERO_VISUALS: Record<string, string> = {
  terminal: `
            <div className="showcase-terminal">
              <div className="showcase-terminal-bar">
                <span />
                <span />
                <span />
              </div>
              <div className="showcase-terminal-body">
                {t.hero.lines.slice(0, 4).map((line) => (
                  <div key={line} className="showcase-terminal-line">{line}</div>
                ))}
              </div>
            </div>`,
  poster: `
            <div className="showcase-poster-frame">
              <div className="showcase-poster-noise" />
              <div className="showcase-poster-label">Scene 01</div>
              <div className="showcase-poster-title">{t.hero.lines[0]?.replace("> ", "") || t.ui.heyIm}</div>
              <div className="showcase-poster-subtitle">{t.hero.lines[1]?.replace("> ", "") || ""}</div>
            </div>`,
  nature: `
            <div className="showcase-nature-panel">
              <div className="showcase-nature-sun" />
              <div className="showcase-nature-hill hill-1" />
              <div className="showcase-nature-hill hill-2" />
              <div className="showcase-nature-copy">{t.about.tags.slice(0, 3).join(" · ")}</div>
            </div>`,
  geometric: `
            <div className="showcase-tokyo-panel">
              <div className="showcase-tokyo-grid" />
              <div className="showcase-tokyo-copy">
                <span className="showcase-tokyo-kicker">// signal</span>
                <strong>{t.hero.lines[0]?.replace("> ", "") || t.ui.heyIm}</strong>
                <span>{t.hero.lines[1]?.replace("> ", "") || ""}</span>
              </div>
            </div>`,
  orbital: `
            <div className="showcase-orbital-panel">
              <div className="showcase-orbital-ring ring-1" />
              <div className="showcase-orbital-ring ring-2" />
              <div className="showcase-orbital-core">{t.hero.tags[0] || "AI"}</div>
            </div>`,
  none: `
            <div className="showcase-orbital-panel">
              <div className="showcase-orbital-ring ring-1" />
              <div className="showcase-orbital-ring ring-2" />
              <div className="showcase-orbital-core">{t.hero.tags[0] || "AI"}</div>
            </div>`,
};

const HERO_CLASS_MAP: Record<string, string> = {
  terminal: "theme-hero-cyberpunk",
  poster: "theme-hero-cinematic",
  nature: "theme-hero-nature",
  geometric: "theme-hero-neo-tokyo",
  orbital: "theme-hero-default",
  none: "theme-hero-default",
};

export const heroCentered: SectionVariantFn = (ctx) => {
  const sem = getSemanticsFromContext(ctx);
  const visual = HERO_VISUALS[sem.heroVisual] || HERO_VISUALS.orbital;
  const heroClass = HERO_CLASS_MAP[sem.heroVisual] || "theme-hero-default";

  return `
        <section className="max-w-[1100px] mx-auto px-6 pt-20 pb-14">
          <div className="showcase-hero ${heroClass}">
            <div className="showcase-copy">
              <span className="showcase-kicker">{t.ui.availableForHire}</span>
              <h1 className="showcase-title">{t.hero.lines[0]?.replace("> ", "") || t.ui.heyIm}</h1>
              <p className="showcase-subtitle">{t.hero.lines[1]?.replace("> ", "") || t.about.text}</p>
              <div className="showcase-actions">
                {t.nav.projects && <a href="#projects" className="showcase-btn showcase-btn-primary">{t.nav.projects}</a>}
                {t.nav.contact && <a href="#contact" className="showcase-btn showcase-btn-secondary">{t.nav.contact}</a>}
              </div>
              <div className="showcase-tag-row">
                {t.hero.tags.slice(0, 4).map((tag) => (<span key={tag} className="badge">{tag}</span>))}
              </div>
            </div>
            <div className="showcase-visual">
              ${visual}
            </div>
          </div>
        </section>`;
};
