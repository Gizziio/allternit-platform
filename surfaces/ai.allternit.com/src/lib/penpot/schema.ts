/**
 * Penpot design data model — ported from:
 *   /frontend/src/app/main/data/workspace/shapes.cljs
 *   /common/src/main/cljc/app/common/
 *
 * Covers all canonical shape types. All fields nullable/optional
 * per Penpot's data guide (attributes must survive import/export round-trips).
 */

// ─── IDs ─────────────────────────────────────────────────────────────────────

export type PenpotUUID = string;
export type PenpotFileId = PenpotUUID;
export type PenpotPageId = PenpotUUID;
export type PenpotShapeId = PenpotUUID;
export type PenpotComponentId = PenpotUUID;
export type PenpotColorId = PenpotUUID;
export type PenpotTypographyId = PenpotUUID;

// ─── Geometry ────────────────────────────────────────────────────────────────

export interface PenpotPoint {
  x: number;
  y: number;
}

export interface PenpotSize {
  width: number;
  height: number;
}

export interface PenpotBounds extends PenpotPoint, PenpotSize {}

// ─── Transform ───────────────────────────────────────────────────────────────

export interface PenpotMatrix {
  a: number; b: number;
  c: number; d: number;
  e: number; f: number;
}

// ─── Fill ────────────────────────────────────────────────────────────────────

export type PenpotFillType = 'plain' | 'linear' | 'radial' | 'image' | 'pattern';

export interface PenpotGradientStop {
  color: string;
  opacity: number;
  offset: number;
}

export interface PenpotFill {
  fillType?: PenpotFillType;
  fillColor?: string | null;
  fillOpacity?: number | null;
  fillColorGradient?: {
    type: 'linear' | 'radial';
    startX: number; startY: number;
    endX: number; endY: number;
    width: number;
    stops: PenpotGradientStop[];
  } | null;
  fillImageRef?: { id: PenpotUUID; name: string } | null;
}

// ─── Stroke ──────────────────────────────────────────────────────────────────

export type PenpotStrokeType = 'none' | 'inner' | 'outer' | 'center';
export type PenpotStrokeStyle = 'solid' | 'dashed' | 'dotted' | 'mixed';
export type PenpotStrokeAlignment = 'center' | 'inner' | 'outer';

export interface PenpotStroke {
  strokeColor?: string | null;
  strokeOpacity?: number | null;
  strokeStyle?: PenpotStrokeStyle;
  strokeWidth?: number;
  strokeAlignment?: PenpotStrokeAlignment;
  strokeCapStart?: 'none' | 'round' | 'square' | 'line-arrow' | 'triangle-arrow';
  strokeCapEnd?: 'none' | 'round' | 'square' | 'line-arrow' | 'triangle-arrow';
}

// ─── Shadow ──────────────────────────────────────────────────────────────────

export type PenpotShadowType = 'drop-shadow' | 'inner-shadow';

export interface PenpotShadow {
  id?: PenpotUUID;
  style?: PenpotShadowType;
  offsetX?: number;
  offsetY?: number;
  blur?: number;
  spread?: number;
  hidden?: boolean;
  color?: { color: string; opacity: number };
}

// ─── Blur ────────────────────────────────────────────────────────────────────

export interface PenpotBlur {
  id?: PenpotUUID;
  type?: 'layer-blur';
  value?: number;
  hidden?: boolean;
}

// ─── Export config ───────────────────────────────────────────────────────────

export type PenpotExportType = 'png' | 'jpg' | 'svg' | 'pdf';
export type PenpotExportSuffix = '' | '@1x' | '@2x' | '@3x';

export interface PenpotExport {
  type: PenpotExportType;
  suffix?: PenpotExportSuffix;
  scale?: number;
}

// ─── Constraints ─────────────────────────────────────────────────────────────

export type PenpotConstraintH = 'left' | 'right' | 'leftright' | 'center' | 'scale';
export type PenpotConstraintV = 'top' | 'bottom' | 'topbottom' | 'center' | 'scale';

// ─── Layout (flex/grid) ───────────────────────────────────────────────────────

