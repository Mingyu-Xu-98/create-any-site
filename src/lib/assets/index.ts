/**
 * Asset system entry point — imports all asset libraries to trigger registration.
 */
import "./textures";
import "./motion";
import "./card-styles";
import "./hero-systems";
import "./mockups";
import "./shapes";

export {
  getAsset,
  getAssetsByCategory,
  getAssetsByMood,
  getAssetManifest,
  resolveVisualDirection,
  type Asset,
  type AssetCategory,
  type AssetOutput,
  type VisualDirection,
} from "./registry";
