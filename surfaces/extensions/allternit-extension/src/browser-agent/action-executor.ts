/**
 * Action Executor
 * 
 * Executes browser actions in the content script context.
 * Handles element resolution, visual feedback, and action queuing.
 */

import type { BrowserAction, Target, ScrollDirection } from './browser-actions';

export interface ActionResult {
  success: boolean;
  message?: string;
  elementFound?: boolean;
  data?: unknown;
}

export interface ActionContext {
  tabId: number;
  frameId?: number;
  url: string;
}

/**
 * Execute a single browser action
 */
export async function executeAction(
  action: BrowserAction,
  context: ActionContext
): Promise<ActionResult> {
  try {
    switch (action.type) {
      case 'click':
        return executeClick(action.target, action.options);
      
      case 'type':
        return executeType(action.target, action.text, action.options);
      
      case 'clear':
        return executeClear(action.target);
      
      case 'scroll':
        return executeScroll(action.target, action.direction, action.amount, action.unit);
      
      case 'hover':
        return executeHover(action.target);
      
      case 'focus':
        return executeFocus(action.target);
      
      case 'press':
        return executePress(action.key, action.modifiers);
      
      case 'select':
        return executeSelect(action.target, action.value);
      
      default:
        return {
          success: false,
          message: `Unknown action type`,
        };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute multiple actions in sequence
 */
export async function executeActions(
  actions: BrowserAction[],
  context: ActionContext
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];
  
  for (let i = 0; i < actions.length; i++) {
    const result = await executeAction(actions[i], context);
    results.push(result);
    
    // Stop on failure unless force option is set
    if (!result.success && !(actions[i] as any).options?.force) {
      break;
    }
    
    // Small delay between actions
    if (i < actions.length - 1) {
      await delay(100);
    }
  }
  
  return results;
}

// ============================================================================
// Individual Action Executors
// ============================================================================

async function executeClick(
  target: Target,
  options?: { force?: boolean; delayMs?: number }
): Promise<ActionResult> {
  const element = await resolveElement(target, options?.force);
  
  if (!element) {
    return { success: false, elementFound: false, message: 'Element not found' };
  }
  
  // Visual feedback
  highlightElement(element, 'click');
  
  // Delay if specified
  if (options?.delayMs) {
    await delay(options.delayMs);
  }
  
  // Check if clickable
  if (!options?.force && !isClickable(element)) {
    return { success: false, message: 'Element is not clickable' };
  }
  
  // Perform click
  (element as HTMLElement).click();
  
  return { success: true, elementFound: true };
}

async function executeType(
  target: Target,
  text: string,
  options?: { clear?: boolean; submit?: boolean; delayMs?: number }
): Promise<ActionResult> {
  const element = await resolveElement(target);
  
  if (!element) {
    return { success: false, elementFound: false, message: 'Element not found' };
  }
  
  const input = element as HTMLInputElement | HTMLTextAreaElement;
  
  // Check if input element
  if (!isInputElement(input)) {
    return { success: false, message: 'Element is not an input field' };
  }
  
  // Visual feedback
  highlightElement(element, 'type');
  
  // Focus
  input.focus();
  
  // Clear if specified
  if (options?.clear !== false) {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  // Type text
  if (options?.delayMs && options.delayMs > 0) {
    // Type with delay between characters
    for (const char of text) {
      input.value += char;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await delay(options.delayMs);
    }
  } else {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  // Trigger change event
  input.dispatchEvent(new Event('change', { bubbles: true }));
  
  // Submit if specified
  if (options?.submit) {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
  }
  
  return { success: true, elementFound: true };
}

async function executeClear(target: Target): Promise<ActionResult> {
  const element = await resolveElement(target);
  
  if (!element) {
    return { success: false, elementFound: false, message: 'Element not found' };
  }
  
  const input = element as HTMLInputElement | HTMLTextAreaElement;
  
  if (!isInputElement(input)) {
    return { success: false, message: 'Element is not an input field' };
  }
  
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  
  return { success: true, elementFound: true };
}

async function executeScroll(
  target: Target | undefined,
  direction: ScrollDirection,
  amount: number,
  unit: 'pixels' | 'percentage' | 'lines' | 'pages'
): Promise<ActionResult> {
  const element = target ? await resolveElement(target) : document.scrollingElement;
  
  if (!element) {
    return { success: false, elementFound: false, message: 'Scroll target not found' };
  }
  
  const el = element as HTMLElement;
  
  // Calculate scroll amount
  let scrollAmount = amount;
  if (unit === 'percentage') {
    scrollAmount = (el.scrollHeight * amount) / 100;
  } else if (unit === 'pages') {
    scrollAmount = el.clientHeight * amount;
  } else if (unit === 'lines') {
    scrollAmount = amount * 20; // Approximate line height
  }
  
  // Perform scroll
  switch (direction) {
    case 'up':
      el.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
      break;
    case 'down':
      el.scrollBy({ top: scrollAmount, behavior: 'smooth' });
      break;
    case 'left':
      el.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      break;
    case 'right':
      el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      break;
    case 'toTop':
      el.scrollTo({ top: 0, behavior: 'smooth' });
      break;
    case 'toBottom':
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      break;
    default:
      return { success: false, message: 'Invalid scroll direction' };
  }
  
  return { success: true, elementFound: true };
}

async function executeHover(target: Target): Promise<ActionResult> {
  const element = await resolveElement(target);
  
  if (!element) {
    return { success: false, elementFound: false, message: 'Element not found' };
  }
  
  highlightElement(element, 'hover');
  
  const mouseOver = new MouseEvent('mouseover', { bubbles: true });
  const mouseEnter = new MouseEvent('mouseenter', { bubbles: true });
  
  element.dispatchEvent(mouseOver);
  element.dispatchEvent(mouseEnter);
  
  return { success: true, elementFound: true };
}

async function executeFocus(target: Target): Promise<ActionResult> {
  const element = await resolveElement(target);
  
  if (!element) {
    return { success: false, elementFound: false, message: 'Element not found' };
  }
  
  (element as HTMLElement).focus();
  
  return { success: true, elementFound: true };
}

async function executePress(
  key: string,
  modifiers?: Array<'Control' | 'Alt' | 'Shift' | 'Meta'>
): Promise<ActionResult> {
  const options: KeyboardEventInit = {
    key,
    bubbles: true,
    ctrlKey: modifiers?.includes('Control'),
    altKey: modifiers?.includes('Alt'),
    shiftKey: modifiers?.includes('Shift'),
    metaKey: modifiers?.includes('Meta'),
  };
  
  const keyDown = new KeyboardEvent('keydown', options);
  const keyUp = new KeyboardEvent('keyup', options);
  
  document.activeElement?.dispatchEvent(keyDown);
  await delay(50);
  document.activeElement?.dispatchEvent(keyUp);
  
  // Also dispatch keypress for legacy compatibility
  const keyPress = new KeyboardEvent('keypress', options);
  document.activeElement?.dispatchEvent(keyPress);
  
  return { success: true };
}

async function executeSelect(target: Target, value: string): Promise<ActionResult> {
  const element = await resolveElement(target);
  
  if (!element) {
    return { success: false, elementFound: false, message: 'Element not found' };
  }
  
  const select = element as HTMLSelectElement;
  
  if (select.tagName !== 'SELECT') {
    return { success: false, message: 'Element is not a select dropdown' };
  }
  
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  
  return { success: true, elementFound: true };
}

// ============================================================================
// Element Resolution
// ============================================================================

async function resolveElement(target: Target, force?: boolean): Promise<Element | null> {
  const timeout = 5000;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const element = findElement(target);
    if (element) {
      // Check visibility unless force is true
      if (force || isVisible(element)) {
        return element;
      }
    }
    
    // Wait a bit before retrying
    await delay(100);
  }
  
  return null;
}

function findElement(target: Target): Element | null {
  switch (target.type) {
    case 'selector':
      return document.querySelector(target.value);
    
    case 'text':
      return findByText(target.value, target.exact);
    
    case 'role':
      const roleSelector = target.name
        ? `[role="${target.role}"][aria-label*="${target.name}"]`
        : `[role="${target.role}"]`;
      return document.querySelector(roleSelector);
    
    case 'xpath':
      return findByXPath(target.value);
    
    case 'coordinates':
      return document.elementFromPoint(target.x, target.y);
    
    case 'index':
      const elements = document.querySelectorAll(target.selector);
      return elements[target.index] || null;
    
    default:
      return null;
  }
}

function findByText(text: string, exact = false): Element | null {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let node: Node | null;
  while (node = walker.nextNode()) {
    const nodeText = node.textContent || '';
    if (exact ? nodeText === text : nodeText.includes(text)) {
      return node.parentElement;
    }
  }
  
  return null;
}

function findByXPath(xpath: string): Element | null {
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue as Element | null;
  } catch {
    return null;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function isVisible(element: Element): boolean {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0' &&
         element.getBoundingClientRect().width > 0 &&
         element.getBoundingClientRect().height > 0;
}

function isClickable(element: Element): boolean {
  const style = window.getComputedStyle(element);
  return style.pointerEvents !== 'none';
}

function isInputElement(element: Element): element is HTMLInputElement | HTMLTextAreaElement {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
}

function highlightElement(element: Element, actionType: string): void {
  const colors: Record<string, string> = {
    click: '#4CAF50',
    type: '#2196F3',
    hover: '#FF9800',
    scroll: '#9C27B0',
  };
  
  const el = element as HTMLElement;
  const originalOutline = el.style.outline;
  const originalOutlineOffset = el.style.outlineOffset;
  
  el.style.outline = `3px solid ${colors[actionType] || '#666'}`;
  el.style.outlineOffset = '2px';
  el.style.transition = 'outline 0.2s';
  
  setTimeout(() => {
    el.style.outline = originalOutline;
    el.style.outlineOffset = originalOutlineOffset;
  }, 1000);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
