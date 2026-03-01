# T4-A4: E2E Testing

## Agent Role
QA Engineer - Testing

## Task
Create comprehensive end-to-end tests using Playwright.

## Deliverables

### 1. Playwright Setup

```bash
# Install Playwright
cd 7-apps/shell
pnpm create playwright
# OR
pnpm add -D @playwright/test
npx playwright install
```

Create: `7-apps/shell/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5177',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'cd web && pnpm dev',
    url: 'http://localhost:5177',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 2. Test Utilities

Create: `7-apps/shell/e2e/utils/test-helpers.ts`

```typescript
import { Page, expect } from '@playwright/test';

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/');
}

export async function createNewChat(page: Page) {
  await page.click('[data-testid="new-chat-button"]');
  await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
}

export async function sendMessage(page: Page, message: string) {
  await page.fill('[data-testid="chat-input"] textarea', message);
  await page.click('[data-testid="send-button"]');
}

export async function waitForResponse(page: Page) {
  await page.waitForSelector('[data-testid="message-item"]', {
    state: 'visible',
    timeout: 30000,
  });
}

export async function openCommandPalette(page: Page) {
  await page.keyboard.press('Control+k');
  await expect(page.locator('[data-testid="command-palette"]')).toBeVisible();
}
```

### 3. Auth Tests

Create: `7-apps/shell/e2e/auth.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    await expect(page).toHaveURL('/');
    await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible();
  });
  
  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[data-testid="email-input"]', 'invalid@example.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');
  });
  
  test('should logout', async ({ page }) => {
    await login(page, 'test@example.com', 'password123');
    
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    
    await expect(page).toHaveURL('/login');
  });
});
```

### 4. Chat Tests

Create: `7-apps/shell/e2e/chat.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Chat', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'test@example.com', 'password123');
  });
  
  test('should create new chat', async ({ page }) => {
    await createNewChat(page);
    
    await expect(page.locator('[data-testid="chat-view"]')).toBeVisible();
    await expect(page.locator('[data-testid="message-list"]')).toBeVisible();
  });
  
  test('should send and receive message', async ({ page }) => {
    await createNewChat(page);
    
    await sendMessage(page, 'Hello, AI!');
    
    // Verify user message appears
    await expect(page.locator('[data-testid="message-item"]').first()).toContainText('Hello, AI!');
    
    // Wait for AI response
    await waitForResponse(page);
    
    // Verify AI response appears
    const messages = await page.locator('[data-testid="message-item"]').count();
    expect(messages).toBe(2);
  });
  
  test('should show code blocks with syntax highlighting', async ({ page }) => {
    await createNewChat(page);
    
    await sendMessage(page, 'Write a hello world in JavaScript');
    await waitForResponse(page);
    
    // Check for code block
    await expect(page.locator('[data-testid="code-block"]')).toBeVisible();
    await expect(page.locator('[data-testid="code-block"]')).toContainText('console.log');
  });
  
  test('should support file drag and drop', async ({ page }) => {
    await createNewChat(page);
    
    // Simulate file drop
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles('test-file.txt');
    
    await expect(page.locator('[data-testid="file-attachment"]')).toBeVisible();
  });
  
  test('should stop generation on button click', async ({ page }) => {
    await createNewChat(page);
    
    await sendMessage(page, 'Write a very long story');
    
    // Wait for streaming to start
    await page.waitForSelector('[data-testid="stop-button"]');
    
    // Click stop
    await page.click('[data-testid="stop-button"]');
    
    // Verify stop button is gone
    await expect(page.locator('[data-testid="stop-button"]')).not.toBeVisible();
  });
});
```

### 5. Workspace Tests

Create: `7-apps/shell/e2e/workspace.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Workspace', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'test@example.com', 'password123');
  });
  
  test('should toggle sidebar', async ({ page }) => {
    // Sidebar should be visible by default
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    
    // Toggle off
    await page.click('[data-testid="sidebar-toggle"]');
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible();
    
    // Toggle on
    await page.click('[data-testid="sidebar-toggle"]');
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
  });
  
  test('should resize panels', async ({ page }) => {
    const panel = page.locator('[data-testid="left-panel"]');
    const handle = page.locator('[data-testid="panel-resize-handle"]').first();
    
    const initialBox = await panel.boundingBox();
    
    // Drag resize handle
    await handle.dragTo(handle, {
      targetPosition: { x: 200, y: 0 },
    });
    
    const newBox = await panel.boundingBox();
    expect(newBox?.width).toBeGreaterThan(initialBox?.width || 0);
  });
  
  test('should switch views', async ({ page }) => {
    // Open agents view
    await page.click('[data-testid="nav-agents"]');
    await expect(page).toHaveURL('/agents');
    await expect(page.locator('[data-testid="agents-view"]')).toBeVisible();
    
    // Open workflows view
    await page.click('[data-testid="nav-workflows"]');
    await expect(page).toHaveURL('/workflows');
    await expect(page.locator('[data-testid="workflows-view"]')).toBeVisible();
  });
});
```

### 6. Settings Tests

Create: `7-apps/shell/e2e/settings.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'test@example.com', 'password123');
    await page.goto('/settings');
  });
  
  test('should change theme', async ({ page }) => {
    await page.click('[data-testid="theme-dark"]');
    
    // Verify dark mode is applied
    const body = page.locator('body');
    await expect(body).toHaveClass(/dark/);
  });
  
  test('should update profile', async ({ page }) => {
    await page.fill('[data-testid="display-name-input"]', 'New Name');
    await page.click('[data-testid="save-profile-button"]');
    
    await expect(page.locator('[data-testid="success-toast"]')).toBeVisible();
  });
});
```

### 7. Keyboard Navigation Tests

Create: `7-apps/shell/e2e/accessibility.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'test@example.com', 'password123');
  });
  
  test('should navigate with Tab key', async ({ page }) => {
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveAttribute('data-testid', 'sidebar-toggle');
    
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveAttribute('data-testid', 'new-chat-button');
  });
  
  test('should open command palette with keyboard shortcut', async ({ page }) => {
    await page.keyboard.press('Control+k');
    
    await expect(page.locator('[data-testid="command-palette"]')).toBeVisible();
    
    // Type to search
    await page.keyboard.type('settings');
    await expect(page.locator('[data-testid="command-item"]')).toContainText('Settings');
    
    // Press enter to select
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/settings');
  });
  
  test('should close modal with Escape', async ({ page }) => {
    await page.click('[data-testid="user-menu"]');
    await expect(page.locator('[data-testid="user-dropdown"]')).toBeVisible();
    
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="user-dropdown"]')).not.toBeVisible();
  });
});
```

### 8. Test Data & Fixtures

Create: `7-apps/shell/e2e/fixtures/user.ts`

```typescript
export const testUser = {
  email: 'test@example.com',
  password: 'password123',
  displayName: 'Test User',
};

export const testAgents = [
  { id: '1', name: 'Code Assistant', description: 'Helps with coding' },
  { id: '2', name: 'Documentation Writer', description: 'Writes docs' },
];

export const testWorkflows = [
  { id: '1', name: 'API Integration', status: 'active' },
  { id: '2', name: 'Data Pipeline', status: 'inactive' },
];
```

### 9. CI Integration

Add to GitHub Actions:

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: pnpm install
      - run: pnpm exec playwright install --with-deps
      - run: pnpm exec playwright test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

## Success Criteria
- [ ] Playwright configured
- [ ] Test utilities created
- [ ] Auth tests
- [ ] Chat tests
- [ ] Workspace tests
- [ ] Settings tests
- [ ] Keyboard navigation tests
- [ ] CI integration
- [ ] All tests passing
- [ ] No SYSTEM_LAW violations
