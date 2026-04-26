/**
 * @allternit/workflow-engine (DEPRECATED)
 * 
 * This package has been merged into @allternit/governor.
 * Please import from @allternit/governor instead.
 * 
 * @deprecated Use @allternit/governor directly
 */

// Re-export everything from @allternit/governor for backward compatibility
export * from '@allternit/governor';

// Log deprecation warning in development
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.warn(
    '[@allternit/workflow-engine] DEPRECATED: This package has been merged into @allternit/governor. ' +
    'Please update your imports to use @allternit/governor directly.'
  );
}
