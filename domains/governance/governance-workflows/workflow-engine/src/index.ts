/**
 * @a2r/workflow-engine (DEPRECATED)
 * 
 * This package has been merged into @a2r/governor.
 * Please import from @a2r/governor instead.
 * 
 * @deprecated Use @a2r/governor directly
 */

// Re-export everything from @a2r/governor for backward compatibility
export * from '@a2r/governor';

// Log deprecation warning in development
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.warn(
    '[@a2r/workflow-engine] DEPRECATED: This package has been merged into @a2r/governor. ' +
    'Please update your imports to use @a2r/governor directly.'
  );
}
