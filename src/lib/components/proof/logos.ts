// proof/logos.ts — Partner/client logo grid row
import type { SectionVariantFn } from "../types";

export const proofLogos: SectionVariantFn = (ctx) => {
  return `
        <section id="logos" className="max-w-[1100px] mx-auto px-6 py-16">
          <p className="text-center text-text/40 text-sm uppercase tracking-widest mb-10">
            {lang === "zh" ? "受到以下品牌的信赖" : "Trusted by leading brands"}
          </p>
          <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-8 opacity-60 hover:opacity-100 transition-opacity">
            {["Acme Corp", "Globex", "Initech", "Hooli", "Pied Piper", "Umbrella"].map((name) => (
              <div key={name} className="flex items-center justify-center h-12 px-6 rounded-lg bg-card border border-border">
                <span className="text-lg font-semibold tracking-tight text-text/70">{name}</span>
              </div>
            ))}
          </div>
        </section>`;
};
