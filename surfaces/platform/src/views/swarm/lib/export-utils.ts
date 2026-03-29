/**
 * Export Utilities
 * 
 * Handles exporting swarm data in various formats (CSV, JSON, Markdown).
 * Includes download functionality for browser environments.
 */

import type { SwarmAgent, SwarmMetrics, MetricsDataPoint } from '../types';

export type ExportFormat = 'csv' | 'json' | 'markdown';

interface ExportOptions {
  filename?: string;
  includeTimestamp?: boolean;
}

/**
 * Export agents to CSV format
 */
export function exportAgentsToCSV(agents: SwarmAgent[]): string {
  const headers = [
    'ID',
    'Name',
    'Role',
    'Status',
    'Model',
    'Tasks Active',
    'Tokens Used',
    'Cost Accumulated',
    'Avg Latency (ms)',
    'Uptime',
    'Capabilities',
  ];

  const rows = agents.map(agent => [
    agent.id,
    agent.name,
    agent.role,
    agent.status,
    agent.model,
    agent.tasksActive,
    agent.tokensUsed,
    agent.costAccumulated.toFixed(4),
    agent.avgLatency,
    agent.uptime,
    agent.capabilities.join('; '),
  ]);

  return [headers.join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
}

/**
 * Export agents to JSON format
 */
export function exportAgentsToJSON(agents: SwarmAgent[]): string {
  return JSON.stringify({
    exportDate: new Date().toISOString(),
    count: agents.length,
    agents,
  }, null, 2);
}

/**
 * Export agents to Markdown format
 */
export function exportAgentsToMarkdown(agents: SwarmAgent[]): string {
  const sections = agents.map(agent => `
## ${agent.name}

| Property | Value |
|----------|-------|
| ID | \`${agent.id}\` |
| Role | ${agent.role} |
| Status | ${agent.status} |
| Model | ${agent.model} |
| Tasks Active | ${agent.tasksActive} |
| Tokens Used | ${agent.tokensUsed.toLocaleString()} |
| Cost | $${agent.costAccumulated.toFixed(4)} |
| Avg Latency | ${agent.avgLatency}ms |
| Uptime | ${agent.uptime} |
| Capabilities | ${agent.capabilities.join(', ')} |

${agent.description || ''}

### Active Tasks

${agent.currentTasks.length > 0 
  ? agent.currentTasks.map(t => `- **${t.name}** (${t.progress}%) - ${t.status}`).join('\n')
  : '_No active tasks_'}
`);

  return `# Swarm Agents Report

Generated: ${new Date().toLocaleString()}
Total Agents: ${agents.length}

${sections.join('\n---\n')}
`;
}

/**
 * Export metrics history to CSV
 */
export function exportMetricsToCSV(data: MetricsDataPoint[]): string {
  const headers = ['Timestamp', 'Active Agents', 'Total Tokens', 'Total Cost', 'Throughput (t/s)', 'Avg Latency (ms)'];
  
  const rows = data.map(d => [
    d.timestamp,
    d.activeAgents,
    d.totalTokens,
    d.totalCost.toFixed(4),
    d.throughput.toFixed(2),
    d.avgLatency.toFixed(0),
  ]);

  return [headers.join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
}

/**
 * Export metrics history to JSON
 */
export function exportMetricsToJSON(data: MetricsDataPoint[]): string {
  return JSON.stringify({
    exportDate: new Date().toISOString(),
    dataPoints: data.length,
    data,
  }, null, 2);
}

/**
 * Export current metrics snapshot
 */
export function exportMetricsSnapshot(metrics: SwarmMetrics): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    metrics,
  }, null, 2);
}

/**
 * Download data as a file
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Export and download agents
 */
export function exportAndDownloadAgents(
  agents: SwarmAgent[],
  format: ExportFormat,
  options: ExportOptions = {}
): void {
  const { filename, includeTimestamp = true } = options;
  
  const timestamp = includeTimestamp ? `-${new Date().toISOString().split('T')[0]}` : '';
  const baseName = filename || 'swarm-agents';
  
  let content: string;
  let extension: string;
  let mimeType: string;

  switch (format) {
    case 'csv':
      content = exportAgentsToCSV(agents);
      extension = 'csv';
      mimeType = 'text/csv;charset=utf-8;';
      break;
    case 'json':
      content = exportAgentsToJSON(agents);
      extension = 'json';
      mimeType = 'application/json';
      break;
    case 'markdown':
      content = exportAgentsToMarkdown(agents);
      extension = 'md';
      mimeType = 'text/markdown';
      break;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  downloadFile(content, `${baseName}${timestamp}.${extension}`, mimeType);
}

/**
 * Export and download metrics history
 */
export function exportAndDownloadMetrics(
  data: MetricsDataPoint[],
  format: 'csv' | 'json',
  options: ExportOptions = {}
): void {
  const { filename, includeTimestamp = true } = options;
  
  const timestamp = includeTimestamp ? `-${new Date().toISOString().split('T')[0]}` : '';
  const baseName = filename || 'swarm-metrics';
  
  let content: string;
  let extension: string;
  let mimeType: string;

  switch (format) {
    case 'csv':
      content = exportMetricsToCSV(data);
      extension = 'csv';
      mimeType = 'text/csv;charset=utf-8;';
      break;
    case 'json':
      content = exportMetricsToJSON(data);
      extension = 'json';
      mimeType = 'application/json';
      break;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  downloadFile(content, `${baseName}${timestamp}.${extension}`, mimeType);
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

// Helper function to escape CSV values
function escapeCSV(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
