/**
 * SVG Animation extension.
 * Supports inline SVG with CSS keyframes or Lottie player.
 *
 * Config options:
 * - type: "inline" | "lottie"
 * - src: string (Lottie JSON path or inline SVG content)
 * - loop: boolean (default true)
 * - autoplay: boolean (default true)
 * - width: string (default "100%")
 * - height: string (default "400px")
 */
import type { SectionContext } from "../types";
import type { ExtensionOutput } from "./types";
import { registerExtension } from "./registry";

function render(_ctx: SectionContext, config: Record<string, unknown>): ExtensionOutput {
  const type = (config.type as string) || "lottie";
  const src = (config.src as string) || "";
  const loop = config.loop !== false;
  const autoplay = config.autoplay !== false;
  const width = (config.width as string) || "100%";
  const height = (config.height as string) || "400px";

  if (type === "lottie") {
    return {
      jsx: `
        <section className="max-w-[1100px] mx-auto px-6 py-12">
          <div style={{ width: "${width}", height: "${height}" }}>
            <LottiePlayer src="${src}" loop={${loop}} autoplay={${autoplay}} style={{ width: "100%", height: "100%" }} />
          </div>
        </section>`,
      css: "",
      imports: [`import dynamic from "next/dynamic";`, `const LottiePlayer = dynamic(() => import("@lottiefiles/react-lottie-player").then(m => m.Player), { ssr: false });`],
      dependencies: { "@lottiefiles/react-lottie-player": "^3.5.4" },
    };
  }

  // Inline SVG
  return {
    jsx: `
        <section className="max-w-[1100px] mx-auto px-6 py-12">
          <div className="svg-animation-container" style={{ width: "${width}", height: "${height}" }}
               dangerouslySetInnerHTML={{ __html: \`${src}\` }} />
        </section>`,
    css: `.svg-animation-container svg { width: 100%; height: 100%; }`,
    imports: [],
  };
}

registerExtension({
  id: "svg-animation",
  label: "SVG Animation",
  type: "section",
  render,
});
