/**
 * Tambo Input Validation Module
 * 
 * Provides validation functions for all Tambo API inputs.
 */

import {
  UISpec,
  ComponentSpec,
  LayoutSpec,
  StyleSpec,
  GeneratedUI,
  SpecDiff,
  A11yResult,
  TamboError,
  UIType,
} from '../types/tambo.js';

// =============================================================================
// Validation Result Type
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function success(): ValidationResult {
  return { valid: true, errors: [] };
}

export function failure(errors: string[]): ValidationResult {
  return { valid: false, errors };
}

// =============================================================================
// UISpec Validation
// =============================================================================

export function validateUISpec(spec: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (!spec || typeof spec !== 'object') {
    return failure(['Spec must be an object']);
  }
  
  const s = spec as Record<string, unknown>;
  
  // Required string fields
  if (!s.spec_id || typeof s.spec_id !== 'string' || s.spec_id.trim() === '') {
    errors.push('spec_id is required and must be a non-empty string');
  }
  
  if (!s.title || typeof s.title !== 'string' || s.title.trim() === '') {
    errors.push('title is required and must be a non-empty string');
  }
  
  if (typeof s.description !== 'string') {
    errors.push('description must be a string');
  }
  
  // Components validation
  if (!Array.isArray(s.components)) {
    errors.push('components must be an array');
  } else if (s.components.length === 0) {
    errors.push('At least one component is required');
  } else {
    s.components.forEach((comp, idx) => {
      const compResult = validateComponentSpec(comp);
      if (!compResult.valid) {
        errors.push(`Component[${idx}]: ${compResult.errors.join(', ')}`);
      }
    });
  }
  
  // Layout validation
  if (!s.layout || typeof s.layout !== 'object') {
    errors.push('layout is required');
  } else {
    const layoutResult = validateLayoutSpec(s.layout);
    if (!layoutResult.valid) {
      errors.push(`Layout: ${layoutResult.errors.join(', ')}`);
    }
  }
  
  // Style validation
  if (!s.style || typeof s.style !== 'object') {
    errors.push('style is required');
  } else {
    const styleResult = validateStyleSpec(s.style);
    if (!styleResult.valid) {
      errors.push(`Style: ${styleResult.errors.join(', ')}`);
    }
  }
  
  // Interactions validation
  if (!Array.isArray(s.interactions)) {
    errors.push('interactions must be an array');
  }
  
  // created_at validation
  if (!s.created_at || typeof s.created_at !== 'string') {
    errors.push('created_at is required');
  } else {
    const date = new Date(s.created_at);
    if (isNaN(date.getTime())) {
      errors.push('created_at must be a valid ISO 8601 date string');
    }
  }
  
  return errors.length === 0 ? success() : failure(errors);
}

export function validateComponentSpec(comp: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (!comp || typeof comp !== 'object') {
    return failure(['Component must be an object']);
  }
  
  const c = comp as Record<string, unknown>;
  
  if (!c.component_id || typeof c.component_id !== 'string' || c.component_id.trim() === '') {
    errors.push('component_id is required');
  }
  
  if (!c.component_type || typeof c.component_type !== 'string' || c.component_type.trim() === '') {
    errors.push('component_type is required');
  }
  
  if (!c.properties || typeof c.properties !== 'object') {
    errors.push('properties must be an object');
  }
  
  if (!Array.isArray(c.children)) {
    errors.push('children must be an array');
  }
  
  if (!Array.isArray(c.bindings)) {
    errors.push('bindings must be an array');
  }
  
  return errors.length === 0 ? success() : failure(errors);
}

export function validateLayoutSpec(layout: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (!layout || typeof layout !== 'object') {
    return failure(['Layout must be an object']);
  }
  
  const l = layout as Record<string, unknown>;
  
  if (!l.layout_type || typeof l.layout_type !== 'string') {
    errors.push('layout_type is required');
  }
  
  if (!l.constraints || typeof l.constraints !== 'object') {
    errors.push('constraints is required');
  }
  
  if (!Array.isArray(l.regions)) {
    errors.push('regions must be an array');
  }
  
  return errors.length === 0 ? success() : failure(errors);
}

