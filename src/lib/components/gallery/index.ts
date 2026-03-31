// gallery/index.ts — Registration for gallery section variants.
import { registerSection } from "../registry";
import { galleryGrid } from "./grid";
import { galleryMasonry } from "./masonry";
import { galleryLightbox } from "./lightbox";

registerSection("gallery", "grid", galleryGrid);
registerSection("gallery", "masonry", galleryMasonry);
registerSection("gallery", "lightbox", galleryLightbox);
