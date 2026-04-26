#!/usr/bin/env node
// ============================================================================
// Allternit Agent Workspace - Health Check Endpoint
// Express server providing health status and monitoring information
// ============================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const os = require('os');

// Configuration
const PORT = process.env.HEALTH_PORT || 3000;
const AGENT_ID = process.env.AGENT_ID || 'default';
const AGENT_NAME = process.env.AGENT_NAME || 'Allternit Agent';
const VERSION = process.env.AGENT_VERSION || '1.0.0';
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || '/home/agent/workspace';
const START_TIME = Date.now();

// Tool availability cache
let toolsCache = null;
let toolsCacheTime = 0;
const TOOLS_CACHE_TTL = 60000; // 1 minute

// ============================================================================
// Utility Functions
// ============================================================================

function log(level, message) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [${level}] [healthcheck] ${message}`);
}

const info = (msg) => log('INFO', msg);
const warn = (msg) => log('WARN', msg);
const error = (msg) => log('ERROR', msg);

function safeExec(command, options = {}) {
    try {
        return execSync(command, { 
            encoding: 'utf8', 
            timeout: 5000,
            ...options 
        }).trim();
    } catch (e) {
        return null;
    }
}

function safeExecAsync(command, callback) {
    exec(command, { timeout: 5000 }, (err, stdout, stderr) => {
        if (err) {
            callback(err, null);
        } else {
            callback(null, stdout.trim());
        }
    });
}

// ============================================================================
// System Information
// ============================================================================

function getSystemInfo() {
    return {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        node_version: process.version,
        uptime_seconds: Math.floor(os.uptime()),
        load_average: os.loadavg(),
        total_memory_bytes: os.totalmem(),
        free_memory_bytes: os.freemem(),
        cpus: os.cpus().length,
        cpu_model: os.cpus()[0]?.model || 'unknown'
    };
}

function getResourceUsage() {
    const usage = process.resourceUsage ? process.resourceUsage() : {};
    const memory = process.memoryUsage();
    
    return {
        process: {
            pid: process.pid,
            uptime_seconds: Math.floor((Date.now() - START_TIME) / 1000),
            memory_usage_bytes: memory,
            cpu_user_seconds: usage.userCPUTime,
            cpu_system_seconds: usage.systemCPUTime
        },
        system: {
            memory_used_bytes: os.totalmem() - os.freemem(),
            memory_free_bytes: os.freemem(),
            memory_used_percent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2),
            load_average_1m: os.loadavg()[0],
            load_average_5m: os.loadavg()[1],
            load_average_15m: os.loadavg()[2]
        }
    };
}

function getDiskUsage() {
    try {
        const df = safeExec('df -B1 ' + WORKSPACE_DIR);
        if (!df) return null;
        
        const lines = df.split('\n');
        if (lines.length < 2) return null;
        
        const parts = lines[1].trim().split(/\s+/);
        return {
            filesystem: parts[0],
            total_bytes: parseInt(parts[1]),
            used_bytes: parseInt(parts[2]),
            available_bytes: parseInt(parts[3]),
            used_percent: parseInt(parts[4].replace('%', ''))
        };
    } catch (e) {
        return null;
    }
}

// ============================================================================
// Browser Status
// ============================================================================

function getBrowserStatus() {
    const browsers = {
        chromium: {
            available: false,
            version: null,
            path: null,
            playwright_path: '/ms-playwright/chromium-*',
            devtools_port: 9222
        },
        firefox: {
            available: false,
            version: null,
            path: null,
            playwright_path: '/ms-playwright/firefox-*',
            devtools_port: null
        },
        webkit: {
            available: false,
            version: null,
            path: null,
            playwright_path: '/ms-playwright/webkit-*',
            devtools_port: null
        }
    };
    
    // Check system Chromium
    const chromiumPath = safeExec('which chromium-browser') || safeExec('which chromium') || safeExec('which google-chrome-stable');
    if (chromiumPath) {
        browsers.chromium.available = true;
        browsers.chromium.path = chromiumPath;
        browsers.chromium.version = safeExec(`${chromiumPath} --version`);
    }
    
    // Check system Firefox
    const firefoxPath = safeExec('which firefox');
    if (firefoxPath) {
        browsers.firefox.available = true;
        browsers.firefox.path = firefoxPath;
        browsers.firefox.version = safeExec(`${firefoxPath} --version`);
    }
    
    // Check Playwright browsers
    try {
        const playwrightPath = safeExec('find /ms-playwright -name "chromium" -type f 2>/dev/null | head -1');
        if (playwrightPath) {
            browsers.chromium.playwright_available = true;
            browsers.chromium.playwright_path = playwrightPath;
        }
        
        const firefoxPlaywrightPath = safeExec('find /ms-playwright -name "firefox" -type f 2>/dev/null | head -1');
        if (firefoxPlaywrightPath) {
            browsers.firefox.playwright_available = true;
            browsers.firefox.playwright_path = firefoxPlaywrightPath;
        }
    } catch (e) {
        // Ignore errors
    }
    
    // Check if browsers are running
    browsers.chromium.running = !!safeExec('pgrep -f "chromium" || pgrep -f "chrome"');
    browsers.firefox.running = !!safeExec('pgrep -f "firefox"');
    
    return browsers;
}

// ============================================================================
// Tool Availability
// ============================================================================

function getToolAvailability() {
    const now = Date.now();
    if (toolsCache && (now - toolsCacheTime) < TOOLS_CACHE_TTL) {
        return toolsCache;
    }
    
    const tools = {
        nodejs: { available: false, version: null },
        python: { available: false, version: null },
        deno: { available: false, version: null },
        git: { available: false, version: null },
        curl: { available: false, version: null },
        wget: { available: false, version: null },
        jq: { available: false, version: null },
        pandoc: { available: false, version: null },
        imagemagick: { available: false, version: null },
        ffmpeg: { available: false, version: null },
        firejail: { available: false, version: null },
        playwright: { available: false, version: null },
        chromadb: { available: false, version: null }
    };
    
    // Check Node.js
    tools.nodejs.available = !!safeExec('which node');
    tools.nodejs.version = safeExec('node --version');
    
    // Check Python
    tools.python.available = !!safeExec('which python3.11');
    tools.python.version = safeExec('python3.11 --version');
    
    // Check Deno
    tools.deno.available = !!safeExec('which deno');
    tools.deno.version = safeExec('deno --version')?.split('\n')[0];
    
    // Check system tools
    tools.git.available = !!safeExec('which git');
    tools.git.version = safeExec('git --version');
    
    tools.curl.available = !!safeExec('which curl');
    tools.curl.version = safeExec('curl --version')?.split('\n')[0];
    
    tools.wget.available = !!safeExec('which wget');
    tools.wget.version = safeExec('wget --version')?.split('\n')[0];
    
    tools.jq.available = !!safeExec('which jq');
    tools.jq.version = safeExec('jq --version');
    
    tools.pandoc.available = !!safeExec('which pandoc');
    tools.pandoc.version = safeExec('pandoc --version')?.split('\n')[0];
    
    // Check media tools
    tools.imagemagick.available = !!safeExec('which convert');
    tools.imagemagick.version = safeExec('convert --version')?.split('\n')[0];
    
    tools.ffmpeg.available = !!safeExec('which ffmpeg');
    tools.ffmpeg.version = safeExec('ffmpeg -version')?.split('\n')[0];
    
    // Check security tools
    tools.firejail.available = !!safeExec('which firejail');
    tools.firejail.version = safeExec('firejail --version')?.split('\n')[0];
    
    // Check Python packages
    try {
        const playwrightCheck = safeExec('python3.11 -c "import playwright; print(playwright.__version__)"');
        tools.playwright.available = !!playwrightCheck;
        tools.playwright.version = playwrightCheck;
    } catch (e) {
        tools.playwright.available = false;
    }
    
    try {
        const chromaCheck = safeExec('python3.11 -c "import chromadb; print(chromadb.__version__)"');
        tools.chromadb.available = !!chromaCheck;
        tools.chromadb.version = chromaCheck;
    } catch (e) {
        tools.chromadb.available = false;
    }
    
    // Check if ChromaDB server is accessible
    tools.chromadb.server_url = process.env.CHROMADB_HOST ? 
        `http://${process.env.CHROMADB_HOST}:${process.env.CHROMADB_PORT || 8000}` : 
        'http://vector-db:8000';
    
    toolsCache = tools;
    toolsCacheTime = now;
    
    return tools;
}

