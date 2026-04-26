/**
 * @fileoverview Terminal size hook for gizzi-code integration
 * @module hooks/useTerminalSize
 *
 * Provides a React hook to track terminal dimensions with resize event handling.
 * Returns the current terminal width and height, defaulting to standard terminal
 * dimensions when not in a browser environment.
 */
/**
 * Terminal size state interface
 * @interface TerminalSize
 */
export interface TerminalSize {
    /** Current terminal width in columns */
    readonly width: number;
    /** Current terminal height in rows */
    readonly height: number;
}
/**
 * React hook for tracking terminal size
 *
 * Returns the current terminal dimensions and automatically updates
 * when the window is resized. Uses debouncing to prevent excessive
 * re-renders during resize operations.
 *
 * @returns {TerminalSize} Current terminal width and height
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { width, height } = useTerminalSize();
 *
 *   return (
 *     <div>
 *       Terminal: {width}×{height}
 *     </div>
 *   );
 * }
 * ```
 */
export declare function useTerminalSize(): TerminalSize;
export default useTerminalSize;
