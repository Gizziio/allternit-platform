/**
 * Chrome Embed Module - JavaScript Wrapper
 *
 * Provides API for embedding Chrome browser windows in Electron.
 * Uses native module for window management.
 */

// Load native module
let nativeModule = null;
try {
    nativeModule = require('./build/Release/chrome_embed.node');
    console.log('[Chrome Embed] Native module loaded:', nativeModule.platform);
} catch (err) {
    console.error('[Chrome Embed] Failed to load native module:', err.message);
}

// State
let chromeProcess = null;

/**
 * Launch Chrome browser in app mode
 *
 * @param {string} url - URL to open
 * @param {number} windowHandle - Electron window handle
 * @returns {Promise<{success: boolean, pid?: number}>}
 */
async function launchChrome(url, windowHandle) {
    if (!nativeModule) {
        throw new Error('Chrome Embed native module not available');
    }

    // Launch Chrome process
    const result = nativeModule.launchChrome(url, windowHandle);

    if (!result.success) {
        throw new Error('Failed to launch Chrome');
    }

    chromeProcess = {
        pid: result.pid,
        platform: result.platform
    };

    return { success: true, pid: result.pid, positioned: result.positioned };
}

/**
 * Reposition Chrome window
 *
 * @param {number} windowHandle - Electron window handle
 * @returns {Promise<{success: boolean}>}
 */
async function repositionChrome(windowHandle) {
    if (!nativeModule) {
        throw new Error('Chrome Embed native module not available');
    }

    const result = nativeModule.repositionChrome(windowHandle);
    return result;
}

/**
 * Navigate Chrome to new URL
 *
 * @param {string} url - URL to navigate to
 * @returns {Promise<{success: boolean}>}
 */
async function navigateChrome(url) {
    if (!nativeModule) {
        throw new Error('Chrome Embed native module not available');
    }

    const result = nativeModule.navigateChrome(url);
    return { success: result.success };
}

/**
 * Close Chrome
 *
 * @returns {Promise<{success: boolean}>}
 */
async function closeChrome() {
    if (!nativeModule) {
        throw new Error('Chrome Embed native module not available');
    }

    const result = nativeModule.closeChrome();
    chromeProcess = null;

    return { success: result.success };
}

/**
 * Check if Chrome is running
 *
 * @returns {Promise<{running: boolean, pid?: number}>}
 */
async function isChromeRunning() {
    if (!nativeModule) {
        return { running: false };
    }

    return nativeModule.isChromeRunning();
}

/**
 * Get platform information
 */
function getPlatform() {
    if (!nativeModule) {
        return { name: 'unknown', windowSystem: 'unknown' };
    }
    return nativeModule.platform;
}

/**
 * Check if native module is available
 */
function isAvailable() {
    return nativeModule !== null;
}

module.exports = {
    launchChrome,
    repositionChrome,
    navigateChrome,
    closeChrome,
    isChromeRunning,
    getPlatform,
    isAvailable
};
