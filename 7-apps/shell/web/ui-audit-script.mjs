/**
 * UI Audit Script - Automated Visual Testing
 * Captures screenshots and analyzes each view for issues
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'ui-audit-output');

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// All views to test based on rail.config.ts and lazyRegistry.ts
const VIEWS_TO_TEST = [
  // Core
  { id: 'home', name: 'Home', selector: '[data-view="home"]' },
  { id: 'chat', name: 'Chat', selector: '[data-view="chat"]' },
  { id: 'elements', name: 'Elements Lab', selector: '[data-view="elements"]' },
  { id: 'browser', name: 'Browser', selector: '[data-view="browser"]' },
  
  // Agents
  { id: 'agent', name: 'Agent Studio', selector: '[data-view="agent"]' },
  { id: 'native-agent', name: 'Native Agent', selector: '[data-view="native-agent"]' },
  { id: 'rails', name: 'Agent System', selector: '[data-view="rails"]' },
  { id: 'registry', name: 'Agent Registry', selector: '[data-view="registry"]' },
  { id: 'memory', name: 'Memory', selector: '[data-view="memory"]' },
  
  // AI & Vision
  { id: 'ivkge', name: 'IVKGE', selector: '[data-view="ivkge"]' },
  { id: 'multimodal', name: 'Multimodal', selector: '[data-view="multimodal"]' },
  { id: 'tambo', name: 'Tambo UI Gen', selector: '[data-view="tambo"]' },
  
  // DAG Infrastructure
  { id: 'swarm', name: 'Swarm Monitor', selector: '[data-view="swarm"]' },
  { id: 'policy', name: 'Policy Manager', selector: '[data-view="policy"]' },
  { id: 'task-executor', name: 'Task Executor', selector: '[data-view="task-executor"]' },
  { id: 'ontology', name: 'Ontology Viewer', selector: '[data-view="ontology"]' },
  { id: 'directive', name: 'Directive Compiler', selector: '[data-view="directive"]' },
  { id: 'evaluation', name: 'Evaluation', selector: '[data-view="evaluation"]' },
  { id: 'gc-agents', name: 'GC Agents', selector: '[data-view="gc-agents"]' },
  
  // Security & Governance
  { id: 'receipts', name: 'Receipts', selector: '[data-view="receipts"]' },
  { id: 'policy-gating', name: 'Policy Gating', selector: '[data-view="policy-gating"]' },
  { id: 'security', name: 'Security', selector: '[data-view="security"]' },
  { id: 'purpose', name: 'Purpose Binding', selector: '[data-view="purpose"]' },
  
  // Execution
  { id: 'browserview', name: 'Browser View', selector: '[data-view="browserview"]' },
  { id: 'dag-wih', name: 'DAG WIH', selector: '[data-view="dag-wih"]' },
  { id: 'checkpointing', name: 'Checkpointing', selector: '[data-view="checkpointing"]' },
  
  // Observability
  { id: 'observability', name: 'Observability', selector: '[data-view="observability"]' },
  
  // Services
  { id: 'studio', name: 'Studio', selector: '[data-view="studio"]' },
  { id: 'marketplace', name: 'Marketplace', selector: '[data-view="marketplace"]' },
  { id: 'openclaw', name: 'OpenClaw Control', selector: '[data-view="openclaw"]' },
  { id: 'dag', name: 'DAG Integration', selector: '[data-view="dag"]' },
];

// Issues to detect
const ISSUES_FOUND = [];

async function checkForIssues(page, viewId, viewName) {
  const issues = [];
  
  // Wait for potential loading states
  await page.waitForTimeout(2000);
  
  // Check for error boundaries
  const errorBoundary = await page.$('[role="alert"], .error-boundary, [data-error]');
  if (errorBoundary) {
    const errorText = await errorBoundary.textContent();
    issues.push({
      type: 'ERROR_BOUNDARY',
      severity: 'critical',
      message: `Error boundary triggered: ${errorText.substring(0, 200)}`
    });
  }
  
  // Check for console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  if (consoleErrors.length > 0) {
    issues.push({
      type: 'CONSOLE_ERRORS',
      severity: 'high',
      message: `Console errors: ${consoleErrors.join('; ').substring(0, 200)}`
    });
  }
  
  // Check for broken images
  const brokenImages = await page.$$eval('img[src]', imgs => 
    imgs.filter(img => !img.complete || img.naturalHeight === 0).map(img => img.src)
  );
  if (brokenImages.length > 0) {
    issues.push({
      type: 'BROKEN_IMAGES',
      severity: 'medium',
      message: `Broken images: ${brokenImages.join(', ')}`
    });
  }
  
  // Check for empty states that might indicate loading issues
  const emptyContainers = await page.$$eval('[data-empty], .empty-state', els => els.length);
  if (emptyContainers > 0) {
    issues.push({
      type: 'EMPTY_STATE',
      severity: 'low',
      message: `${emptyContainers} empty state containers found`
    });
  }
  
  // Check for unstyled content (FOUC)
  const unstyledContent = await page.$$eval('[style*="display: none"]', els => els.length);
  if (unstyledContent > 0) {
    issues.push({
      type: 'UNSTYLED_CONTENT',
      severity: 'medium',
      message: `${unstyledContent} elements with display:none (possible FOUC)`
    });
  }
  
  // Check for missing alt text on images
  const missingAlt = await page.$$eval('img:not([alt])', imgs => imgs.length);
  if (missingAlt > 0) {
    issues.push({
      type: 'ACCESSIBILITY',
      severity: 'low',
      message: `${missingAlt} images missing alt text`
    });
  }
  
  // Check for overlapping elements
  const viewport = await page.viewportSize();
  if (viewport) {
    const overlappingElements = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const overlaps = [];
      for (let i = 0; i < elements.length; i++) {
        const rect1 = elements[i].getBoundingClientRect();
        if (rect1.width === 0 || rect1.height === 0) continue;
        
        for (let j = i + 1; j < elements.length; j++) {
          const rect2 = elements[j].getBoundingClientRect();
          if (rect2.width === 0 || rect2.height === 0) continue;
          
          const overlap = !(rect1.right < rect2.left || 
                          rect1.left > rect2.right || 
                          rect1.bottom < rect2.top || 
                          rect1.top > rect2.bottom);
          
          if (overlap) {
            const zIndex1 = window.getComputedStyle(elements[i]).zIndex;
            const zIndex2 = window.getComputedStyle(elements[j]).zIndex;
            if (zIndex1 === 'auto' || zIndex2 === 'auto' || zIndex1 === zIndex2) {
              overlaps.push({
                el1: elements[i].tagName,
                el2: elements[j].tagName
              });
            }
          }
        }
      }
      return overlaps.slice(0, 5); // Limit to first 5
    });
    
    if (overlappingElements.length > 0) {
      issues.push({
        type: 'OVERLAPPING_ELEMENTS',
        severity: 'medium',
        message: `Overlapping elements detected: ${JSON.stringify(overlappingElements)}`
      });
    }
  }
  
  // Check for text overflow issues
  const textOverflow = await page.$$eval('*', els => {
    const overflowed = [];
    for (const el of els) {
      const style = window.getComputedStyle(el);
      if (el.scrollWidth > el.clientWidth && style.overflow === 'hidden') {
        overflowed.push(el.tagName);
      }
    }
    return overflowed.slice(0, 5);
  });
  
  if (textOverflow.length > 0) {
    issues.push({
      type: 'TEXT_OVERFLOW',
      severity: 'low',
      message: `Text overflow detected in: ${[...new Set(textOverflow)].join(', ')}`
    });
  }
  
  // Check for color contrast issues (basic check)
  const contrastIssues = await page.evaluate(() => {
    // This is a simplified check - real contrast checking needs computed colors
    const elements = document.querySelectorAll('button, a, [role="button"]');
    const issues = [];
    elements.forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.fontSize.replace('px', '') < 12) {
        issues.push(el.tagName);
      }
    });
    return issues.slice(0, 5);
  });
  
  if (contrastIssues.length > 0) {
    issues.push({
      type: 'ACCESSIBILITY',
      severity: 'low',
      message: `Small text (< 12px) found in: ${[...new Set(contrastIssues)].join(', ')}`
    });
  }
  
  // Check for missing loading states
  const loadingIndicators = await page.$$eval('.loading, [aria-busy="true"], .skeleton', els => els.length);
  const hasData = await page.$$eval('[data-loaded], .has-data', els => els.length);
  
  if (loadingIndicators === 0 && hasData === 0) {
    // Might indicate missing data or loading state
    const contentArea = await page.$('#root, main, .content, .view-content');
    if (contentArea) {
      const text = await contentArea.textContent();
      if (text.trim().length < 50) {
        issues.push({
          type: 'POSSIBLE_LOADING_ISSUE',
          severity: 'medium',
          message: 'Content area appears empty - possible loading or data fetch issue'
        });
      }
    }
  }
  
  return issues;
}

async function runAudit() {
  console.log('🚀 Starting UI Audit...\n');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--window-size=1920,1080']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`❌ Console Error: ${msg.text()}`);
    }
  });
  
  page.on('pageerror', error => {
    console.log(`❌ Page Error: ${error.message}`);
    ISSUES_FOUND.push({
      view: 'GLOBAL',
      type: 'PAGE_ERROR',
      severity: 'critical',
      message: error.message
    });
  });
  
  // Navigate to app
  console.log('📍 Navigating to http://127.0.0.1:5177');
  await page.goto('http://127.0.0.1:5177', { 
    waitUntil: 'networkidle',
    timeout: 30000 
  });
  
  // Wait for initial render
  await page.waitForTimeout(3000);
  
  // Capture home page
  console.log('📸 Capturing Home view...');
  await page.screenshot({ 
    path: path.join(OUTPUT_DIR, '00-home.png'),
    fullPage: true 
  });
  
  // Check for initial issues
  const homeIssues = await checkForIssues(page, 'home', 'Home');
  homeIssues.forEach(issue => {
    ISSUES_FOUND.push({ view: 'Home', ...issue });
  });
  
  // Test each view by clicking rail items
  for (const view of VIEWS_TO_TEST) {
    console.log(`\n🔍 Testing: ${view.name} (${view.id})`);
    
    try {
      // Try to find and click the rail item
      const railItem = await page.$(`[data-rail-item="${view.id}"], button:has-text("${view.name}"), a:has-text("${view.name}")`);
      
      if (railItem) {
        await railItem.click();
        await page.waitForTimeout(2000);
        
        // Wait for view to load
        await page.waitForTimeout(1000);
        
        // Capture screenshot
        const screenshotPath = path.join(OUTPUT_DIR, `${view.id}.png`);
        await page.screenshot({ 
          path: screenshotPath,
          fullPage: true 
        });
        console.log(`  ✅ Screenshot saved: ${screenshotPath}`);
        
        // Check for issues
        const issues = await checkForIssues(page, view.id, view.name);
        issues.forEach(issue => {
          ISSUES_FOUND.push({ view: view.name, ...issue });
        });
        
        if (issues.length === 0) {
          console.log(`  ✅ No issues detected`);
        } else {
          console.log(`  ⚠️  ${issues.length} issue(s) found`);
          issues.forEach(issue => {
            console.log(`    - [${issue.severity}] ${issue.type}: ${issue.message.substring(0, 100)}`);
          });
        }
      } else {
        console.log(`  ⚠️  Rail item not found for ${view.name}`);
        ISSUES_FOUND.push({
          view: view.name,
          type: 'NAVIGATION',
          severity: 'medium',
          message: `Rail item not found: ${view.id}`
        });
      }
    } catch (error) {
      console.log(`  ❌ Error testing ${view.name}: ${error.message}`);
      ISSUES_FOUND.push({
        view: view.name,
        type: 'TEST_ERROR',
        severity: 'high',
        message: error.message
      });
    }
  }
  
  // Generate report
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 AUDIT SUMMARY');
  console.log('='.repeat(80));
  
  const criticalIssues = ISSUES_FOUND.filter(i => i.severity === 'critical');
  const highIssues = ISSUES_FOUND.filter(i => i.severity === 'high');
  const mediumIssues = ISSUES_FOUND.filter(i => i.severity === 'medium');
  const lowIssues = ISSUES_FOUND.filter(i => i.severity === 'low');
  
  console.log(`\nTotal Issues: ${ISSUES_FOUND.length}`);
  console.log(`  🔴 Critical: ${criticalIssues.length}`);
  console.log(`  🟠 High: ${highIssues.length}`);
  console.log(`  🟡 Medium: ${mediumIssues.length}`);
  console.log(`  🟢 Low: ${lowIssues.length}`);
  
  if (ISSUES_FOUND.length > 0) {
    console.log('\n📋 DETAILED ISSUES:\n');
    
    // Group by view
    const issuesByView = {};
    ISSUES_FOUND.forEach(issue => {
      if (!issuesByView[issue.view]) {
        issuesByView[issue.view] = [];
      }
      issuesByView[issue.view].push(issue);
    });
    
    for (const [viewName, issues] of Object.entries(issuesByView)) {
      console.log(`\n${viewName}:`);
      issues.forEach(issue => {
        const icon = issue.severity === 'critical' ? '🔴' :
                     issue.severity === 'high' ? '🟠' :
                     issue.severity === 'medium' ? '🟡' : '🟢';
        console.log(`  ${icon} [${issue.type}] ${issue.message.substring(0, 150)}`);
      });
    }
  }
  
  // Save report to file
  const reportPath = path.join(OUTPUT_DIR, 'audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalIssues: ISSUES_FOUND.length,
    issuesByView: (() => {
      const grouped = {};
      ISSUES_FOUND.forEach(issue => {
        if (!grouped[issue.view]) grouped[issue.view] = [];
        grouped[issue.view].push(issue);
      });
      return grouped;
    })(),
    summary: {
      critical: criticalIssues.length,
      high: highIssues.length,
      medium: mediumIssues.length,
      low: lowIssues.length
    }
  }, null, 2));
  
  console.log(`\n💾 Report saved to: ${reportPath}`);
  console.log(`📁 Screenshots saved to: ${OUTPUT_DIR}`);
  
  await browser.close();
  
  return ISSUES_FOUND;
}

// Run the audit
runAudit()
  .then(issues => {
    console.log('\n✅ Audit complete!');
    process.exit(issues.filter(i => i.severity === 'critical' || i.severity === 'high').length > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  });
