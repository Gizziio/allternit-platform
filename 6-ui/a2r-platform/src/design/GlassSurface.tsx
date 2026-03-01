/**
 * GlassSurface Component (Legacy Re-export)
 * 
 * This file is kept for backward compatibility.
 * Please import from './glass' instead.
 * 
 * @deprecated Use imports from './glass' instead
 */

export { 
  GlassSurface,
  GlassSurfaceThin,
  GlassSurfaceBase,
  GlassSurfaceElevated,
  GlassSurfaceThick,
  type GlassSurfaceProps,
  type GlassIntensity,
} from './glass/GlassSurface';

// Default export for compatibility
export { GlassSurface as default } from './glass/GlassSurface';