export type PenpotLayoutType = 'flex' | 'grid' | null;
export type PenpotFlexDirection = 'row' | 'row-reverse' | 'column' | 'column-reverse';
export type PenpotAlignItems = 'start' | 'end' | 'center' | 'stretch';
export type PenpotJustifyContent = 'start' | 'end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
export type PenpotWrap = 'wrap' | 'nowrap';

export interface PenpotLayout {
  layoutType?: PenpotLayoutType;
  layoutFlexDir?: PenpotFlexDirection;
  layoutAlignItems?: PenpotAlignItems;
  layoutJustifyContent?: PenpotJustifyContent;
  layoutWrap?: PenpotWrap;
  layoutGap?: { rowGap: number; columnGap: number };
  layoutPadding?: { top: number; right: number; bottom: number; left: number };
}

// ─── Text content ─────────────────────────────────────────────────────────────

export interface PenpotTextStyle {
  fontFamily?: string;
  fontId?: string;
  fontSize?: string;
  fontStyle?: 'normal' | 'italic';
  fontWeight?: string;
  letterSpacing?: string;
  lineHeight?: string;
  textDecoration?: 'none' | 'underline' | 'line-through';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  fills?: PenpotFill[];
}

export interface PenpotTextNode {
  text: string;
  styles?: PenpotTextStyle;
}

export interface PenpotTextParagraph {
  type: 'paragraph';
  children: PenpotTextNode[];
  align?: 'left' | 'right' | 'center' | 'justify';
}

export interface PenpotTextRoot {
  type: 'root';
  children: PenpotTextParagraph[];
}

// ─── Component ref ───────────────────────────────────────────────────────────

export interface PenpotComponentRef {
  componentId: PenpotComponentId;
  componentFile: PenpotFileId;
  componentRoot?: boolean;
  /** Keys of props that have been overridden in this instance */
  componentTouched?: Record<string, boolean>;
}

// ─── Base shape ───────────────────────────────────────────────────────────────

export interface PenpotShapeBase {
  id: PenpotShapeId;
  name: string;
  type: PenpotShapeType;

  // Geometry
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  transform?: PenpotMatrix;
  transformInverse?: PenpotMatrix;

  // Appearance
  opacity?: number;
  hidden?: boolean;
  blocked?: boolean;

  // Style
  fills?: PenpotFill[];
  strokes?: PenpotStroke[];
  shadows?: PenpotShadow[];
  blur?: PenpotBlur;

  // Constraints (relative to parent frame)
  constraintH?: PenpotConstraintH;
  constraintV?: PenpotConstraintV;

  // Export
  exports?: PenpotExport[];

  // Tree
  parentId?: PenpotShapeId;
  frameId?: PenpotShapeId;

  // Component instance (present if this is an instance)
  componentRef?: PenpotComponentRef;
}

// ─── Shape types ──────────────────────────────────────────────────────────────

export type PenpotShapeType =
  | 'frame'
  | 'rect'
  | 'ellipse'
  | 'path'
  | 'text'
  | 'group'
  | 'image'
  | 'bool';

export interface PenpotFrame extends PenpotShapeBase {
  type: 'frame';
  children?: PenpotShapeId[];
  // Frame-specific
  clipContent?: boolean;
  showContent?: boolean;
  hideFillOnExport?: boolean;
  rx?: number;
  ry?: number;
  // Layout
  layout?: PenpotLayout;
  // Grid/clip
  gridX?: number;
  gridY?: number;
  gridColor?: string;
}

export interface PenpotRect extends PenpotShapeBase {
  type: 'rect';
  rx?: number;
  ry?: number;
}

export interface PenpotEllipse extends PenpotShapeBase {
  type: 'ellipse';
}

export interface PenpotPath extends PenpotShapeBase {
  type: 'path';
  content?: PenpotPathSegment[];
}

export type PenpotPathCommandType =
  | 'M' | 'L' | 'C' | 'Q' | 'A' | 'Z'
  | 'move-to' | 'line-to' | 'curve-to' | 'close-path';

