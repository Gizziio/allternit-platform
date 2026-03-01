"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");

// Agent Runner API
const agentRunnerAPI = {
    async setExpanded(expanded) {
        return electron_1.ipcRenderer.invoke('agent-runner:setExpanded', expanded);
    },
    async close() {
        return electron_1.ipcRenderer.invoke('agent-runner:close');
    },
};

// Chrome API - Opens Chrome Web Store in system Chrome browser
const chromeAPI = {
    async open(url) {
        console.log('[Preload] Opening URL in Chrome:', url);
        const result = await electron_1.ipcRenderer.invoke('chrome:open', url);
        console.log('[Preload] Result:', result);
        return result;
    },
};

// Expose to window
electron_1.contextBridge.exposeInMainWorld('a2AgentRunner', agentRunnerAPI);
electron_1.contextBridge.exposeInMainWorld('chromeEmbed', chromeAPI);

// Log that preload loaded
console.log('[PRELOAD] Loaded with Chrome support');
