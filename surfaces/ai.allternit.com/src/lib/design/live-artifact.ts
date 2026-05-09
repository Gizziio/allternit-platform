export interface LiveArtifact {
  id: string;
  name: string;
  templateHtml: string;
  dataJson: string;
  refreshIntervalMs?: number;
  lastRefreshedAt?: string;
  createdAt: string;
}

export function renderLiveArtifact(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
    const keys = path.split('.');
    let val: any = data;
    for (const k of keys) { val = val?.[k]; }
    return val !== undefined ? String(val) : '';
  });
}

export function parseLiveArtifactData(jsonStr: string): Record<string, any> {
  try { return JSON.parse(jsonStr); } catch { return {}; }
}
