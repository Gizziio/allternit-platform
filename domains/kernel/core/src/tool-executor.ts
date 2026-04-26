import { ExecutionEngine, ExecutionOptions } from './execution-engine.js';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

export interface ToolRequest {
  tool: string;
  arguments: any;
  context?: {
    cwd?: string;
    env?: Record<string, string>;
    sessionId?: string;
    tenantId?: string;
    secrets?: Record<string, string>;
  };
}

export interface ToolResponse {
  success: boolean;
  output: string;
  error?: string;
  metadata?: any;
}

// --- Tenant Tool Dispatch ---

interface TenantToolContext {
  fs: { read: (path: string) => Promise<string> };
  secrets: { get: (key: string) => Promise<string> };
  runtime: { execPython: (script: string) => Promise<string> };
}

function buildTenantContext(context?: ToolRequest['context']): TenantToolContext {
  const tenantRoot = resolve(process.cwd(), 'tenants', context?.tenantId || 'summit_oic');
  return {
    fs: {
      read: async (path: string) => {
        const fullPath = path.startsWith('/') ? path : resolve(process.cwd(), path);
        return (await readFile(fullPath, 'utf-8'));
      }
    },
    secrets: {
      get: async (key: string) => {
        // Check env first, then secrets file
        const envKey = key.toUpperCase().replace(/[^A-Z0-9]/g, '_');
        if (process.env[envKey]) return process.env[envKey]!;
        if (process.env.CANVAS_API_TOKEN) return process.env.CANVAS_API_TOKEN;
        throw new Error(`Secret not found: ${key}. Set ${envKey} or CANVAS_API_TOKEN in environment.`);
      }
    },
    runtime: {
      execPython: async (script: string) => {
        const { execSync } = await import('child_process');
        return execSync(`python3 -c ${JSON.stringify(script)}`, { encoding: 'utf-8' });
      }
    }
  };
}

const ACU_GATEWAY_URL = process.env.ACU_GATEWAY_URL ?? 'http://127.0.0.1:8760';

export class ToolExecutor {
  private engine: ExecutionEngine;

  constructor(engine: ExecutionEngine) {
    this.engine = engine;
  }

  async execute(request: ToolRequest): Promise<ToolResponse> {
    const { tool, arguments: args, context } = request;

    // Canvas tools
    if (tool.startsWith('canvas.')) {
      return this.executeCanvasTool(tool, args, context);
    }
    // Office tools
    if (tool.startsWith('office.')) {
      return this.executeOfficeTool(tool, args, context);
    }

    switch (tool) {
      case 'shell':
      case 'bash':
        return this.executeShell(args.command, context);
      case 'ls':
        return this.executeShell('ls ' + (args.path || '.'), context);
      case 'computer':
        return this.executeComputerTool(args, context);
      default:
        return {
          success: false,
          output: '',
          error: 'Unknown tool: ' + tool
        };
    }
  }