// ============================================================================
// Python Packages Info
// ============================================================================

function getPythonPackages() {
    try {
        const packagesList = safeExec('python3.11 -c "import pkg_resources; print(\\"\\n\\".join([f\\"{d.key}=={d.version}\\" for d in pkg_resources.working_set]))"');
        if (!packagesList) return {};
        
        const packages = {};
        packagesList.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)==(.+)$/);
            if (match) {
                packages[match[1]] = match[2];
            }
        });
        return packages;
    } catch (e) {
        return {};
    }
}

// ============================================================================
// ChromaDB Status
// ============================================================================

function getChromaDBStatus(callback) {
    const chromaHost = process.env.CHROMADB_HOST || 'vector-db';
    const chromaPort = process.env.CHROMADB_PORT || 8000;
    
    const options = {
        hostname: chromaHost,
        port: chromaPort,
        path: '/api/v1/heartbeat',
        method: 'GET',
        timeout: 5000
    };
    
    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const response = JSON.parse(data);
                callback(null, {
                    available: true,
                    host: chromaHost,
                    port: chromaPort,
                    heartbeat: response
                });
            } catch (e) {
                callback(null, {
                    available: true,
                    host: chromaHost,
                    port: chromaPort,
                    error: 'Invalid response'
                });
            }
        });
    });
    
    req.on('error', (err) => {
        callback(null, {
            available: false,
            host: chromaHost,
            port: chromaPort,
            error: err.message
        });
    });
    
    req.on('timeout', () => {
        req.destroy();
        callback(null, {
            available: false,
            host: chromaHost,
            port: chromaPort,
            error: 'Timeout'
        });
    });
    
    req.end();
}

