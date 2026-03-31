/**
 * Action Tools
 * 
 * Perform actions on web page elements:
 * - Click
 * - Type
 * - Select
 * - Scroll
 * - Hover
 * - Press keys
 */

import type { Page, Locator } from 'playwright';
import type {
  ActionRequest,
  ActionResult,
  ActionOptions,
  ToolResult,
} from '../types/index.js';
import { sessionRegistry } from '../playwright/driver.js';
import { checkActionSafety, approvalQueue } from '../safety/quarantine.js';

// ============================================================================
// Click Action
// ============================================================================

export interface ClickParams {
  selector: string;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  delay?: number;
  modifiers?: ('alt' | 'ctrl' | 'meta' | 'shift')[];
  waitForNavigation?: boolean;
  timeout?: number;
}

export async function click(
  sessionId: string,
  params: ClickParams
): Promise<ToolResult<ActionResult>> {
  const startTime = Date.now();
  
  try {
    const active = sessionRegistry.get(sessionId);
    if (!active) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Check safety
    const policy = active.session.id ? 
      undefined : // Get from quarantine manager
      undefined;
    
    if (policy) {
      const safety = checkActionSafety('click', params.selector, policy);
      if (!safety.allowed) {
        throw new Error(`Action blocked: ${safety.reason}`);
      }
    }

    const { page } = active;
    const locator = page.locator(params.selector).first();

    // Check element exists and is visible
    const count = await locator.count();
    if (count === 0) {
      throw new Error(`Element not found: ${params.selector}`);
    }

    const isVisible = await locator.isVisible().catch(() => false);
    if (!isVisible) {
      throw new Error(`Element not visible: ${params.selector}`);
    }

    // Build click options
    const clickOptions: any = {
      button: params.button || 'left',
      clickCount: params.clickCount || 1,
      delay: params.delay,
      modifiers: params.modifiers,
      timeout: params.timeout || 30000,
    };

    // Perform click
    if (params.waitForNavigation) {
      await Promise.all([
        page.waitForLoadState('networkidle'),
        locator.click(clickOptions),
      ]);
    } else {
      await locator.click(clickOptions);
    }

    sessionRegistry.updateLastActivity(sessionId);

    return {
      success: true,
      data: {
        success: true,
        action: 'click',
        selector: params.selector,
        newUrl: page.url(),
        duration: Date.now() - startTime,
      },
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        sessionId,
      },
    };
  } catch (error) {
    return {
      success: false,
      data: {
        success: false,
        action: 'click',
        selector: params.selector,
        error: {
          code: 'CLICK_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: true,
        },
        duration: Date.now() - startTime,
      },
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        sessionId,
      },
    };
  }
}

// ============================================================================
// Type Action
// ============================================================================

export interface TypeParams {
  selector: string;
  text: string;
  clearFirst?: boolean;
  delay?: number;
  timeout?: number;
}

export async function type(
  sessionId: string,
  params: TypeParams
): Promise<ToolResult<ActionResult>> {
  const startTime = Date.now();
  
  try {
    const active = sessionRegistry.get(sessionId);
    if (!active) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const { page } = active;
    const locator = page.locator(params.selector).first();

    // Clear first if requested
    if (params.clearFirst) {
      await locator.fill('', { timeout: params.timeout || 30000 });
    }

    // Type text
    await locator.fill(params.text, {
      timeout: params.timeout || 30000,
    });

    sessionRegistry.updateLastActivity(sessionId);

    return {
      success: true,
      data: {
        success: true,
        action: 'type',
        selector: params.selector,
        duration: Date.now() - startTime,
      },
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        sessionId,
      },
    };
  } catch (error) {
    return {
      success: false,
      data: {
        success: false,
        action: 'type',
        selector: params.selector,
        error: {
          code: 'TYPE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: true,
        },
        duration: Date.now() - startTime,
      },
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        sessionId,
      },
    };
  }
}

// ============================================================================
// Clear Action
// ============================================================================

export interface ClearParams {
  selector: string;
  timeout?: number;
}

