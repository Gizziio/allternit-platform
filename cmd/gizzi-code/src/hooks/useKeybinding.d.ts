/**
 * @fileoverview Keybinding hook for gizzi-code integration
 * @module hooks/useKeybinding
 *
 * Provides a React hook for registering keyboard shortcuts and key combinations.
 * Supports modifier keys (Ctrl, Alt, Shift, Meta) and automatic cleanup on unmount.
 */
/**
 * Key combination configuration
 * @interface KeybindingConfig
 */
export interface KeybindingConfig {
    /** The main key (e.g., 'c', 'Enter', 'Escape') */
    readonly key: string;
    /** Require Ctrl key to be pressed */
    readonly ctrl?: boolean;
    /** Require Alt/Option key to be pressed */
    readonly alt?: boolean;
    /** Require Shift key to be pressed */
    readonly shift?: boolean;
    /** Require Meta/Command key to be pressed */
    readonly meta?: boolean;
    /** Prevent default browser behavior */
    readonly preventDefault?: boolean;
    /** Stop event propagation */
    readonly stopPropagation?: boolean;
}
/**
 * Parses a keybinding string into a config object
 *
 * @param {string} keybinding - Keybinding string (e.g., "Ctrl+C", "Escape", "Ctrl+Shift+A")
 * @returns {KeybindingConfig} Parsed keybinding configuration
 * @example
 * ```typescript
 * parseKeybinding("Ctrl+C"); // { key: 'c', ctrl: true }
 * parseKeybinding("Escape"); // { key: 'escape' }
 * parseKeybinding("Ctrl+Shift+A"); // { key: 'a', ctrl: true, shift: true }
 * ```
 */
export declare function parseKeybinding(keybinding: string): KeybindingConfig;
/**
 * Key event handler type
 * @typedef {Function} KeyHandler
 */
export type KeyHandler = (event: KeyboardEvent) => void | boolean;
/**
 * React hook for registering keyboard shortcuts
 *
 * Registers a keyboard shortcut that triggers the provided handler when pressed.
 * Automatically cleans up the event listener when the component unmounts or
 * when the keybinding changes.
 *
 * @param {string | KeybindingConfig} key - Key combination (e.g., "Ctrl+C") or config object
 * @param {KeyHandler} handler - Function to call when keybinding is triggered
 * @param {boolean} [enabled=true] - Whether the keybinding is active
 * @example
 * ```typescript
 * // Using string keybinding
 * useKeybinding('Ctrl+C', () => {
 *   console.log('Copy!');
 * });
 *
 * // Using config object
 * useKeybinding({ key: 'k', ctrl: true }, (e) => {
 *   e.preventDefault();
 *   console.log('Ctrl+K pressed');
 * });
 *
 * // With conditional enabling
 * useKeybinding('Escape', handleClose, isModalOpen);
 * ```
 */
export declare function useKeybinding(key: string | KeybindingConfig, handler: KeyHandler, enabled?: boolean): void;
/**
 * Hook for registering multiple keybindings at once
 *
 * @param {Array<[string | KeybindingConfig, KeyHandler]>} bindings - Array of [keybinding, handler] tuples
 * @param {boolean} [enabled=true] - Whether all keybindings are active
 * @example
 * ```typescript
 * useKeybindings([
 *   ['Ctrl+C', handleCopy],
 *   ['Ctrl+V', handlePaste],
 *   ['Escape', handleClose],
 * ]);
 * ```
 */
export declare function useKeybindings(bindings: Array<[string | KeybindingConfig, KeyHandler]>, enabled?: boolean): void;
export default useKeybinding;