// ============================================================================
// Workspace Status
// ============================================================================

function getWorkspaceStatus() {
    try {
        const dirs = ['input', 'output', 'temp', 'files', 'downloads', 'uploads'];
        const status = {};
        
        dirs.forEach(dir => {
            const dirPath = path.join(WORKSPACE_DIR, dir);
            try {
                const stats = fs.statSync(dirPath);
                if (stats.isDirectory()) {
                    const files = fs.readdirSync(dirPath);
                    status[dir] = {
                        exists: true,
                        file_count: files.length
                    };
                }
            } catch (e) {
                status[dir] = {
                    exists: false,
                    error: e.message
                };
            }
        });
        
        return status;
    } catch (e) {
        return { error: e.message };
    }
}

// ============================================================================
// Health Check
// ============================================================================

function getHealthStatus() {
    const tools = getToolAvailability();
    const browsers = getBrowserStatus();
    
    // Determine overall health
    const criticalTools = ['nodejs', 'python'];
    const criticalBrowsers = ['chromium'];
    
    const criticalToolsOk = criticalTools.every(t => tools[t]?.available);
    const criticalBrowsersOk = criticalBrowsers.every(b => browsers[b]?.available);
    
    let status = 'healthy';
    if (!criticalToolsOk) {
        status = 'critical';
    } else if (!criticalBrowsersOk) {
        status = 'degraded';
    }
    
    return {
        status,
        agent_id: AGENT_ID,
        agent_name: AGENT_NAME,
        version: VERSION,
        timestamp: new Date().toISOString(),
        checks: {
            critical_tools: criticalToolsOk,
            critical_browsers: criticalBrowsersOk,
            sandbox_available: tools.firejail?.available || false
        }
    };
}