export async function clear(
  sessionId: string,
  params: ClearParams
): Promise<ToolResult<ActionResult>> {
  const startTime = Date.now();
  
  try {
    const active = sessionRegistry.get(sessionId);
    if (!active) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const { page } = active;
    const locator = page.locator(params.selector).first();

    await locator.fill('', { timeout: params.timeout || 30000 });
    sessionRegistry.updateLastActivity(sessionId);

    return {
      success: true,
      data: {
        success: true,
        action: 'clear',
        selector: params.selector,
        duration: Date.now() - startTime,
      },
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        sessionId,
      },
    };
  } catch (error) {
    return {
      success: false,
      data: {
        success: false,
        action: 'clear',
        selector: params.selector,
        error: {
          code: 'CLEAR_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: true,
        },
        duration: Date.now() - startTime,
      },
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        sessionId,
      },
    };
  }
}

// ============================================================================
// Select Action
// ============================================================================

export interface SelectParams {
  selector: string;
  value?: string;
  label?: string;
  index?: number;
  timeout?: number;
}

export async function select(
  sessionId: string,
  params: SelectParams
): Promise<ToolResult<ActionResult>> {
  const startTime = Date.now();
  
  try {
    const active = sessionRegistry.get(sessionId);
    if (!active) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const { page } = active;
    const locator = page.locator(params.selector).first();

    if (params.value !== undefined) {
      await locator.selectOption({ value: params.value }, { timeout: params.timeout || 30000 });
    } else if (params.label !== undefined) {
      await locator.selectOption({ label: params.label }, { timeout: params.timeout || 30000 });
    } else if (params.index !== undefined) {
      await locator.selectOption({ index: params.index }, { timeout: params.timeout || 30000 });
    } else {
      throw new Error('No selection criteria provided (value, label, or index)');
    }

    sessionRegistry.updateLastActivity(sessionId);

    return {
      success: true,
      data: {
        success: true,
        action: 'select',
        selector: params.selector,
        duration: Date.now() - startTime,
      },
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        sessionId,
      },
    };
  } catch (error) {
    return {
      success: false,
      data: {
        success: false,
        action: 'select',
        selector: params.selector,
        error: {
          code: 'SELECT_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: true,
        },
        duration: Date.now() - startTime,
      },
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        sessionId,
      },
    };
  }
}

// ============================================================================
// Scroll Action
// ============================================================================

export interface ScrollParams {
  x?: number;
  y?: number;
  selector?: string;
  behavior?: 'smooth' | 'auto';
  timeout?: number;
}

export async function scroll(
  sessionId: string,
  params: ScrollParams
): Promise<ToolResult<ActionResult>> {
  const startTime = Date.now();
  
  try {
    const active = sessionRegistry.get(sessionId);
    if (!active) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const { page } = active;

    if (params.selector) {
      // Scroll element into view
      const locator = page.locator(params.selector).first();
      await locator.scrollIntoViewIfNeeded({ timeout: params.timeout || 30000 });
    } else if (params.x !== undefined || params.y !== undefined) {
      // Scroll to coordinates
      await page.evaluate(
        ({ x, y, behavior }) => {
          window.scrollTo({
            left: x || 0,
            top: y || 0,
            behavior: behavior || 'auto',
          });
        },
        { x: params.x, y: params.y, behavior: params.behavior }
      );
    } else {
      throw new Error('No scroll target provided (selector or x/y coordinates)');
    }

    sessionRegistry.updateLastActivity(sessionId);

    return {
      success: true,
      data: {
        success: true,
        action: 'scroll',
        selector: params.selector,
        duration: Date.now() - startTime,
      },
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        sessionId,
      },
    };
  } catch (error) {
    return {
      success: false,
      data: {
        success: false,
        action: 'scroll',
        selector: params.selector,
        error: {
          code: 'SCROLL_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: true,
        },
        duration: Date.now() - startTime,
      },
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        sessionId,
      },
    };
  }
}

// ============================================================================
// Hover Action
// ============================================================================

export interface HoverParams {
  selector: string;
  timeout?: number;
}

