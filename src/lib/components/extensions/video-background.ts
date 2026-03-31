/**
 * Video Background extension.
 * HTML5 video autoplay muted loop as page/section background.
 *
 * Config options:
 * - src: string (video URL or local path)
 * - poster: string (poster image URL)
 * - overlay: string (CSS color for overlay, e.g. "rgba(0,0,0,0.5)")
 * - position: "hero" | "fullpage" (default "hero")
 * - height: string (default "100vh" for fullpage, "80vh" for hero)
 */
import type { SectionContext } from "../types";
import type { ExtensionOutput } from "./types";
import { registerExtension } from "./registry";

function render(_ctx: SectionContext, config: Record<string, unknown>): ExtensionOutput {
  const src = (config.src as string) || "";
  const poster = (config.poster as string) || "";
  const overlay = (config.overlay as string) || "rgba(0,0,0,0.4)";
  const position = (config.position as string) || "hero";
  const height = (config.height as string) || (position === "fullpage" ? "100vh" : "80vh");

  return {
    jsx: `
        <div className="video-bg-container" style={{ height: "${height}" }}>
          <video className="video-bg" autoPlay muted loop playsInline${poster ? ` poster="${poster}"` : ""}>
            <source src="${src}" type="video/mp4" />
          </video>
          <div className="video-bg-overlay" style={{ background: "${overlay}" }} />
          <div className="video-bg-content">
            <h1 className="text-4xl md:text-6xl font-bold text-white">{t.hero.lines[0]?.replace("> ", "")}</h1>
            <p className="text-lg text-white/80 mt-4">{t.hero.lines[1]?.replace("> ", "")}</p>
          </div>
        </div>`,
    css: `
.video-bg-container { position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.video-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; }
.video-bg-overlay { position: absolute; inset: 0; z-index: 1; }
.video-bg-content { position: relative; z-index: 2; text-align: center; padding: 2rem; }`,
    imports: [],
  };
}

registerExtension({
  id: "video-bg",
  label: "Video Background",
  type: "background",
  render,
});
