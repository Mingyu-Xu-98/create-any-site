// hero/centered.ts
// Extracted from genThemeShowcaseHero — used by genSingleColumnPage and genGridPage.
// Two-column layout: copy block (kicker + title + subtitle + CTA buttons + tag row)
// paired with a theme-specific visual panel (terminal, poster, retro card, etc.).
import type { SectionContext, SectionVariantFn } from "../types";
import type { ThemeStyle } from "../../types";

function themeVisual(theme: ThemeStyle): string {
  if (theme === "cyberpunk") {
    return `
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
            </div>`;
  }
  if (theme === "cinematic") {
    return `
            <div className="showcase-poster-frame">
              <div className="showcase-poster-noise" />
              <div className="showcase-poster-label">Scene 01</div>
              <div className="showcase-poster-title">{t.hero.lines[0]?.replace("> ", "") || t.ui.heyIm}</div>
              <div className="showcase-poster-subtitle">{t.hero.lines[1]?.replace("> ", "") || ""}</div>
            </div>`;
  }
  if (theme === "retro") {
    return `
            <div className="showcase-retro-stack">
              <div className="showcase-retro-card">
                <div className="showcase-retro-sticker">{t.hero.tags[0] || "Now"}</div>
                <div className="showcase-retro-initials">{t.hero.lines[0]?.replace("> ", "").slice(0, 2)}</div>
              </div>
              <div className="showcase-retro-shadow" />
            </div>`;
  }
  if (theme === "nature") {
    return `
            <div className="showcase-nature-panel">
              <div className="showcase-nature-sun" />
              <div className="showcase-nature-hill hill-1" />
              <div className="showcase-nature-hill hill-2" />
              <div className="showcase-nature-copy">{t.about.tags.slice(0, 3).join(" · ")}</div>
            </div>`;
  }
  if (theme === "neo-tokyo") {
    return `
            <div className="showcase-tokyo-panel">
              <div className="showcase-tokyo-grid" />
              <div className="showcase-tokyo-copy">
                <span className="showcase-tokyo-kicker">// signal</span>
                <strong>{t.hero.lines[0]?.replace("> ", "") || t.ui.heyIm}</strong>
                <span>{t.hero.lines[1]?.replace("> ", "") || ""}</span>
              </div>
            </div>`;
  }
  // default / gradient-mesh / glassmorphism / etc.
  return `
            <div className="showcase-orbital-panel">
              <div className="showcase-orbital-ring ring-1" />
              <div className="showcase-orbital-ring ring-2" />
              <div className="showcase-orbital-core">{t.hero.tags[0] || "AI"}</div>
            </div>`;
}

function themeHeroClass(theme: ThemeStyle): string {
  const map: Partial<Record<ThemeStyle, string>> = {
    cyberpunk: "theme-hero-cyberpunk",
    cinematic: "theme-hero-cinematic",
    retro: "theme-hero-retro",
    nature: "theme-hero-nature",
    "gradient-mesh": "theme-hero-gradient-mesh",
    "neo-tokyo": "theme-hero-neo-tokyo",
  };
  return map[theme] || "theme-hero-default";
}

export const heroCentered: SectionVariantFn = (ctx) => {
  const visual = themeVisual(ctx.theme);
  const heroClass = themeHeroClass(ctx.theme);

  return `
        <section className="max-w-[1100px] mx-auto px-6 pt-20 pb-14">
          <div className="showcase-hero ${heroClass}">
            <div className="showcase-copy">
              <span className="showcase-kicker">{t.ui.availableForHire}</span>
              <h1 className="showcase-title">{t.hero.lines[0]?.replace("> ", "") || t.ui.heyIm}</h1>
              <p className="showcase-subtitle">{t.hero.lines[1]?.replace("> ", "") || t.about.text}</p>
              <div className="showcase-actions">
                <a href="#projects" className="showcase-btn showcase-btn-primary">{t.nav.projects}</a>
                <a href="#contact" className="showcase-btn showcase-btn-secondary">{t.nav.contact}</a>
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
