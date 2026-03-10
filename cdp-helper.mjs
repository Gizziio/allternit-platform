#!/usr/bin/env node
/**
 * Chrome DevTools Protocol (CDP) Helper
 * Automates Chrome for A2R development via HTTP CDP endpoints
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

const CDP_PORT = 9222;
const APP_URL = 'http://127.0.0.1:5177';

// Helper to make CDP requests
async function cdpRequest(endpoint, method = 'GET', body = null) {
  const url = `http://localhost:${CDP_PORT}${endpoint}`;
  try {
    const options = {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {}
    };
    if (body) options.body = JSON.stringify(body);
    
    const response = await fetch(url, options);
    return await response.json();
  } catch (err) {
    return { error: err.message };
  }
}

// Get Chrome version info
async function getVersion() {
  const info = await cdpRequest('/json/version');
  if (info.error) {
    console.log('❌ Cannot connect to Chrome on port', CDP_PORT);
    console.log('   Start Chrome with: ./chrome-dev.sh');
    return;
  }
  console.log('✅ Chrome Connected');
  console.log('   Browser:', info.Browser);
  console.log('   Protocol:', info['Protocol-Version']);
}

// List available targets (tabs/pages)
async function listTargets() {
  const targets = await cdpRequest('/json/list');
  if (targets.error) {
    console.log('❌ Cannot connect to Chrome. Is it running?');
    console.log('   Start with: ./chrome-dev.sh');
    return [];
  }
  
  console.log('\n📋 Available Targets:');
  targets.forEach((t, i) => {
    const isA2R = t.url.includes('localhost:5177') ? ' ⭐ A2R' : '';
    console.log(`\n   ${i + 1}. ${t.title}${isA2R}`);
    console.log(`      URL: ${t.url.substring(0, 60)}${t.url.length > 60 ? '...' : ''}`);
    console.log(`      Type: ${t.type}, ID: ${t.id}`);
  });
  return targets;
}

// Get DevTools frontend URL for a target
async function getDevToolsUrl(targetId = null) {
  const targets = await cdpRequest('/json/list');
  const target = targetId 
    ? targets.find(t => t.id === targetId)
    : targets.find(t => t.url.includes('localhost:5177'));
  
  if (target) {
    const devtoolsUrl = `http://localhost:${CDP_PORT}${target.devtoolsFrontendUrl}`;
    console.log('\n🔧 DevTools URL:');
    console.log(`   ${devtoolsUrl}`);
    return devtoolsUrl;
  }
  console.log('❌ Target not found');
  return null;
}

// Create a new tab
async function newTab(url = APP_URL) {
  const result = await cdpRequest(`/json/new?${url}`);
  console.log('✅ New tab created:', result.id);
  console.log('   URL:', result.url);
  return result;
}

// Activate (focus) a tab
async function activateTab(targetId) {
  const result = await cdpRequest(`/json/activate/${targetId}`, 'GET');
  console.log(result.error ? '❌' : '✅', 'Tab activate:', targetId);
  return result;
}

// Close a tab
async function closeTab(targetId) {
  const result = await cdpRequest(`/json/close/${targetId}`, 'GET');
  console.log(result.error ? '❌' : '✅', 'Tab close:', targetId);
  return result;
}

// Open DevTools in separate window
async function openDevTools() {
  const url = await getDevToolsUrl();
  if (url) {
    execSync(`open "${url}"`);
    console.log('✅ DevTools opened in browser');
  }
}

// Screenshot via AppleScript (since WebSocket needs ws module)
async function screenshot(filename = 'screenshot.png') {
  const script = `
    tell application "Google Chrome"
      activate
      set pngData to execute front window's active tab javascript "
        new Promise((resolve) => {
          const canvas = document.createElement('canvas');
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawWindow(window, 0, 0, canvas.width, canvas.height, 'rgb(255,255,255)');
          resolve(canvas.toDataURL('image/png'));
        })
      "
      return pngData
    end tell
  `;
  try {
    // Fallback: use cURL to page.screenshot via CDP WebSocket would need ws
    // For now, use macOS screencapture
    execSync(`screencapture -w "${filename}"`);
    console.log(`✅ Screenshot saved: ${filename}`);
  } catch (e) {
    console.log('❌ Screenshot failed:', e.message);
  }
}

// Main CLI
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'version':
    case 'status':
      await getVersion();
      break;
    case 'list':
    case 'targets':
      await listTargets();
      break;
    case 'devtools':
      await openDevTools();
      break;
    case 'new':
      await newTab(process.argv[3] || APP_URL);
      break;
    case 'activate':
      await activateTab(process.argv[3]);
      break;
    case 'close':
      await closeTab(process.argv[3]);
      break;
    case 'screenshot':
      await screenshot(process.argv[3] || 'screenshot.png');
      break;
    case 'url':
      await getDevToolsUrl();
      break;
    case 'test':
      console.log('Testing connection...');
      await getVersion();
      break;
    case 'reload':
      console.log('To reload, press Cmd+R in Chrome or use watch-reload.mjs');
      break;
    default:
      console.log(`
╔══════════════════════════════════════════════════════════╗
║     Chrome DevTools Protocol (CDP) Helper                ║
║     For A2R Browser Development                          ║
╚══════════════════════════════════════════════════════════╝

Usage: node cdp-helper.mjs <command> [args]

Commands:
  version, status      Show Chrome connection status
  list, targets        List all targets/tabs
  devtools             Open DevTools in browser
  new [url]            Create new tab
  activate <id>        Focus a tab
  close <id>           Close a tab
  screenshot [file]    Take screenshot (default: screenshot.png)
  url                  Get DevTools URL
  test                 Test CDP connection

Examples:
  node cdp-helper.mjs test
  node cdp-helper.mjs devtools
  node cdp-helper.mjs list

Quick Start:
  1. ./dev-browser.sh          # Start Vite + Chrome
  2. node watch-reload.mjs     # Auto-reload on changes  
  3. node cdp-helper.mjs devtools  # Open DevTools

Benefits over Electron:
  ✅ Zero disk bloat (no 17GB Chromium)
  ✅ Instant startup (1s vs 10s)
  ✅ Native Chrome DevTools
  ✅ Lower memory usage

Stop Chrome: pkill -f a2r-chrome-dev
`);
  }
}

main().catch(console.error);
