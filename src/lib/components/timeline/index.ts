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

registerTimeline("vertical", timelineVertical);
registerTimeline("compact", timelineCompact);
registerTimeline("parchment", timelineParchment);
registerTimeline("blog", timelineBlog);
registerTimeline("reveal", timelineReveal);
registerTimeline("minimal", timelineMinimal);
