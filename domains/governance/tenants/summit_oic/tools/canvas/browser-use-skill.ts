/**
 * Allternit Operator Browser Use Skill Implementation
 * 
 * Connects to the Allternit Operator service (port 3000) for browser automation.
 * This implementation uses the Operator's browser-use endpoints.
 * 
 * Architecture:
 * - BrowserUseSkill creates BrowserAutomationSession instances
 * - Sessions communicate with Allternit Operator via HTTP
 * - Operator handles actual browser control via browser-use/CDP
 */

import {
  BrowserAutomationSession,
  BrowserUseSkill,
  BrowserCapabilities,
  SessionOptions,
  BrowserElement,
  ElementLocator,
  BrowserBackend,
  BrowserSessionFactory,
  ElementNotFoundError,
  NavigationError,
  TimeoutError,
} from './browser-types';

const Allternit_OPERATOR_URL = process.env.Allternit_OPERATOR_URL || 'http://127.0.0.1:3000';

/**
 * Allternit Operator Browser Session
 * Implements browser automation via the Operator service
 */
class AllternitOperatorSession implements BrowserAutomationSession {
  private sessionId?: string;
  private baseUrl: string;

  constructor(baseUrl: string = Allternit_OPERATOR_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Initialize the session
   */
  async initialize(options?: SessionOptions): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/browser/session/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          browser_type: options?.browserType || 'chromium',
          headless: options?.headless ?? false,
          viewport: options?.viewport,
          use_cdp: options?.useCDP,
          cdp_endpoint: options?.cdpEndpoint,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`);
      }

      const data = await response.json();
      this.sessionId = data.session_id;
    } catch (error: any) {
      throw new NavigationError('session initialization', error.message);
    }
  }

  async navigate(url: string): Promise<void> {
    await this.postAction('navigate', { url });
  }

  async waitForPageLoad(timeout: number = 10000): Promise<void> {
    await this.postAction('wait_for_load', { timeout });
  }

  async waitForTimeout(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  async getCurrentUrl(): Promise<string> {
    const result = await this.postAction('get_url', {});
    return result.url as string;
  }

  async getPageTitle(): Promise<string> {
    const result = await this.postAction('get_title', {});
    return result.title as string;
  }

  async findElement(locator: ElementLocator): Promise<BrowserElement | null> {
    try {
      const result = await this.postAction('find_element', {
        locator: this.convertLocator(locator),
      });
      
      if (!result.element) {
        return null;
      }
      
      return result.element as BrowserElement;
    } catch (error: any) {
      if (error.code === 'ELEMENT_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async findElements(locator: ElementLocator): Promise<BrowserElement[]> {
    const result = await this.postAction('find_elements', {
      locator: this.convertLocator(locator),
    });
    return (result.elements as BrowserElement[]) || [];
  }

  async clickElement(element: BrowserElement): Promise<void> {
    await this.postAction('click', {
      element_id: element.elementId,
    });
  }

  async typeText(element: BrowserElement, text: string): Promise<void> {
    await this.postAction('type', {
      element_id: element.elementId,
      text,
    });
  }

  async selectOption(element: BrowserElement, value: string): Promise<void> {
    await this.postAction('select', {
      element_id: element.elementId,
      value,
    });
  }

  async isElementChecked(element: BrowserElement): Promise<boolean> {
    const result = await this.postAction('is_checked', {
      element_id: element.elementId,
    });
    return result.checked as boolean;
  }

  async getElementText(element: BrowserElement): Promise<string> {
    const result = await this.postAction('get_text', {
      element_id: element.elementId,
    });
    return result.text as string;
  }

  async getElementAttribute(element: BrowserElement, attr: string): Promise<string | null> {
    const result = await this.postAction('get_attribute', {
      element_id: element.elementId,
      attribute: attr,
    });
    return result.value as string | null;
  }

  async waitForElement(locator: ElementLocator, timeout: number = 10000): Promise<BrowserElement | null> {
    try {
      const result = await this.postAction('wait_for_element', {
        locator: this.convertLocator(locator),
        timeout,
      });
      return result.element as BrowserElement | null;
    } catch (error: any) {
      if (error.code === 'TIMEOUT_ERROR') {
        return null;
      }
      throw error;
    }
  }

  async waitForElementGone(locator: ElementLocator, timeout: number = 10000): Promise<void> {
    await this.postAction('wait_for_element_gone', {
      locator: this.convertLocator(locator),
      timeout,
    });
  }

  async captureScreenshot(name?: string): Promise<string> {
    const result = await this.postAction('screenshot', {
      name: name || `screenshot_${Date.now()}`,
    });
    return result.screenshot_path as string;
  }

  async executeScript(script: string): Promise<unknown> {
    const result = await this.postAction('execute_script', {
      script,
    });
    return result.result;
  }

  async close(): Promise<void> {
    if (this.sessionId) {
      try {
        await fetch(`${this.baseUrl}/v1/browser/session/${this.sessionId}/close`, {
          method: 'POST',
        });
      } catch {
        // Ignore close errors
      }
      this.sessionId = undefined;
    }
  }

  /**
   * Post an action to the Operator service
   */
  private async postAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.sessionId) {
      throw new Error('Session not initialized');
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/browser/session/${this.sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          params,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 404 && errorData.code === 'ELEMENT_NOT_FOUND') {
          throw new ElementNotFoundError(params.locator as ElementLocator);
        }
        
        throw new Error(`Action failed: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      return data.result || {};
    } catch (error: any) {
      if (error instanceof ElementNotFoundError || error instanceof TimeoutError) {
        throw error;
      }
      throw new Error(`Browser action "${action}" failed: ${error.message}`);
    }
  }

  /**
   * Convert locator to Operator format
   */
  private convertLocator(locator: ElementLocator): Record<string, unknown> {
    const converted: Record<string, unknown> = {};
    
    if (locator.selector) converted.css = locator.selector;
    if (locator.xpath) converted.xpath = locator.xpath;
    if (locator.text) {
      converted.text = locator.text;
      converted.text_match = locator.textMatch || 'contains';
    }
    if (locator.role) converted.role = locator.role;
    if (locator.testId) converted.test_id = locator.testId;
    
    return converted;
  }
}