export function validateStyleSpec(style: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (!style || typeof style !== 'object') {
    return failure(['Style must be an object']);
  }
  
  const s = style as Record<string, unknown>;
  
  if (!s.theme || typeof s.theme !== 'string') {
    errors.push('theme is required');
  }
  
  if (!s.colors || typeof s.colors !== 'object') {
    errors.push('colors is required');
  }
  
  if (!s.typography || typeof s.typography !== 'object') {
    errors.push('typography is required');
  }
  
  if (!s.spacing || typeof s.spacing !== 'object') {
    errors.push('spacing is required');
  } else {
    const spacing = s.spacing as Record<string, unknown>;
    if (!Array.isArray(spacing.scale)) {
      errors.push('spacing.scale must be an array');
    }
    if (!spacing.unit || typeof spacing.unit !== 'string') {
      errors.push('spacing.unit is required');
    }
  }
  
  return errors.length === 0 ? success() : failure(errors);
}

// =============================================================================
// UIType Validation
// =============================================================================

const VALID_UI_TYPES: UIType[] = ['react', 'vue', 'svelte', 'angular', 'web_components', 'plain_html'];

export function validateUIType(uiType: unknown): ValidationResult {
  if (typeof uiType !== 'string') {
    return failure(['ui_type must be a string']);
  }
  
  if (!VALID_UI_TYPES.includes(uiType as UIType)) {
    return failure([`ui_type must be one of: ${VALID_UI_TYPES.join(', ')}`]);
  }
  
  return success();
}

// =============================================================================
// Hash Content Validation
// =============================================================================

export function validateHashContent(content: unknown): ValidationResult {
  if (typeof content !== 'string') {
    return failure(['content must be a string']);
  }
  
  // Allow empty strings but warn about them
  if (content.length > 1000000) {
    return failure(['content exceeds maximum length of 1MB']);
  }
  
  return success();
}

export function validateVerifyHashRequest(content: unknown, hash: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (typeof content !== 'string') {
    errors.push('content must be a string');
  }
  
  if (typeof hash !== 'string' || hash.trim() === '') {
    errors.push('hash is required and must be a non-empty string');
  }
  
  return errors.length === 0 ? success() : failure(errors);
}

// =============================================================================
// Diff Specs Validation
// =============================================================================

export function validateDiffSpecs(oldSpec: unknown, newSpec: unknown): ValidationResult {
  const oldResult = validateUISpec(oldSpec);
  const newResult = validateUISpec(newSpec);
  
  const errors: string[] = [];
  
  if (!oldResult.valid) {
    errors.push(`old_spec: ${oldResult.errors.join(', ')}`);
  }
  
  if (!newResult.valid) {
    errors.push(`new_spec: ${newResult.errors.join(', ')}`);
  }
  
  return errors.length === 0 ? success() : failure(errors);
}

// =============================================================================
// A11y Validation
// =============================================================================

export function validateA11ySpec(spec: unknown): ValidationResult {
  return validateUISpec(spec);
}

export function validateA11yUI(ui: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (!ui || typeof ui !== 'object') {
    return failure(['UI must be an object']);
  }
  
  const u = ui as Record<string, unknown>;
  
  if (!u.generation_id || typeof u.generation_id !== 'string') {
    errors.push('generation_id is required');
  }
  
  if (!u.spec_id || typeof u.spec_id !== 'string') {
    errors.push('spec_id is required');
  }
  
  if (typeof u.ui_code !== 'string') {
    errors.push('ui_code is required');
  }
  
  if (!u.ui_type || typeof u.ui_type !== 'string') {
    errors.push('ui_type is required');
  }
  
  return errors.length === 0 ? success() : failure(errors);
}

// =============================================================================
// Seed Validation
// =============================================================================

export function validateSeed(seed: unknown): ValidationResult {
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    return failure(['seed must be a valid number']);
  }
  
  if (seed < 0) {
    return failure(['seed must be non-negative']);
  }
  
  if (seed > Number.MAX_SAFE_INTEGER) {
    return failure(['seed exceeds maximum safe integer']);
  }
  
  return success();
}

// =============================================================================
// Error Helpers
// =============================================================================

export function createErrorResponse(message: string, code?: string, details?: Record<string, unknown>): TamboError {
  return {
    error: message,
    code,
    details,
  };
}

export function createValidationError(result: ValidationResult): TamboError {
  return createErrorResponse(
    `Validation failed: ${result.errors.join('; ')}`,
    'VALIDATION_ERROR',
    { errors: result.errors }
  );
}
