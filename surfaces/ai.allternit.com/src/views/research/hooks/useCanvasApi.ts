/**
 * Canvas LMS API Client
 * Fetches course content (modules, assignments, pages, files) from Canvas.
 */

const CANVAS_BASE = 'https://canvas.instructure.com/api/v1';

export interface CanvasModule {
  id: number;
  name: string;
  position: number;
  unlock_at: string | null;
  require_sequential_progress: boolean;
  publish_final_grade: boolean;
  prerequisite_module_ids: number[];
  state: string;
}

export interface CanvasModuleItem {
  id: number;
  title: string;
  position: number;
  indent: number;
  type: string;
  module_id: number;
  html_url: string;
  url: string;
  page_url?: string;
  external_url?: string;
  new_tab: boolean;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description: string;
  due_at: string | null;
  points_possible: number;
  html_url: string;
  submission_types: string[];
}

export interface CanvasPage {
  page_id: number;
  title: string;
  body: string;
  html_url: string;
}

export interface CanvasFile {
  id: number;
  display_name: string;
  url: string;
  size: number;
  content_type: string;
}

export interface CanvasCourseContent {
  course: { id: number; name: string; course_code: string };
  modules: Array<{ module: CanvasModule; items: CanvasModuleItem[] }>;
  assignments: CanvasAssignment[];
  pages: CanvasPage[];
  files: CanvasFile[];
}

class CanvasAPI {
  private token: string;
  private baseUrl: string;

  constructor(token: string, baseUrl: string = CANVAS_BASE) {
    this.token = token;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async fetch<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}${path.includes('?') ? '&' : '?'}per_page=100`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json+canvas-string-ids',
      },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Canvas API error ${res.status}: ${err}`);
    }
    return res.json() as Promise<T>;
  }

  async getCourse(courseId: string) {
    return this.fetch<{ id: number; name: string; course_code: string }>(`/courses/${courseId}`);
  }

  async getModules(courseId: string): Promise<CanvasModule[]> {
    return this.fetch<CanvasModule[]>(`/courses/${courseId}/modules`);
  }

  async getModuleItems(courseId: string, moduleId: number): Promise<CanvasModuleItem[]> {
    return this.fetch<CanvasModuleItem[]>(`/courses/${courseId}/modules/${moduleId}/items`);
  }

  async getAssignments(courseId: string): Promise<CanvasAssignment[]> {
    return this.fetch<CanvasAssignment[]>(`/courses/${courseId}/assignments`);
  }

  async getPages(courseId: string): Promise<CanvasPage[]> {
    return this.fetch<CanvasPage[]>(`/courses/${courseId}/pages`);
  }

  async getPageBody(courseId: string, pageUrl: string): Promise<string> {
    const page = await this.fetch<CanvasPage>(`/courses/${courseId}/pages/${pageUrl}`);
    return page.body || '';
  }

  async getFiles(courseId: string): Promise<CanvasFile[]> {
    return this.fetch<CanvasFile[]>(`/courses/${courseId}/files`);
  }

  async fetchAllCourseContent(courseId: string): Promise<CanvasCourseContent> {
    const course = await this.getCourse(courseId);
    const modules = await this.getModules(courseId);
    const modulesWithItems = await Promise.all(
      modules.map(async (m) => ({
        module: m,
        items: await this.getModuleItems(courseId, m.id),
      }))
    );
    const assignments = await this.getAssignments(courseId);
    const pages = await this.getPages(courseId);
    const files = await this.getFiles(courseId);

    return { course, modules: modulesWithItems, assignments, pages, files };
  }
}

export { CanvasAPI };
