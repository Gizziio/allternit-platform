/**
 * Tambo TypeScript Type Definitions
 * 
 * Comprehensive type definitions for the Tambo UI generation system.
 * Mirrors the Rust NAPI types for type-safe API interactions.
 */

// =============================================================================
// Core UI Specification Types
// =============================================================================

export interface UISpec {
  spec_id: string;
  title: string;
  description: string;
  components: ComponentSpec[];
  layout: LayoutSpec;
  style: StyleSpec;
  interactions: InteractionSpec[];
  created_at: string;
}

export interface ComponentSpec {
  component_id: string;
  component_type: string;
  properties: Record<string, unknown>;
  children: string[];
  bindings: DataBinding[];
}

export interface DataBinding {
  property: string;
  source: string;
  transform?: string;
}

export interface LayoutSpec {
  layout_type: string;
  constraints: LayoutConstraints;
  regions: LayoutRegionSpec[];
}

export interface LayoutConstraints {
  min_width?: number;
  max_width?: number;
  min_height?: number;
  max_height?: number;
}

export interface LayoutRegionSpec {
  region_id: string;
  region_type: string;
  position: RegionPosition;
  size: RegionSize;
}

export interface RegionPosition {
  x: number;
  y: number;
}

export interface RegionSize {
  width: number;
  height: number;
}

export interface StyleSpec {
  theme: string;
  colors: Record<string, string>;
  typography: TypographySpec;
  spacing: SpacingSpec;
}

export interface TypographySpec {
  font_family: string;
  font_sizes: Record<string, number>;
  line_heights: Record<string, number>;
}

export interface SpacingSpec {
  scale: number[];
  unit: string;
}

export interface InteractionSpec {
  interaction_id: string;
  trigger: string;
  action: string;
}

// =============================================================================
// Generated UI Types
// =============================================================================

export interface GeneratedUI {
  generation_id: string;
  spec_id: string;
  ui_code: string;
  ui_type: UIType;
  components_generated: number;
  confidence: number;
  generation_hash?: string;
}

export type UIType = 'react' | 'vue' | 'svelte' | 'angular' | 'web_components' | 'plain_html';

// =============================================================================
// Spec Diff Engine Types
// =============================================================================

export interface SpecDiff {
  has_changes: boolean;
  component_changes: ComponentChange[];
  layout_changes: LayoutChange[];
  style_changes: StyleChange[];
  breaking_changes: BreakingChange[];
}

export interface ComponentChange {
  change_type: ChangeType;
  component_id: string;
  description: string;
}

export type ChangeType = 'Added' | 'Removed' | 'Modified';

export interface LayoutChange {
  field: string;
  old_value: string;
  new_value: string;
}

export interface StyleChange {
  category: string;
  property: string;
  old_value: string;
  new_value: string;
}

export interface BreakingChange {
  severity: Severity;
  description: string;
  migration_guide: string;
}

export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';

// =============================================================================
// Accessibility (A11y) Engine Types
// =============================================================================

export interface A11yResult {
  passed: boolean;
  score: number;
  violations: A11yViolation[];
  warnings: A11yWarning[];
}

export interface A11yViolation {
  rule: string;
  severity: A11ySeverity;
  description: string;
  element: string;
  remediation: string;
  wcag_reference: string;
}

export interface A11yWarning {
  rule: string;
  description: string;
  element: string;
  suggestion: string;
}

export type A11ySeverity = 'Critical' | 'Serious' | 'Moderate' | 'Minor';

// =============================================================================
// Hash Engine Types
// =============================================================================

export interface HashResult {
  hash: string;
}

export interface HashVerificationResult {
  valid: boolean;
}

// =============================================================================
// Generation State Types
// =============================================================================

export interface GenerationState {
  generation_id: string;
  spec_id: string;
  state: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface GenerateUIRequest {
  spec: UISpec;
  ui_type: UIType;
  mode?: 'standard' | 'validated' | 'reproducible' | 'streaming';
  seed?: number;
}

export interface GenerateUIResponse extends GeneratedUI {}

export interface DiffSpecsRequest {
  old_spec: UISpec;
  new_spec: UISpec;
}

export interface DiffSpecsResponse extends SpecDiff {}

export interface BreakingChangesRequest {
  diff: SpecDiff;
}

export interface BreakingChangesResponse {
  has_breaking_changes: boolean;
}

export interface SummaryRequest {
  diff: SpecDiff;
}

export interface SummaryResponse {
  summary: string;
}

export interface HashContentRequest {
  content: string;
}

export interface HashContentResponse extends HashResult {}

export interface VerifyHashRequest {
  content: string;
  hash: string;
}

export interface VerifyHashResponse extends HashVerificationResult {}

export interface ValidateA11yRequest {
  spec: UISpec;
}

export interface ValidateA11yResponse extends A11yResult {}

export interface ValidateUiA11yRequest {
  ui: GeneratedUI;
}

export interface ValidateUiA11yResponse extends A11yResult {}

export interface A11yReportRequest {
  result: A11yResult;
}

export interface A11yReportResponse {
  report: string;
}

export interface SaveGenerationStateRequest {
  state: Record<string, unknown>;
}

export interface SaveGenerationStateResponse {
  success: boolean;
}

// =============================================================================
// Error Types
// =============================================================================

export interface TamboError {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// Utility Types
// =============================================================================

export type Result<T, E = TamboError> = 
  | { success: true; data: T }
  | { success: false; error: E };

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}
