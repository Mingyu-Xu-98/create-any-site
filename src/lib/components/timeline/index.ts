// timeline/index.ts — re-exports and registry registrations
export { timelineVertical } from "./vertical";
export { timelineCompact } from "./compact";
export { timelineParchment } from "./parchment";
export { timelineBlog } from "./blog";
export { timelineReveal } from "./reveal";
export { timelineMinimal } from "./minimal";

import { registerTimeline } from "../registry";
import { timelineVertical } from "./vertical";
import { timelineCompact } from "./compact";
import { timelineParchment } from "./parchment";
import { timelineBlog } from "./blog";
import { timelineReveal } from "./reveal";
import { timelineMinimal } from "./minimal";

registerTimeline("vertical", timelineVertical, { description: "Standard vertical line with dot indicators", bestFor: ["any", "light-clean"], dataShape: "timeline[]{date, title, desc}" });
registerTimeline("compact", timelineCompact, { description: "Dense compressed timeline, minimal spacing", bestFor: ["dark-tech", "compact"], dataShape: "timeline[]" });
registerTimeline("parchment", timelineParchment, { description: "Vintage parchment-style timeline", bestFor: ["warm-organic", "ghibli", "ink-wash"], dataShape: "timeline[]" });
registerTimeline("blog", timelineBlog, { description: "Blog-style date + title + excerpt", bestFor: ["editorial-refined", "blog"], dataShape: "timeline[]" });
registerTimeline("reveal", timelineReveal, { description: "Scroll-triggered reveal animation", bestFor: ["bold-creative", "cinematic"], dataShape: "timeline[]" });
registerTimeline("minimal", timelineMinimal, { description: "Clean dots-only minimal timeline", bestFor: ["light-clean", "minimalist"], dataShape: "timeline[]" });