export interface PenpotPathSegment {
  command: PenpotPathCommandType;
  params?: {
    x?: number; y?: number;
    c1x?: number; c1y?: number;
    c2x?: number; c2y?: number;
  };
}

export interface PenpotText extends PenpotShapeBase {
  type: 'text';
  content?: PenpotTextRoot;
  grow?: 'fixed' | 'auto-width' | 'auto-height';
}

export interface PenpotGroup extends PenpotShapeBase {
  type: 'group';
  children?: PenpotShapeId[];
  masked?: boolean;
  maskId?: PenpotShapeId;
}

export interface PenpotImage extends PenpotShapeBase {
  type: 'image';
  metadata?: {
    id: PenpotUUID;
    width: number;
    height: number;
    mtype?: string;
  };
}

export interface PenpotBool extends PenpotShapeBase {
  type: 'bool';
  children?: PenpotShapeId[];
  boolType?: 'union' | 'difference' | 'intersection' | 'exclusion';
}

export type PenpotShape =
  | PenpotFrame
  | PenpotRect
  | PenpotEllipse
  | PenpotPath
  | PenpotText
  | PenpotGroup
  | PenpotImage
  | PenpotBool;

// ─── Library assets ───────────────────────────────────────────────────────────

export interface PenpotColor {
  id: PenpotColorId;
  name: string;
  color?: string;
  opacity?: number;
  gradient?: PenpotFill['fillColorGradient'];
  groupName?: string;
}

export interface PenpotTypography {
  id: PenpotTypographyId;
  name: string;
  fontFamily: string;
  fontId?: string;
  fontStyle?: string;
  fontWeight?: string;
  fontSize?: string;
  lineHeight?: string;
  letterSpacing?: string;
  textTransform?: string;
}

export interface PenpotComponent {
  id: PenpotComponentId;
  name: string;
  path?: string;
  mainInstanceId?: PenpotShapeId;
  mainInstancePageId?: PenpotPageId;
  annotation?: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export interface PenpotPage {
  id: PenpotPageId;
  name: string;
  objects: Record<PenpotShapeId, PenpotShape>;
  options?: {
    background?: string;
    savedGrids?: unknown[];
    flows?: unknown[];
    guides?: unknown[];
  };
}

// ─── File ─────────────────────────────────────────────────────────────────────

export interface PenpotFile {
  id: PenpotFileId;
  name: string;
  revn?: number;
  vern?: number;
  data: {
    pages: PenpotPageId[];
    pagesIndex: Record<PenpotPageId, PenpotPage>;
    components?: Record<PenpotComponentId, PenpotComponent>;
    colors?: Record<PenpotColorId, PenpotColor>;
    typographies?: Record<PenpotTypographyId, PenpotTypography>;
    assets?: {
      colors: Record<PenpotColorId, PenpotColor>;
      typographies: Record<PenpotTypographyId, PenpotTypography>;
      components: Record<PenpotComponentId, PenpotComponent>;
    };
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isFrame(shape: PenpotShape): shape is PenpotFrame {
  return shape.type === 'frame';
}

export function isGroup(shape: PenpotShape): shape is PenpotGroup {
  return shape.type === 'group';
}

export function hasChildren(shape: PenpotShape): shape is PenpotFrame | PenpotGroup | PenpotBool {
  return shape.type === 'frame' || shape.type === 'group' || shape.type === 'bool';
}

export function isComponentInstance(shape: PenpotShape): boolean {
  return !!shape.componentRef?.componentId;
}

/** Walk a page's shape tree depth-first */
export function walkShapes(
  page: PenpotPage,
  fn: (shape: PenpotShape, depth: number) => void,
  rootId?: PenpotShapeId,
  depth = 0,
): void {
  const root = rootId
    ? page.objects[rootId]
    : Object.values(page.objects).find(s => s.type === 'frame' && !s.parentId);
  if (!root) return;
  fn(root, depth);
  if (hasChildren(root) && root.children) {
    for (const childId of root.children) {
      walkShapes(page, fn, childId, depth + 1);
    }
  }
}
