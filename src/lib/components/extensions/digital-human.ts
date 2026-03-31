/**
 * Digital Human extension.
 * Embeds a third-party digital human/avatar API as a floating widget or section.
 *
 * Config options:
 * - provider: "heygen" | "d-id" | "custom"
 * - avatarId: string
 * - apiKey: string (will be placed in .env.local)
 * - position: "floating" | "section" (default "floating")
 * - size: "small" | "medium" | "large" (default "medium")
 */
import type { SectionContext } from "../types";
import type { ExtensionOutput } from "./types";
import { registerExtension } from "./registry";

function render(_ctx: SectionContext, config: Record<string, unknown>): ExtensionOutput {
  const provider = (config.provider as string) || "custom";
  const avatarId = (config.avatarId as string) || "";
  const position = (config.position as string) || "floating";
  const size = (config.size as string) || "medium";

  const sizeMap = { small: "240px", medium: "360px", large: "480px" };
  const width = sizeMap[size as keyof typeof sizeMap] || sizeMap.medium;

  if (position === "floating") {
    return {
      jsx: `
        <div className="digital-human-widget">
          <iframe src="${getEmbedUrl(provider, avatarId)}" className="digital-human-frame" allow="camera; microphone" />
        </div>`,
      css: `
.digital-human-widget { position: fixed; bottom: 80px; right: 24px; z-index: 100; width: ${width}; aspect-ratio: 9/16; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
.digital-human-frame { width: 100%; height: 100%; border: none; }
@media (max-width: 768px) { .digital-human-widget { width: 200px; bottom: 70px; right: 12px; } }`,
      imports: [],
    };
  }

  // Section placement
  return {
    jsx: `
        <section id="avatar" className="max-w-[1100px] mx-auto px-6 py-16">
          <div className="digital-human-section">
            <iframe src="${getEmbedUrl(provider, avatarId)}" className="digital-human-frame" allow="camera; microphone" />
          </div>
        </section>`,
    css: `
.digital-human-section { width: 100%; max-width: ${width}; margin: 0 auto; aspect-ratio: 9/16; border-radius: 16px; overflow: hidden; background: var(--color-bg-card); }
.digital-human-frame { width: 100%; height: 100%; border: none; }`,
    imports: [],
  };
}

function getEmbedUrl(provider: string, avatarId: string): string {
  switch (provider) {
    case "heygen":
      return `https://app.heygen.com/embed/${avatarId}`;
    case "d-id":
      return `https://studio.d-id.com/agents/${avatarId}?key=\${process.env.NEXT_PUBLIC_DID_KEY}`;
    default:
      return avatarId; // Custom: treat avatarId as the full embed URL
  }
}

registerExtension({
  id: "digital-human",
  label: "Digital Human",
  type: "widget",
  render,
});
