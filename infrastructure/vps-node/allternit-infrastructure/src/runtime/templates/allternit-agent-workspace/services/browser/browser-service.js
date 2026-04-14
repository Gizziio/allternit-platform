#!/usr/bin/env node
// ============================================================================
// A2R Sandbox Browser Service
// Provides isolated browser automation capabilities
// ============================================================================

const http = require('http');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = process.env.BROWSER_PORT || 3001;
const BROWSER_TYPE = process.env.BROWSER_TYPE || 'chromium';
const BROWSER_HEADLESS = process.env.BROWSER_HEADLESS === 'true';

let browserProcess = null;
let cdpWsUrl = null;

// Logging
function log(level, message) {
    console.error(`[${new Date().toISOString()}] [${level}] ${message}`);
}

// Start browser process
async function startBrowser() {
    if (browserProcess) {
        return { success: true, message: 'Browser already running' };
    }

    const args = [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-sync',
        '--disable-translate',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--remote-debugging-address=0.0.0.0',
        '--remote-debugging-port=9222',
        '--user-data-dir=/home/browser/.config/chromium'
    ];

    if (BROWSER_HEADLESS) {
        args.push('--headless');
    }

    if (process.env.BROWSER_DISABLE_GPU === 'true') {
        args.push('--disable-gpu');
    }

    const browserCmd = BROWSER_TYPE === 'firefox' ? 'firefox' : 'chromium-browser';
    
    browserProcess = spawn(browserCmd, args, {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    browserProcess.stdout.on('data', (data) => {
        log('BROWSER', data.toString().trim());
    });

    browserProcess.stderr.on('data', (data) => {
        const output = data.toString();
        // Extract CDP WebSocket URL
        const wsMatch = output.match(/ws:\/\/[^\s]+/);
        if (wsMatch) {
            cdpWsUrl = wsMatch[0];
        }
        log('BROWSER', output.trim());
    });

    browserProcess.on('exit', (code) => {
        log('INFO', `Browser exited with code ${code}`);
        browserProcess = null;
        cdpWsUrl = null;
    });

    // Wait for browser to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return { success: true, message: 'Browser started', pid: browserProcess.pid };
}

// Stop browser process
async function stopBrowser() {
    if (!browserProcess) {
        return { success: true, message: 'Browser not running' };
    }

    browserProcess.kill('SIGTERM');
    
    // Wait for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (browserProcess) {
        browserProcess.kill('SIGKILL');
    }
    
    browserProcess = null;
    cdpWsUrl = null;
    
    return { success: true, message: 'Browser stopped' };
}

// Get browser status
function getStatus() {
    return {
        running: !!browserProcess,
        type: BROWSER_TYPE,
        headless: BROWSER_HEADLESS,
        pid: browserProcess?.pid || null,
        cdp_url: cdpWsUrl,
        uptime: browserProcess ? Date.now() - browserProcess.startTime : 0
    };
}

// HTTP request handler
function handleRequest(req, res) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;
    const method = req.method;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Health check
    if (pathname === '/health') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', browser: getStatus() }));
        return;
    }

    // Status endpoint
    if (pathname === '/status') {
        res.writeHead(200);
        res.end(JSON.stringify(getStatus()));
        return;
    }

    // Start browser
    if (pathname === '/start' && method === 'POST') {
        startBrowser().then(result => {
            res.writeHead(result.success ? 200 : 500);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // Stop browser
    if (pathname === '/stop' && method === 'POST') {
        stopBrowser().then(result => {
            res.writeHead(result.success ? 200 : 500);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // Screenshot endpoint
    if (pathname === '/screenshot' && method === 'POST') {
        // Would integrate with Playwright for screenshots
        res.writeHead(501);
        res.end(JSON.stringify({ error: 'Not implemented' }));
        return;
    }

    // Default
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found', endpoints: ['/health', '/status', '/start', '/stop'] }));
}

// Start server
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
    log('INFO', `Browser service running on port ${PORT}`);
    
    // Auto-start browser if configured
    if (process.env.AUTO_START_BROWSER === 'true') {
        startBrowser();
    }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    log('INFO', 'SIGTERM received, shutting down');
    await stopBrowser();
    server.close(() => process.exit(0));
});

process.on('SIGINT', async () => {
    log('INFO', 'SIGINT received, shutting down');
    await stopBrowser();
    server.close(() => process.exit(0));
});
