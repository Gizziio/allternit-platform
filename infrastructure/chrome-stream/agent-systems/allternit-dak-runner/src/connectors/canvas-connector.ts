/**
 * Canvas API Connector - Production Implementation
 * 
 * Makes real HTTP calls to Canvas LMS API to create/read/update course objects.
 * 
 * Environment Variables:
 * - CANVAS_BASE_URL: https://yourdistrict.instructure.com
 * - CANVAS_API_TOKEN: Your Canvas API token
 * 
 * Golden Path: Create Module → Verify → Receipt
 */

import { EventEmitter } from 'events';

export interface CanvasConfig {
  baseUrl: string;
  apiToken: string;
}

export interface CanvasModule {
  id: number;
  name: string;
  position: number;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface CanvasPage {
  id: number;
  title: string;
  body: string;
  published: boolean;
  url: string;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description: string;
  points_possible: number;
  published: boolean;
  due_at?: string;
}

export interface CreateModuleRequest {
  courseId: string;
  name: string;
  published?: boolean;
}

export interface CreatePageRequest {
  courseId: string;
  title: string;
  body: string;
  published?: boolean;
}

export interface CreateAssignmentRequest {
  courseId: string;
  name: string;
  description: string;
  pointsPossible?: number;
  dueAt?: string;
  published?: boolean;
}

export interface CanvasExecutionResult {
  success: boolean;
  objectType: 'module' | 'page' | 'assignment';
  objectId: number;
  objectUrl: string;
  responseData: any;
  error?: string;
}

export class CanvasConnector extends EventEmitter {
  private config: CanvasConfig;

  constructor(config?: CanvasConfig) {
    super();
    this.config = config || {
      baseUrl: process.env.CANVAS_BASE_URL || '',
      apiToken: process.env.CANVAS_API_TOKEN || '',
    };
  }

  /**
   * Check if Canvas is configured
   */
  isConfigured(): boolean {
    return !!(this.config.baseUrl && this.config.apiToken);
  }

  /**
   * Get configuration status
   */
  getConfigStatus(): { configured: boolean; baseUrl?: string; hasToken: boolean } {
    return {
      configured: this.isConfigured(),
      baseUrl: this.config.baseUrl || undefined,
      hasToken: !!this.config.apiToken,
    };
  }

  /**
   * Make authenticated Canvas API request
   */
  private async canvasRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('Canvas not configured: missing CANVAS_BASE_URL or CANVAS_API_TOKEN');
    }

    const url = `${this.config.baseUrl}/api/v1${endpoint}`;
    
    this.emit('request:start', { url, method: options.method || 'GET' });

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      const error = new Error(`Canvas API Error (${response.status}): ${errorText}`);
      (error as any).status = response.status;
      this.emit('request:error', { url, status: response.status, error });
      throw error;
    }

    const data = await response.json();
    this.emit('request:success', { url, status: response.status });
    return data as T;
  }

  /**
   * Create a Canvas module
   * 
   * Golden Path: This is the primary execution action
   */
  async createModule(request: CreateModuleRequest): Promise<CanvasExecutionResult> {
    try {
      this.emit('action:start', { action: 'create_module', request });

      const moduleData = await this.canvasRequest<CanvasModule>(
        `/courses/${request.courseId}/modules`,
        {
          method: 'POST',
          body: JSON.stringify({
            module: {
              name: request.name,
              published: request.published ?? false,
            },
          }),
        }
      );

      const result: CanvasExecutionResult = {
        success: true,
        objectType: 'module',
        objectId: moduleData.id,
        objectUrl: `${this.config.baseUrl}/courses/${request.courseId}/modules/${moduleData.id}`,
        responseData: moduleData,
      };

      this.emit('action:complete', { action: 'create_module', result });
      return result;
    } catch (error: any) {
      const result: CanvasExecutionResult = {
        success: false,
        objectType: 'module',
        objectId: 0,
        objectUrl: '',
        responseData: null,
        error: error.message,
      };

      this.emit('action:error', { action: 'create_module', error, result });
      return result;
    }
  }

  /**
   * Verify a module exists
   */
  async verifyModule(courseId: string, moduleId: number): Promise<{ exists: boolean; module?: CanvasModule; error?: string }> {
    try {
      const module = await this.canvasRequest<CanvasModule>(`/courses/${courseId}/modules/${moduleId}`);
      return { exists: true, module };
    } catch (error: any) {
      if (error.status === 404) {
        return { exists: false };
      }
      return { exists: false, error: error.message };
    }
  }

  /**
   * List modules in a course
   */
  async listModules(courseId: string): Promise<CanvasModule[]> {
    return this.canvasRequest<CanvasModule[]>(`/courses/${courseId}/modules`);
  }

  /**
   * Create a Canvas page
   */
  async createPage(request: CreatePageRequest): Promise<CanvasExecutionResult> {
    try {
      this.emit('action:start', { action: 'create_page', request });

      const pageData = await this.canvasRequest<CanvasPage>(
        `/courses/${request.courseId}/pages`,
        {
          method: 'POST',
          body: JSON.stringify({
            wiki_page: {
              title: request.title,
              body: request.body,
              published: request.published ?? false,
            },
          }),
        }
      );

      const result: CanvasExecutionResult = {
        success: true,
        objectType: 'page',
        objectId: pageData.id,
        objectUrl: pageData.url,
        responseData: pageData,
      };

      this.emit('action:complete', { action: 'create_page', result });
      return result;
    } catch (error: any) {
      const result: CanvasExecutionResult = {
        success: false,
        objectType: 'page',
        objectId: 0,
        objectUrl: '',
        responseData: null,
        error: error.message,
      };

      this.emit('action:error', { action: 'create_page', error, result });
      return result;
    }
  }

  /**
   * Create a Canvas assignment
   */
  async createAssignment(request: CreateAssignmentRequest): Promise<CanvasExecutionResult> {
    try {
      this.emit('action:start', { action: 'create_assignment', request });

      const assignmentData = await this.canvasRequest<CanvasAssignment>(
        `/courses/${request.courseId}/assignments`,
        {
          method: 'POST',
          body: JSON.stringify({
            assignment: {
              name: request.name,
              description: request.description,
              points_possible: request.pointsPossible ?? 100,
              due_at: request.dueAt,
              published: request.published ?? false,
            },
          }),
        }
      );

      const result: CanvasExecutionResult = {
        success: true,
        objectType: 'assignment',
        objectId: assignmentData.id,
        objectUrl: `${this.config.baseUrl}/courses/${request.courseId}/assignments/${assignmentData.id}`,
        responseData: assignmentData,
      };

      this.emit('action:complete', { action: 'create_assignment', result });
      return result;
    } catch (error: any) {
      const result: CanvasExecutionResult = {
        success: false,
        objectType: 'assignment',
        objectId: 0,
        objectUrl: '',
        responseData: null,
        error: error.message,
      };

      this.emit('action:error', { action: 'create_assignment', error, result });
      return result;
    }
  }

  /**
   * Get course info
   */
  async getCourse(courseId: string): Promise<any> {
    return this.canvasRequest(`/courses/${courseId}`);
  }

  /**
   * Test Canvas connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string; courses?: any[] }> {
    try {
      const courses = await this.canvasRequest<any[]>('/courses');
      return { success: true, courses: courses.slice(0, 5) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

/**
 * Factory function to create Canvas connector
 */
export function createCanvasConnector(config?: CanvasConfig): CanvasConnector {
  return new CanvasConnector(config);
}
