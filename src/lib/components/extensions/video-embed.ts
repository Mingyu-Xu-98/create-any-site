/**
 * Video Embed extension.
 * Embeds a video player as a section (YouTube, Vimeo, or self-hosted).
 *
 * Config options:
 * - src: string (video URL)
 * - type: "youtube" | "vimeo" | "self-hosted" (auto-detected from URL)
 * - title: string (section heading)
 * - aspectRatio: string (default "16/9")
 */
import type { SectionContext } from "../types";
import type { ExtensionOutput } from "./types";
import { registerExtension } from "./registry";

function render(_ctx: SectionContext, config: Record<string, unknown>): ExtensionOutput {
  const src = (config.src as string) || "";
  const title = (config.title as string) || "";
  const aspectRatio = (config.aspectRatio as string) || "16/9";

  let embedSrc = src;
  let isIframe = false;

  if (src.includes("youtube.com") || src.includes("youtu.be")) {
    const videoId = src.includes("youtu.be") ? src.split("/").pop() : new URL(src).searchParams.get("v");
    embedSrc = `https://www.youtube.com/embed/${videoId}`;
    isIframe = true;
  } else if (src.includes("vimeo.com")) {
    const videoId = src.split("/").pop();
    embedSrc = `https://player.vimeo.com/video/${videoId}`;
    isIframe = true;
  }

  const player = isIframe
    ? `<iframe src="${embedSrc}" className="video-embed-frame" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />`
    : `<video className="video-embed-frame" controls playsInline><source src="${src}" type="video/mp4" /></video>`;

  return {
    jsx: `
        <section id="video" className="max-w-[1100px] mx-auto px-6 py-16">
          ${title ? `<h2 className="section-heading">${title}</h2>` : ""}
          <div className="video-embed-wrapper" style={{ aspectRatio: "${aspectRatio}" }}>
            ${player}
          </div>
        </section>`,
    css: `
.video-embed-wrapper { position: relative; width: 100%; border-radius: var(--radius, 12px); overflow: hidden; background: var(--color-bg-card); }
.video-embed-frame { position: absolute; inset: 0; width: 100%; height: 100%; border: none; }`,
    imports: [],
  };
}

registerExtension({
  id: "video-embed",
  label: "Video Embed",
  type: "section",
  render,
});
