/**
 * @fileoverview Fullscreen utilities for gizzi-code integration
 * @module utils/fullscreen
 *
 * Provides utilities for managing fullscreen mode in browser environments.
 * Includes support for the standard Fullscreen API with vendor prefixes
 * for cross-browser compatibility.
 */
/**
 * Fullscreen change event handler type
 * @typedef {Function} FullscreenChangeHandler
 */
export type FullscreenChangeHandler = (isFullscreen: boolean) => void;
/**
 * Checks if the Fullscreen API is supported in the current environment
 *
 * @returns {boolean} True if fullscreen is supported
 * @example
 * ```typescript
 * if (isFullscreenSupported()) {
 *   enterFullscreen();
 * }
 * ```
 */
export declare function isFullscreenSupported(): boolean;
/**
 * Checks if the document is currently in fullscreen mode
 *
 * @returns {boolean} True if currently in fullscreen
 * @example
 * ```typescript
 * if (isFullscreen()) {
 *   console.log('Currently in fullscreen mode');
 * }
 * ```
 */
export declare function isFullscreen(): boolean;
/**
 * Enters fullscreen mode for the specified element or document
 *
 * @param {HTMLElement} [element] - Element to make fullscreen (defaults to document.documentElement)
 * @param {FullscreenOptions} [options] - Fullscreen options
 * @returns {Promise<void>} Promise that resolves when fullscreen is entered
 * @throws {Error} If fullscreen is not supported or permission is denied
 * @example
 * ```typescript
 * // Make entire page fullscreen
 * await enterFullscreen();
 *
 * // Make specific element fullscreen
 * const video = document.getElementById('myVideo');
 * await enterFullscreen(video);
 *
 * // With navigation UI hidden
 * await enterFullscreen(undefined, { navigationUI: 'hide' });
 * ```
 */
export declare function enterFullscreen(element?: HTMLElement, options?: FullscreenOptions): Promise<void>;
/**
 * Exits fullscreen mode
 *
 * @returns {Promise<void>} Promise that resolves when fullscreen is exited
 * @throws {Error} If not in fullscreen or API not supported
 * @example
 * ```typescript
 * await exitFullscreen();
 * console.log('Exited fullscreen');
 * ```
 */
export declare function exitFullscreen(): Promise<void>;
/**
 * Toggles fullscreen mode for the specified element
 *
 * @param {HTMLElement} [element] - Element to toggle (defaults to document.documentElement)
 * @param {FullscreenOptions} [options] - Fullscreen options
 * @returns {Promise<boolean>} Promise that resolves to new fullscreen state
 * @example
 * ```typescript
 * const isFullscreen = await toggleFullscreen();
 * console.log('Fullscreen active:', isFullscreen);
 * ```
 */
export declare function toggleFullscreen(element?: HTMLElement, options?: FullscreenOptions): Promise<boolean>;
/**
 * Subscribes to fullscreen change events
 *
 * @param {FullscreenChangeHandler} handler - Callback fired when fullscreen state changes
 * @returns {() => void} Unsubscribe function
 * @example
 * ```typescript
 * const unsubscribe = onFullscreenChange((isFullscreen) => {
 *   console.log('Fullscreen changed:', isFullscreen);
 * });
 *
 * // Later: unsubscribe();
 * ```
 */
export declare function onFullscreenChange(handler: FullscreenChangeHandler): () => void;
/**
 * Gets the current fullscreen element
 *
 * @returns {Element | null} The element currently in fullscreen, or null
 * @example
 * ```typescript
 * const element = getFullscreenElement();
 * if (element) {
 *   console.log('Fullscreen element:', element.tagName);
 * }
 * ```
 */
export declare function getFullscreenElement(): Element | null;
/**
 * Locks screen orientation when in fullscreen (mobile devices)
 *
 * @param {OrientationLockType} orientation - Orientation to lock to
 * @returns {Promise<void>} Promise that resolves when orientation is locked
 * @example
 * ```typescript
 * await lockOrientation('landscape');
 * await enterFullscreen();
 * ```
 */
/**
 * Valid orientation lock types
 * @typedef {string} OrientationLockType
 */
type OrientationLockType = 'any' | 'natural' | 'landscape' | 'portrait' | 'portrait-primary' | 'portrait-secondary' | 'landscape-primary' | 'landscape-secondary';
/**
 * Locks screen orientation when in fullscreen (mobile devices)
 *
 * @param {OrientationLockType} orientation - Orientation to lock to
 * @returns {Promise<void>} Promise that resolves when orientation is locked
 * @example
 * ```typescript
 * await lockOrientation('landscape');
 * await enterFullscreen();
 * ```
 */
export declare function lockOrientation(orientation: OrientationLockType): Promise<void>;
/**
 * Unlocks screen orientation
 *
 * @returns {Promise<void>} Promise that resolves when orientation is unlocked
 * @example
 * ```typescript
 * await unlockOrientation();
 * ```
 */
export declare function unlockOrientation(): Promise<void>;
declare const _default: {
    isFullscreenSupported: typeof isFullscreenSupported;
    isFullscreen: typeof isFullscreen;
    enterFullscreen: typeof enterFullscreen;
    exitFullscreen: typeof exitFullscreen;
    toggleFullscreen: typeof toggleFullscreen;
    onFullscreenChange: typeof onFullscreenChange;
    getFullscreenElement: typeof getFullscreenElement;
    lockOrientation: typeof lockOrientation;
    unlockOrientation: typeof unlockOrientation;
};
export default _default;
