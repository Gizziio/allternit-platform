import type { TLShape } from 'tldraw';
import type {
  PenpotBlur,
  PenpotComponentId,
  PenpotConstraintH,
  PenpotConstraintV,
  PenpotExport,
  PenpotFileId,
  PenpotFill,
  PenpotLayout,
  PenpotShadow,
  PenpotStroke,
} from '@/lib/penpot/schema';

export const DESIGN_FRAME_TYPE = 'design-frame';
export const DESIGN_COMPONENT_TYPE = 'design-component';
export const DESIGN_UIBLOCK_TYPE = 'design-uiblock';
export const CODE_TILE_TYPE = 'code-tile';

export interface DesignFrameShapeProps {
  w: number;
  h: number;
  label: string;
  fill: string;
  fills: PenpotFill[];
  strokes: PenpotStroke[];
  shadows: PenpotShadow[];
  blur: PenpotBlur | null;
  opacity: number;
  rx: number;
  ry: number;
  clipContent: boolean;
  constraintH: PenpotConstraintH;
  constraintV: PenpotConstraintV;
  layout: PenpotLayout | null;
  exports: PenpotExport[];
}

export interface DesignComponentShapeProps {
  w: number;
  h: number;
  label: string;
  componentType: 'custom' | 'button' | 'input' | 'card' | 'nav' | 'modal' | 'badge';
  fill: string;
  stroke: string;
  radius: number;
  fills: PenpotFill[];
  strokes: PenpotStroke[];
  opacity: number;
  componentId: PenpotComponentId | null;
  componentFile: PenpotFileId | null;
}

export interface DesignUIBlockShapeProps {
  w: number;
  h: number;
  variant: 'button-primary' | 'button-secondary' | 'input' | 'card' | 'nav-bar' | 'badge' | 'avatar' | 'divider';
}

export interface CodeTileShapeProps {
  w: number;
  h: number;
  tileId: string;
  label: string;
}

declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    [DESIGN_FRAME_TYPE]: DesignFrameShapeProps;
    [DESIGN_COMPONENT_TYPE]: DesignComponentShapeProps;
    [DESIGN_UIBLOCK_TYPE]: DesignUIBlockShapeProps;
    [CODE_TILE_TYPE]: CodeTileShapeProps;
  }
}

export type DesignFrameShape = TLShape<typeof DESIGN_FRAME_TYPE>;
export type DesignComponentShape = TLShape<typeof DESIGN_COMPONENT_TYPE>;
export type DesignUIBlockShape = TLShape<typeof DESIGN_UIBLOCK_TYPE>;
export type CodeTileShape = TLShape<typeof CODE_TILE_TYPE>;
export type AllternitCanvasShape =
  | DesignFrameShape
  | DesignComponentShape
  | DesignUIBlockShape
  | CodeTileShape;
