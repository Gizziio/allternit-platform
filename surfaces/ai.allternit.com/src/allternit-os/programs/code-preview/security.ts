/**
 * Code Preview Security - CSP Policies and HTML Generation
 */

import type { CodePreviewFile } from '../../types/programs';

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('Security');

export const CSP_POLICY = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval' blob: https: http:", // Allow CDN scripts (Tailwind, Alpine, etc.)
  "style-src 'unsafe-inline' https: http:",                       // Allow CDN stylesheets
  "img-src blob: data: https: http:",
  "connect-src https: http:",                                     // Allow fetch/XHR from previewed sites
  "font-src data: https: http:",
  "media-src blob: data:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

export const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP_POLICY,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

export function generateSafeHTML(files: CodePreviewFile[], entryFile: string): string {
  const htmlFile = files.find(f => f.path === entryFile) || files.find(f => f.path.endsWith('.html'));
  if (!htmlFile) return '<!DOCTYPE html><html><body>No HTML file found</body></html>';

  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${CSP_POLICY}">`;
  
  const securityScript = `
<script>
(function() {
  'use strict';
  
  window.onbeforeunload = function() { return false; };
  
  window.open = function() { 
    logger.warn('Popup blocked'); 
    return null; 
  };
  
  window.alert = function(msg) { console.debug('[ALERT]', msg); };
  window.confirm = function() { return true; };
  window.prompt = function() { return null; };
  
  const originalConsole = {
    log: console.debug,
    error: console.error,
    warn: console.warn,
    info: console.debug
  };
  
  function sendToParent(type, args) {
    try {
      const message = args.map(arg => {
        try {
          return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
        } catch (e) {
          return '[Object]';
        }
      }).join(' ');
      
      window.parent.postMessage({
        source: 'allternit-preview',
        type: 'console',
        level: type,
        message: message,
        timestamp: Date.now()}, '*');
    } catch (e) {}
  }
  
  console.debug = function(...args) {
    originalConsole.log.apply(console, args);
    sendToParent('log', args);
  };
  
  console.error = function(...args) {
    originalConsole.error.apply(console, args);
    sendToParent('error', args);
  };
  
  console.warn = function(...args) {
    originalConsole.warn.apply(console, args);
    sendToParent('warn', args);
  };
  
  console.info = function(...args) {
    originalConsole.info.apply(console, args);
    sendToParent('info', args);
  };
  
  window.onerror = function(msg, url, line, col, error) {
    sendToParent('error', [msg, 'at', url + ':' + line + ':' + col]);
    return true;
  };
  
  window.addEventListener('error', function(e) {
    sendToParent('error', [e.message, 'at', e.filename + ':' + e.lineno]);
  });
  
  document.addEventListener('click', function(e) {
    const target = e.target.closest('a');
    if (target && target.href && !target.href.startsWith('blob:') && !target.href.startsWith('javascript:')) {
      e.preventDefault();
      console.warn('External navigation blocked:', target.href);
    }
  }, true);
})();
</script>`;

  let html = htmlFile.content;
  
  if (html.includes('<head>')) {
    html = html.replace('<head>', `<head>${cspMeta}${securityScript}`);
  } else if (html.includes('<html>')) {
    html = html.replace('<html>', `<html><head>${cspMeta}${securityScript}</head>`);
  } else {
    html = `${cspMeta}${securityScript}${html}`;
  }

  return html;
}