  private async executeCanvasTool(tool: string, args: any, context?: any): Promise<ToolResponse> {
    try {
      const ctx = buildTenantContext(context);
      const config = JSON.parse(await ctx.fs.read('tenants/summit_oic/tenant.json'));
      const token = await ctx.secrets.get('canvas_api_token_ref');
      const baseUrl = process.env.CANVAS_BASE_URL || config.canvas.base_url;

      const toolName = tool.replace('canvas.', '');
      const { path, method, body } = this.buildCanvasRequest(toolName, args);

      const response = await fetch(`${baseUrl}/api/v1${path}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      });

      if (!response.ok) {
        const errText = await response.text();
        return { success: false, output: '', error: `Canvas API ${response.status}: ${errText}` };
      }

      const data = await response.json();
      return { success: true, output: JSON.stringify(data), metadata: data };
    } catch (e: any) {
      return { success: false, output: '', error: e.message };
    }
  }

  private buildCanvasRequest(toolName: string, args: any): { path: string, method: string, body?: any } {
    switch (toolName) {
      case 'create_module':
        return { path: `/courses/${args.course_id}/modules`, method: 'POST', body: { module: { name: args.name, published: args.published ?? false } } };
      case 'create_page':
        return { path: `/courses/${args.course_id}/pages`, method: 'POST', body: { wiki_page: { title: args.title, body: args.body, published: args.published ?? false } } };
      case 'add_module_item':
        return { path: `/courses/${args.course_id}/modules/${args.module_id}/items`, method: 'POST', body: { module_item: { title: args.title, type: args.type, content_id: args.content_id } } };
      case 'create_assignment':
        return { path: `/courses/${args.course_id}/assignments`, method: 'POST', body: { assignment: { name: args.name, description: args.description, points_possible: args.points_possible, grading_type: args.grading_type || 'points', submission_types: args.submission_types || ['online_text_entry'], published: args.published ?? false } } };
      case 'publish_module':
        return { path: `/courses/${args.course_id}/modules/${args.module_id}`, method: 'PUT', body: { module: { published: true } } };
      case 'list_courses':
        return { path: '/courses', method: 'GET' };
      case 'list_modules':
        return { path: `/courses/${args.course_id}/modules`, method: 'GET' };
      case 'search_course':
        return { path: `/search/all_courses?search=${encodeURIComponent(args.query)}`, method: 'GET' };
      case 'upload_file':
        return { path: `/courses/${args.course_id}/files`, method: 'POST', body: { name: args.name, parent_folder_path: args.parent_folder_path } };
      default:
        throw new Error(`Unknown canvas tool: ${toolName}`);
    }
  }

  private async executeOfficeTool(tool: string, args: any, context?: any): Promise<ToolResponse> {
    try {
      const ctx = buildTenantContext(context);
      const toolName = tool.replace('office.', '');

      if (toolName === 'xlsx_read') {
        const script = `
import json
from openpyxl import load_workbook
wb = load_workbook('${args.path}')
sheet_name = '${args.sheet}' if '${args.sheet}' else wb.sheetnames[0]
ws = wb[sheet_name]
rows = []
headers = [cell.value for cell in ws[1]]
for row in ws.iter_rows(min_row=2, values_only=True):
    rows.append(dict(zip(headers, [str(v) if v is not None else '' for v in row])))
print(json.dumps(rows))
`;
        const result = await ctx.runtime.execPython(script);
        return { success: true, output: result.trim(), metadata: JSON.parse(result.trim()) };
      }

      if (toolName === 'xlsx_write') {
        const script = `
from openpyxl import load_workbook
import hashlib, json
wb = load_workbook('${args.path}')
for edit in ${JSON.stringify(args.edits)}:
    ws = wb[edit['sheet']]
    ws[edit['cell']] = edit['value']
wb.save('${args.output_path}')
with open('${args.path}','rb') as f: oh = hashlib.sha256(f.read()).hexdigest()
with open('${args.output_path}','rb') as f: nh = hashlib.sha256(f.read()).hexdigest()
print(json.dumps({"original_hash": oh, "new_hash": nh, "patches": ${args.edits.length}}))
`;
        const result = await ctx.runtime.execPython(script);
        const data = JSON.parse(result.trim());
        return { success: true, output: result.trim(), metadata: data };
      }

      if (toolName === 'docx_read') {
        const script = `
import json
from docx import Document
doc = Document('${args.path}')
paragraphs = [p.text for p in doc.paragraphs]
print(json.dumps(paragraphs))
`;
        const result = await ctx.runtime.execPython(script);
        return { success: true, output: result.trim(), metadata: JSON.parse(result.trim()) };
      }

      if (toolName === 'docx_write') {
        const script = `
from docx import Document
import hashlib, json
doc = Document('${args.path}')
for patch in ${JSON.stringify(args.patches)}:
    if patch['op'] == 'append':
        doc.add_paragraph(patch['value'])
doc.save('${args.output_path}')
with open('${args.path}','rb') as f: oh = hashlib.sha256(f.read()).hexdigest()
with open('${args.output_path}','rb') as f: nh = hashlib.sha256(f.read()).hexdigest()
print(json.dumps({"original_hash": oh, "new_hash": nh}))
`;
        const result = await ctx.runtime.execPython(script);
        return { success: true, output: result.trim(), metadata: JSON.parse(result.trim()) };
      }

      return { success: false, output: '', error: `Unknown office tool: ${toolName}` };
    } catch (e: any) {
      return { success: false, output: '', error: e.message };
    }
  }

  private async executeComputerTool(args: any, context?: any): Promise<ToolResponse> {
    try {
      const body: Record<string, any> = {
        action: args.action,
        session_id: args.session_id ?? context?.sessionId ?? `sess-${Date.now()}`,
        run_id: args.run_id ?? `ku-${Math.random().toString(36).slice(2, 14)}`,
        parameters: {},
      };
      if (args.coordinate != null) body.coordinate = args.coordinate;
      if (args.text != null) body.text = args.text;
      if (args.key != null) body.key = args.key;
      if (args.delta != null) body.delta = args.delta;
      if (args.url != null) body.url = args.url;
      if (args.selector != null) body.selector = args.selector;
      if (args.ms != null) body.parameters = { ms: args.ms };
      if (args.adapter_preference != null) body.adapter_preference = args.adapter_preference;

      const res = await fetch(`${ACU_GATEWAY_URL}/v1/computer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        return { success: false, output: '', error: `ACU gateway ${res.status}: ${text}` };
      }

      const data = await res.json() as Record<string, any>;
      const ok = data.status === 'completed';
      return {
        success: ok,
        output: JSON.stringify(data.extracted_content ?? {}),
        error: ok ? undefined : (data.error?.message ?? data.status),
        metadata: data,
      };
    } catch (e: any) {
      return { success: false, output: '', error: `ACU unreachable: ${e.message}` };
    }
  }

  private async executeShell(command: string, context?: any): Promise<ToolResponse> {
    const options: ExecutionOptions = {
      cwd: context?.cwd,
      env: context?.env,
    };

    const result = await this.engine.run('bash', ['-c', command], options);

    return {
      success: result.exitCode === 0,
      output: result.stdout,
      error: result.stderr,
      metadata: {
        exitCode: result.exitCode,
        signal: result.signal,
        killed: result.killed
      }
    };
  }

}
