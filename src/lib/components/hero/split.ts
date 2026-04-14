// hero/split.ts
// Extracted from genBoldResumePage — 2-column hero with avatar frame + floating tags.
// Left side: label, name heading, subtitle, CTA buttons.
// Right side: avatar in decorative frame with floating skill tags.
import type { SectionContext, SectionVariantFn } from "../types";

export const heroSplit: SectionVariantFn = (ctx) => {
  const { data } = ctx;
  const initials = (data.nameEn || data.name)
    .split(/\s+/)
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const floatingTags = data.tags.slice(0, 3);

  return `
        {/* Hero */}
        <section className="bold-hero">
          <div className="bold-hero-text">
            <span className="bold-hero-label">// {t.ui.availableForHire}</span>
            <h1>{t.ui.heyIm}</h1>
            <p className="bold-hero-subtitle">
              {lang === "zh" ? "${data.title}" : "${data.titleEn || data.title}"}
            </p>
            <div className="flex gap-4 flex-wrap">
              {t.nav.contact && <a href="#contact" className="btn-bold btn-bold-primary">{t.nav.contact}</a>}
              {t.nav.projects && <a href="#projects" className="btn-bold btn-bold-outline">{t.nav.projects}</a>}
            </div>
          </div>
          <div className="bold-hero-visual">
            <div className="avatar-frame">
              <Image src="/images/avatar.png" alt="" width={340} height={340} className="avatar-frame-img" style={{width:"100%",height:"100%",objectFit:"cover"}} unoptimized onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }} />
              <span className="avatar-text hidden">${initials}</span>
              <div className="floating-tag tag-1">${floatingTags[0] || data.tags[0] || ""}</div>
              <div className="floating-tag tag-2">${floatingTags[1] || data.tags[1] || ""}</div>
              <div className="floating-tag tag-3">${floatingTags[2] || data.tags[2] || ""}</div>
            </div>
          </div>
        </section>`;
};
