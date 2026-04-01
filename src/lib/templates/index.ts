/**
 * Template registry — imports all templates to trigger registration.
 */

// Profile templates
import "./profile-minimal";
import "./profile-dark";
import "./profile-editorial";

// Portfolio templates
import "./portfolio-showcase";
import "./portfolio-grid";
import "./portfolio-creative";

// Blog templates
import "./blog-writer";
import "./blog-research";
import "./blog-founder";

export { getTemplate, getTemplatesForMode, listTemplateIds, autoSelectTemplate, renderFromContentModel } from "../template-renderer";
