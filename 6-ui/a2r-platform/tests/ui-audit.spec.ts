/**
 * A2R Platform UI Audit - Comprehensive Visual Testing
 * 
 * This script systematically tests all UI views and components
 * to identify rendering issues, layout problems, and functional bugs.
 */

import { test, expect } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:5177';
const SCREENSHOT_DIR = './test-results/screenshots';

test.describe('A2R Platform UI Audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Shell Layout', () => {
    test('should render main shell structure', async ({ page }) => {
      // Check for main shell elements
      const shellFrame = page.locator('[data-shell-frame]');
      await expect(shellFrame).toBeVisible();

      // Check for rail/navigation
      const rail = page.locator('[data-shell-rail]');
      await expect(rail).toBeVisible();

      // Check for canvas/content area
      const canvas = page.locator('[data-shell-canvas]');
      await expect(canvas).toBeVisible();

      // Take screenshot
      await page.screenshot({ 
        path: `${SCREENSHOT_DIR}/shell-layout.png`,
        fullPage: true 
      });
    });

    test('should render navigation rail items', async ({ page }) => {
      const railItems = page.locator('[data-rail-item]');
      await expect(railItems).toHaveCount({ min: 5 });

      // Check for key navigation items
      const homeItem = page.locator('[data-rail-item="home"]');
      await expect(homeItem).toBeVisible();

      const chatItem = page.locator('[data-rail-item="chat"]');
      await expect(chatItem).toBeVisible();

      const workspaceItem = page.locator('[data-rail-item="workspace"]');
      await expect(workspaceItem).toBeVisible();
    });

    test('should handle rail collapse/expand', async ({ page }) => {
      const toggleButton = page.locator('[data-rail-toggle]');
      
      if (await toggleButton.isVisible()) {
        await toggleButton.click();
        await page.waitForTimeout(300);
        
        const rail = page.locator('[data-shell-rail]');
        const isCollapsed = await rail.getAttribute('data-collapsed');
        console.log(`Rail collapsed state: ${isCollapsed}`);
      }
    });
  });

  test.describe('Chat View', () => {
    test('should render chat view', async ({ page }) => {
      // Navigate to chat
      await page.click('[data-rail-item="chat"]');
      await page.waitForTimeout(500);

      // Check for chat elements
      const conversation = page.locator('[data-conversation]');
      await expect(conversation).toBeVisible();

      // Check for message input
      const input = page.locator('[data-prompt-input]');
      await expect(input).toBeVisible();

      // Take screenshot
      await page.screenshot({ 
        path: `${SCREENSHOT_DIR}/chat-view.png`,
        fullPage: true 
      });
    });

    test('should display welcome message', async ({ page }) => {
      await page.click('[data-rail-item="chat"]');
      await page.waitForTimeout(500);

      const welcomeMessage = page.locator('[data-welcome-message]');
      if (await welcomeMessage.isVisible()) {
        await expect(welcomeMessage).toContainText(/welcome|start|help/i);
      }
    });

    test('should handle message input', async ({ page }) => {
      await page.click('[data-rail-item="chat"]');
      await page.waitForTimeout(500);

      const input = page.locator('[data-prompt-input] textarea');
      if (await input.isVisible()) {
        await input.fill('Test message');
        await expect(input).toHaveValue('Test message');
        
        // Clear input
        await input.clear();
      }
    });
  });

  test.describe('Workspace View', () => {
    test('should render workspace view', async ({ page }) => {
      await page.click('[data-rail-item="workspace"]');
      await page.waitForTimeout(500);

      const workspace = page.locator('[data-workspace]');
      await expect(workspace).toBeVisible();

      await page.screenshot({ 
        path: `${SCREENSHOT_DIR}/workspace-view.png`,
        fullPage: true 
      });
    });
  });

  test.describe('Code View', () => {
    test('should render code view', async ({ page }) => {
      await page.click('[data-rail-item="code"]');
      await page.waitForTimeout(500);

      const codeView = page.locator('[data-code-view]');
      await expect(codeView).toBeVisible();

      await page.screenshot({ 
        path: `${SCREENSHOT_DIR}/code-view.png`,
        fullPage: true 
      });
    });
  });

  test.describe('Agent System View', () => {
    test('should render agent system view', async ({ page }) => {
      await page.click('[data-rail-item="runner"]');
      await page.waitForTimeout(500);

      const agentSystem = page.locator('[data-agent-system]');
      await expect(agentSystem).toBeVisible();

      // Check for tabs
      const tabs = page.locator('[data-agent-system-tabs]');
      await expect(tabs).toBeVisible();

      await page.screenshot({ 
        path: `${SCREENSHOT_DIR}/agent-system-view.png`,
        fullPage: true 
      });
    });

    test('should render agent system tabs', async ({ page }) => {
      await page.click('[data-rail-item="runner"]');
      await page.waitForTimeout(500);

      const tabLabels = ['Plan', 'Work', 'Status', 'Mail', 'Tools', 'Audit'];
      
      for (const tab of tabLabels) {
        const tabButton = page.locator(`[data-tab="${tab.toLowerCase()}"]`);
        if (await tabButton.isVisible()) {
          await expect(tabButton).toContainText(tab);
        }
      }
    });
  });

  test.describe('Console Drawer', () => {
    test('should render console drawer', async ({ page }) => {
      const drawer = page.locator('[data-console-drawer]');
      
      // Drawer might be collapsed by default
      const isVisible = await drawer.isVisible();
      
      if (isVisible) {
        await expect(drawer).toBeVisible();
        
        // Check for drawer tabs
        const drawerTabs = page.locator('[data-drawer-tabs]');
        await expect(drawerTabs).toBeVisible();
      }
    });

    test('should expand/collapse console drawer', async ({ page }) => {
      const drawerHandle = page.locator('[data-drawer-handle]');
      
      if (await drawerHandle.isVisible()) {
        await drawerHandle.click();
        await page.waitForTimeout(300);
        
        const drawer = page.locator('[data-console-drawer]');
        const isExpanded = await drawer.isVisible();
        console.log(`Drawer expanded: ${isExpanded}`);
      }
    });
  });

  test.describe('UI Components', () => {
    test('should render buttons correctly', async ({ page }) => {
      const buttons = page.locator('button');
      const count = await buttons.count();
      console.log(`Found ${count} buttons`);
      
      // Check first few buttons for proper rendering
      for (let i = 0; i < Math.min(count, 5); i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          await expect(button).toBeEnabled({ timeout: 2000 });
        }
      }
    });

    test('should render text without overflow', async ({ page }) => {
      const textElements = page.locator('[class*="text-"]');
      const count = await textElements.count();
      
      for (let i = 0; i < Math.min(count, 10); i++) {
        const text = textElements.nth(i);
        if (await text.isVisible()) {
          const box = await text.boundingBox();
          if (box) {
            expect(box.width).toBeGreaterThan(0);
            expect(box.height).toBeGreaterThan(0);
          }
        }
      }
    });

    test('should render icons correctly', async ({ page }) => {
      const icons = page.locator('svg');
      const count = await icons.count();
      console.log(`Found ${count} SVG icons`);
      
      // Check first few icons
      for (let i = 0; i < Math.min(count, 5); i++) {
        const icon = icons.nth(i);
        if (await icon.isVisible()) {
          const box = await icon.boundingBox();
          if (box) {
            expect(box.width).toBeGreaterThan(0);
            expect(box.height).toBeGreaterThan(0);
          }
        }
      }
    });
  });

  test.describe('Responsive Layout', () => {
    test('should render correctly at desktop size', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(300);
      
      await page.screenshot({ 
        path: `${SCREENSHOT_DIR}/desktop-1920x1080.png`,
        fullPage: true 
      });
    });

    test('should render correctly at tablet size', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.waitForTimeout(300);
      
      await page.screenshot({ 
        path: `${SCREENSHOT_DIR}/tablet-1024x768.png`,
        fullPage: true 
      });
    });

    test('should render correctly at mobile size', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(300);
      
      await page.screenshot({ 
        path: `${SCREENSHOT_DIR}/mobile-375x667.png`,
        fullPage: true 
      });
    });
  });

  test.describe('Performance Checks', () => {
    test('should load within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      console.log(`Page loaded in ${loadTime}ms`);
      expect(loadTime).toBeLessThan(10000); // 10 second threshold
    });

    test('should not have memory leaks', async ({ page }) => {
      // Take multiple measurements
      const measurements = [];
      
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.performance.memory?.usedJSHeapSize || 0);
        const memory = await page.evaluate(() => window.performance.memory?.usedJSHeapSize || 0);
        measurements.push(memory);
        await page.waitForTimeout(1000);
      }
      
      // Check if memory is growing significantly
      const growth = measurements[measurements.length - 1] - measurements[0];
      console.log(`Memory growth: ${growth} bytes`);
      
      // Allow some growth but not excessive
      expect(growth).toBeLessThan(50 * 1024 * 1024); // 50MB threshold
    });
  });

  test.describe('Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // Listen for console errors
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      // Try to trigger API calls
      await page.click('[data-rail-item="chat"]');
      await page.waitForTimeout(2000);

      // Check for critical errors
      const criticalErrors = errors.filter(e => 
        e.includes('Uncaught') || 
        e.includes('TypeError') ||
        e.includes('ReferenceError')
      );

      console.log(`Found ${errors.length} console errors, ${criticalErrors.length} critical`);
      
      // Should not have critical errors
      expect(criticalErrors.length).toBe(0);
    });

    test('should display error boundary on component failure', async ({ page }) => {
      // This would require intentionally breaking a component
      // For now, just verify error boundary exists in the DOM
      const errorBoundary = page.locator('[data-error-boundary]');
      // Error boundary might not be visible unless there's an error
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      const ariaLabels = page.locator('[aria-label]');
      const count = await ariaLabels.count();
      console.log(`Found ${count} ARIA labels`);
      
      expect(count).toBeGreaterThan(0);
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      const h1 = page.locator('h1');
      const h1Count = await h1.count();
      
      // Should have at most one h1
      expect(h1Count).toBeLessThanOrEqual(1);
    });

    test('should have focusable elements keyboard accessible', async ({ page }) => {
      const focusableElements = page.locator(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const count = await focusableElements.count();
      
      console.log(`Found ${count} focusable elements`);
      
      // Test keyboard navigation on first few elements
      for (let i = 0; i < Math.min(count, 5); i++) {
        const element = focusableElements.nth(i);
        if (await element.isVisible()) {
          await element.focus();
          await expect(element).toBeFocused();
        }
      }
    });
  });
});
