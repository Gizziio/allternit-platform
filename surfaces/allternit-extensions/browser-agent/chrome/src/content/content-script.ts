/**
 * Content Script
 * 
 * Injected into web pages to execute browser actions.
 * Handles element resolution, action execution, and event reporting.
 */

import { Target, TargetSchema } from '../types/browser-actions';

// ============================================================================
// Element Resolution
// ============================================================================

function resolveElement(target: Target): Element | null {
  switch (target.type) {
    case 'selector':
      return document.querySelector(target.value);
      
    case 'text':
      const xpath = `//*[contains(text(), '${target.value}')]`;
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue as Element | null;
      
    case 'role':
      const roleSelector = target.name 
        ? `[role="${target.role}"][aria-label="${target.name}"]`
        : `[role="${target.role}"]`;
      return document.querySelector(roleSelector);
      
    case 'coordinates':
      return document.elementFromPoint(target.x, target.y);
      
    case 'xpath':
      const xpathResult = document.evaluate(target.value, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return xpathResult.singleNodeValue as Element | null;
      
    default:
      return null;
  }
}

// ============================================================================
// Action Execution
// ============================================================================

async function executeClick(target: Target): Promise<void> {
  const element = resolveElement(target);
  if (!element) throw new Error(`Element not found: ${JSON.stringify(target)}`);
  
  // Highlight element
  highlightElement(element);
  
  // Simulate click
  const rect = element.getBoundingClientRect();
  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  });
  
  element.dispatchEvent(clickEvent);
  
  // Report action
  reportAction('click', { target, coordinates: { x: rect.left, y: rect.top } });
}

async function executeType(target: Target, text: string): Promise<void> {
  const element = resolveElement(target) as HTMLElement | null;
  if (!element) throw new Error(`Element not found: ${JSON.stringify(target)}`);
  
  // Focus element
  element.focus();
  
  // Check if input, textarea, or contenteditable
  const isInput = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
  const isContentEditable = element.isContentEditable;
  
  if (!isInput && !isContentEditable) {
    throw new Error('Element is not editable');
  }
  
  // Type text
  if (isInput) {
    (element as HTMLInputElement).value = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    element.textContent = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  reportAction('type', { target, textLength: text.length });
}

async function executeScroll(direction: 'up' | 'down' | 'left' | 'right', amount: number): Promise<void> {
  const scrollX = direction === 'left' ? -amount : direction === 'right' ? amount : 0;
  const scrollY = direction === 'up' ? -amount : direction === 'down' ? amount : 0;
  
  window.scrollBy(scrollX, scrollY);
  
  reportAction('scroll', { direction, amount });
}

async function executeHover(target: Target): Promise<void> {
  const element = resolveElement(target);
  if (!element) throw new Error(`Element not found: ${JSON.stringify(target)}`);
  
  const mouseEvent = new MouseEvent('mouseover', {
    bubbles: true,
    cancelable: true,
  });
  
  element.dispatchEvent(mouseEvent);
}

// ============================================================================
// Element Highlighting
// ============================================================================

function highlightElement(element: Element): void {
  const originalOutline = (element as HTMLElement).style.outline;
  const originalBackground = (element as HTMLElement).style.backgroundColor;
  
  // Apply highlight
  (element as HTMLElement).style.outline = '2px solid #3b82f6';
  (element as HTMLElement).style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
  
  // Remove after 1 second
  setTimeout(() => {
    (element as HTMLElement).style.outline = originalOutline;
    (element as HTMLElement).style.backgroundColor = originalBackground;
  }, 1000);
}

// ============================================================================
// Action Reporting
// ============================================================================

function reportAction(actionType: string, data: unknown): void {
  chrome.runtime.sendMessage({
    type: 'action:executed',
    action: actionType,
    data,
    timestamp: Date.now(),
    url: window.location.href,
  });
}

// ============================================================================
// Message Handling
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'BROWSER.ACT':
          const { action, target, value, options } = message;
          
          switch (action) {
            case 'click':
              await executeClick(target);
              break;
            case 'type':
              await executeType(target, value || '');
              break;
            case 'scroll':
              await executeScroll(options?.direction || 'down', options?.amount || 300);
              break;
            case 'hover':
              await executeHover(target);
              break;
            default:
              throw new Error(`Unknown action: ${action}`);
          }
          
          sendResponse({ success: true });
          break;
          
        case 'BROWSER.WAIT':
          const { condition, timeout } = message;
          
          if (condition.type === 'time') {
            await new Promise(resolve => setTimeout(resolve, condition.ms));
          } else if (condition.type === 'element') {
            await waitForElement(condition.target, timeout);
          }
          
          sendResponse({ success: true });
          break;
          
        case 'ping':
          sendResponse({ pong: true });
          break;
          
        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      sendResponse({ error: (error as Error).message });
    }
  })();
  
  return true; // Keep channel open for async
});

async function waitForElement(target: Target, timeout: number): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (resolveElement(target)) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error(`Timeout waiting for element: ${JSON.stringify(target)}`);
}

// ============================================================================
// Event Listeners
// ============================================================================

// Report clicks to background
// document.addEventListener('click', (e) => {
//   chrome.runtime.sendMessage({
//     type: 'event:click',
//     coordinates: { x: e.clientX, y: e.clientY },
//     target: {
//       tagName: (e.target as Element).tagName,
//       id: (e.target as Element).id,
//       className: (e.target as Element).className,
//     },
//   });
// });

console.log('[A2R Extension] Content script loaded');