// ============================================================================
// HTTP Server
// ============================================================================

function handleRequest(req, res) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    
    // Quick health check (for Docker/k8s)
    if (pathname === '/health' || pathname === '/healthz') {
        const health = getHealthStatus();
        const statusCode = health.status === 'critical' ? 503 : 200;
        res.writeHead(statusCode);
        res.end(JSON.stringify({
            status: health.status,
            timestamp: health.timestamp
        }, null, 2));
        return;
    }
    
    // Full health check
    if (pathname === '/health/full') {
        getChromaDBStatus((err, chromaStatus) => {
            const response = {
                ...getHealthStatus(),
                system: getSystemInfo(),
                resources: getResourceUsage(),
                disk: getDiskUsage(),
                browsers: getBrowserStatus(),
                tools: getToolAvailability(),
                chromadb: chromaStatus,
                workspace: getWorkspaceStatus()
            };
            
            res.writeHead(200);
            res.end(JSON.stringify(response, null, 2));
        });
        return;
    }
    
    // Tools endpoint
    if (pathname === '/tools') {
        res.writeHead(200);
        res.end(JSON.stringify(getToolAvailability(), null, 2));
        return;
    }
    
    // Browsers endpoint
    if (pathname === '/browsers') {
        res.writeHead(200);
        res.end(JSON.stringify(getBrowserStatus(), null, 2));
        return;
    }
    
    // Resources endpoint
    if (pathname === '/resources') {
        res.writeHead(200);
        res.end(JSON.stringify({
            system: getSystemInfo(),
            resources: getResourceUsage(),
            disk: getDiskUsage()
        }, null, 2));
        return;
    }
    
    // Python packages endpoint
    if (pathname === '/packages/python') {
        res.writeHead(200);
        res.end(JSON.stringify(getPythonPackages(), null, 2));
        return;
    }
    
    // Status endpoint
    if (pathname === '/' || pathname === '/status') {
        res.writeHead(200);
        res.end(JSON.stringify({
            service: 'Allternit Agent Workspace',
            agent_id: AGENT_ID,
            agent_name: AGENT_NAME,
            version: VERSION,
            status: 'running',
            uptime_seconds: Math.floor((Date.now() - START_TIME) / 1000),
            endpoints: [
                { path: '/health', description: 'Quick health check' },
                { path: '/health/full', description: 'Full health status' },
                { path: '/tools', description: 'Available tools' },
                { path: '/browsers', description: 'Browser status' },
                { path: '/resources', description: 'Resource usage' },
                { path: '/packages/python', description: 'Python packages' }
            ]
        }, null, 2));
        return;
    }
    
    // 404 for unknown paths
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }, null, 2));
}

// ============================================================================
// CLI Mode (--check flag for health checks)
// ============================================================================

function runCliCheck() {
    const health = getHealthStatus();
    
    if (health.status === 'critical') {
        console.error('Health check FAILED: Critical tools unavailable');
        process.exit(1);
    }
    
    console.log('Health check PASSED');
    process.exit(0);
}

// ============================================================================
// Main
// ============================================================================

function main() {
    // Check for CLI mode
    if (process.argv.includes('--check')) {
        runCliCheck();
        return;
    }
    
    const server = http.createServer(handleRequest);
    
    server.listen(PORT, () => {
        info(`Allternit Agent Workspace Health Check running on port ${PORT}`);
        info(`Agent ID: ${AGENT_ID}`);
    });
    
    server.on('error', (err) => {
        error(`Server error: ${err.message}`);
        process.exit(1);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
        info('SIGTERM received, shutting down gracefully');
        server.close(() => {
            process.exit(0);
        });
    });
    
    process.on('SIGINT', () => {
        info('SIGINT received, shutting down gracefully');
        server.close(() => {
            process.exit(0);
        });
    });
}

main();