/**
 * Allternit Operator Browser Use Skill
 * Factory for creating browser automation sessions
 */
export class AllternitOperatorBrowserSkill implements BrowserUseSkill {
  private baseUrl: string;
  private capabilities?: BrowserCapabilities;

  constructor(baseUrl: string = Allternit_OPERATOR_URL) {
    this.baseUrl = baseUrl;
  }

  async createSession(options?: SessionOptions): Promise<BrowserAutomationSession> {
    const session = new AllternitOperatorSession(this.baseUrl);
    await session.initialize(options);
    return session;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/browser/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getCapabilities(): Promise<BrowserCapabilities> {
    if (this.capabilities) {
      return this.capabilities;
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/browser/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Health check failed');
      }

      const data = await response.json();
      this.capabilities = {
        browserUse: data.available || false,
        playwright: data.playwright_available || false,
        cdp: data.cdp_available || false,
        computerUse: data.browser_use_available || false,
        vision: data.vision_available || false,
      };
    } catch {
      this.capabilities = {
        browserUse: false,
        playwright: false,
        cdp: false,
        computerUse: false,
        vision: false,
      };
    }

    return this.capabilities;
  }
}

/**
 * Allternit Operator Browser Session Factory
 * Creates sessions using the best available backend
 */
export class AllternitOperatorSessionFactory implements BrowserSessionFactory {
  private skill: AllternitOperatorBrowserSkill;

  constructor(baseUrl: string = Allternit_OPERATOR_URL) {
    this.skill = new AllternitOperatorBrowserSkill(baseUrl);
  }

  async createSession(options?: SessionOptions): Promise<BrowserAutomationSession> {
    return this.skill.createSession(options);
  }

  async getPreferredBackend(): Promise<BrowserBackend> {
    const capabilities = await this.skill.getCapabilities();
    
    if (capabilities.computerUse) return 'computer-use';
    if (capabilities.browserUse) return 'browser-use';
    if (capabilities.cdp) return 'cdp';
    if (capabilities.playwright) return 'playwright';
    
    throw new Error('No browser backend available');
  }

  async checkBackendAvailability(): Promise<Record<BrowserBackend, boolean>> {
    const capabilities = await this.skill.getCapabilities();
    
    return {
      'browser-use': capabilities.browserUse,
      playwright: capabilities.playwright,
      cdp: capabilities.cdp,
      'computer-use': capabilities.computerUse,
    };
  }
}

/**
 * Factory function to create browser skill
 */
export function createBrowserUseSkill(baseUrl?: string): BrowserUseSkill {
  return new AllternitOperatorBrowserSkill(baseUrl);
}

/**
 * Factory function to create session factory
 */
export function createBrowserSessionFactory(baseUrl?: string): BrowserSessionFactory {
  return new AllternitOperatorSessionFactory(baseUrl);
}