export async function hover(
  sessionId: string,
  params: HoverParams
): Promise<ToolResult<ActionResult>> {
  const startTime = Date.now();
  
  try {
    const active = sessionRegistry.get(sessionId);
    if (!active) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const { page } = active;
    const locator = page.locator(params.selector).first();

    await locator.hover({ timeout: params.timeout || 30000 });
    sessionRegistry.updateLastActivity(sessionId);

    return {
      success: true,
      data: {
        success: true,
        action: 'hover',
        selector: params.selector,
        duration: Date.now() - startTime,
      },
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        sessionId,
      },
    };
  } catch (error) {
    return {
      success: false,
      data: {
        success: false,
        action: 'hover',
        selector: params.selector,
        error: {
          code: 'HOVER_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: true,
        },
        duration: Date.now() - startTime,
      },
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        sessionId,
      },
    };
  }
}

// ============================================================================
// Press Action (Keyboard)
// ============================================================================

export interface PressParams {
  selector?: string;
  key: string;
  modifiers?: ('alt' | 'ctrl' | 'meta' | 'shift')[];
  timeout?: number;
}

export async function press(
  sessionId: string,
  params: PressParams
): Promise<ToolResult<ActionResult>> {
  const startTime = Date.now();
  
  try {
    const active = sessionRegistry.get(sessionId);
    if (!active) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const { page } = active;
    
    const keyCombo = [
      ...(params.modifiers || []),
      params.key,
    ].join('+');

    if (params.selector) {
      // Press key on specific element
      const locator = page.locator(params.selector).first();
      await locator.press(keyCombo, { timeout: params.timeout || 30000 });
    } else {
      // Press key globally
      await page.keyboard.press(keyCombo);
    }

    sessionRegistry.updateLastActivity(sessionId);

    return {
      success: true,
      data: {
        success: true,
        action: 'press',
        selector: params.selector,
        duration: Date.now() - startTime,
      },
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        sessionId,
      },
    };
  } catch (error) {
    return {
      success: false,
      data: {
        success: false,
        action: 'press',
        selector: params.selector,
        error: {
          code: 'PRESS_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: true,
        },
        duration: Date.now() - startTime,
      },
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        sessionId,
      },
    };
  }
}

// ============================================================================
// Wait Action
// ============================================================================

export interface WaitParams {
  selector?: string;
  timeout?: number;
  state?: 'visible' | 'hidden' | 'attached' | 'detached';
  time?: number; // Just wait for N milliseconds
}

export async function wait(
  sessionId: string,
  params: WaitParams
): Promise<ToolResult<ActionResult>> {
  const startTime = Date.now();
  
  try {
    const active = sessionRegistry.get(sessionId);
    if (!active) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const { page } = active;

    if (params.time) {
      // Simple time-based wait
      await page.waitForTimeout(params.time);
    } else if (params.selector) {
      // Wait for element state
      const locator = page.locator(params.selector).first();
      const state = params.state || 'visible';
      
      switch (state) {
        case 'visible':
          await locator.waitFor({ state: 'visible', timeout: params.timeout || 30000 });
          break;
        case 'hidden':
          await locator.waitFor({ state: 'hidden', timeout: params.timeout || 30000 });
          break;
        case 'attached':
          await locator.waitFor({ state: 'attached', timeout: params.timeout || 30000 });
          break;
        case 'detached':
          await locator.waitFor({ state: 'detached', timeout: params.timeout || 30000 });
          break;
      }
    } else {
      throw new Error('No wait criteria provided (selector or time)');
    }

    sessionRegistry.updateLastActivity(sessionId);

    return {
      success: true,
      data: {
        success: true,
        action: 'wait',
        selector: params.selector,
        duration: Date.now() - startTime,
      },
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        sessionId,
      },
    };
  } catch (error) {
    return {
      success: false,
      data: {
        success: false,
        action: 'wait',
        selector: params.selector,
        error: {
          code: 'WAIT_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: true,
        },
        duration: Date.now() - startTime,
      },
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        sessionId,
      },
    };
  }
}

// ============================================================================
// Tool Registry
// ============================================================================

export const actionTools = {
  'browser.click': click,
  'browser.type': type,
  'browser.clear': clear,
  'browser.select': select,
  'browser.scroll': scroll,
  'browser.hover': hover,
  'browser.press': press,
  'browser.wait': wait,
};

export default actionTools;
