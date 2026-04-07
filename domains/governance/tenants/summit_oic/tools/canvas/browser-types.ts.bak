/**
 * Browser Automation Types for Summit Canvas Playbooks
 * 
 * Defines the interface for browser automation sessions.
 * Implementation can use browser-use, Playwright, or other backends.
 */

/**
 * Browser automation session interface
 * Abstracts the underlying browser automation implementation
 */
export interface BrowserAutomationSession {
  /**
   * Navigate to a URL
   */
  navigate(url: string): Promise<void>;
  
  /**
   * Wait for page to fully load
   */
  waitForPageLoad(timeout?: number): Promise<void>;
  
  /**
   * Wait for a specific timeout
   */
  waitForTimeout(ms: number): Promise<void>;
  
  /**
   * Get current page URL
   */
  getCurrentUrl(): Promise<string>;
  
  /**
   * Get current page title
   */
  getPageTitle(): Promise<string>;
  
  /**
   * Find an element using various strategies
   */
  findElement(locator: ElementLocator): Promise<BrowserElement | null>;
  
  /**
   * Find multiple elements
   */
  findElements(locator: ElementLocator): Promise<BrowserElement[]>;
  
  /**
   * Click an element
   */
  clickElement(element: BrowserElement): Promise<void>;
  
  /**
   * Type text into an element
   */
  typeText(element: BrowserElement, text: string): Promise<void>;
  
  /**
   * Select an option from a dropdown
   */
  selectOption(element: BrowserElement, value: string): Promise<void>;
  
  /**
   * Check if element is checked (for checkboxes/radios)
   */
  isElementChecked(element: BrowserElement): Promise<boolean>;
  
  /**
   * Get element text content
   */
  getElementText(element: BrowserElement): Promise<string>;
  
  /**
   * Get element attribute
   */
  getElementAttribute(element: BrowserElement, attr: string): Promise<string | null>;
  
  /**
   * Wait for element to appear
   */
  waitForElement(locator: ElementLocator, timeout?: number): Promise<BrowserElement | null>;
  
  /**
   * Wait for element to disappear
   */
  waitForElementGone(locator: ElementLocator, timeout?: number): Promise<void>;
  
  /**
   * Capture a screenshot
   */
  captureScreenshot(name?: string): Promise<string>;
  
  /**
   * Execute JavaScript in the page
   */
  executeScript(script: string): Promise<unknown>;
  
  /**
   * Close the session
   */
  close(): Promise<void>;
}

/**
 * Element locator strategies
 */
export interface ElementLocator {
  /**
   * CSS selector
   */
  selector?: string;
  
  /**
   * XPath selector
   */
  xpath?: string;
  
  /**
   * Text content to match (partial or exact)
   */
  text?: string;
  
  /**
   * Element role (for accessibility-based locating)
   */
  role?: string;
  
  /**
   * Element test ID (data-testid attribute)
   */
  testId?: string;
  
  /**
   * Match strategy for text
   */
  textMatch?: 'exact' | 'contains' | 'starts';
}

/**
 * Browser element reference
 */
export interface BrowserElement {
  /**
   * Element ID for subsequent operations
   */
  elementId: string;
  
  /**
   * Element tag name
   */
  tagName?: string;
  
  /**
   * Element text content
   */
  text?: string;
  
  /**
   * Element bounding box (for visual operations)
   */
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Browser automation skill interface
 * Used to create sessions via the A2R Operator
 */
export interface BrowserUseSkill {
  /**
   * Create a new browser automation session
   */
  createSession(options?: SessionOptions): Promise<BrowserAutomationSession>;
  
  /**
   * Check if browser automation is available
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * Get browser automation capabilities
   */
  getCapabilities(): Promise<BrowserCapabilities>;
}

/**
 * Session creation options
 */
export interface SessionOptions {
  /**
   * Browser type (chromium, firefox, webkit)
   */
  browserType?: 'chromium' | 'firefox' | 'webkit';
  
  /**
   * Headless mode
   */
  headless?: boolean;
  
  /**
   * Browser window size
   */
  viewport?: {
    width: number;
    height: number;
  };
  
  /**
   * User agent string
   */
  userAgent?: string;
  
  /**
   * Navigate to initial URL
   */
  initialUrl?: string;
  
  /**
   * Use CDP (Chrome DevTools Protocol) for embedded Chrome
   */
  useCDP?: boolean;
  
  /**
   * CDP endpoint URL
   */
  cdpEndpoint?: string;
}

/**
 * Browser automation capabilities
 */
export interface BrowserCapabilities {
  /**
   * browser-use library available
   */
  browserUse: boolean;
  
  /**
   * Playwright available
   */
  playwright: boolean;
  
  /**
   * CDP (Chrome DevTools Protocol) available
   */
  cdp: boolean;
  
  /**
   * Computer use (visual grounding) available
   */
  computerUse: boolean;
  
  /**
   * Vision-based element detection available
   */
  vision: boolean;
}

/**
 * Browser automation backend types
 */
export type BrowserBackend = 'browser-use' | 'playwright' | 'cdp' | 'computer-use';

/**
 * Browser session factory
 * Creates sessions using the best available backend
 */
export interface BrowserSessionFactory {
  /**
   * Create a session with the best available backend
   */
  createSession(options?: SessionOptions): Promise<BrowserAutomationSession>;
  
  /**
   * Get the preferred backend
   */
  getPreferredBackend(): Promise<BrowserBackend>;
  
  /**
   * Check backend availability
   */
  checkBackendAvailability(): Promise<Record<BrowserBackend, boolean>>;
}

/**
 * Error types for browser automation
 */
export class BrowserAutomationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'BrowserAutomationError';
  }
}

export class ElementNotFoundError extends BrowserAutomationError {
  constructor(locator: ElementLocator) {
    super(
      `Element not found: ${JSON.stringify(locator)}`,
      'ELEMENT_NOT_FOUND'
    );
  }
}

export class NavigationError extends BrowserAutomationError {
  constructor(
    url: string,
    message: string
  ) {
    super(
      `Navigation failed to ${url}: ${message}`,
      'NAVIGATION_ERROR'
    );
  }
}

export class TimeoutError extends BrowserAutomationError {
  constructor(
    operation: string,
    timeout: number
  ) {
    super(
      `Timeout after ${timeout}ms waiting for: ${operation}`,
      'TIMEOUT_ERROR'
    );
  }
}
