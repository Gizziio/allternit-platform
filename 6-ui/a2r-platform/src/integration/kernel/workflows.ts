import { getKernelBridge } from './index.js';
import { execFacade } from '../execution/exec.facade.js';

export interface WorkflowStep {
  tool: string;
  params: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
}

export const PREDEFINED_WORKFLOWS: Workflow[] = [
  {
    id: 'repo-audit',
    name: 'Repo Audit + Report',
    description: 'Scans the codebase and generates a structural audit report.',
    steps: [
      { tool: 'list_files', params: { recursive: true } },
      { tool: 'read_file', params: { path: 'package.json' } },
      { tool: 'analyze_codebase', params: { depth: 'full' } }
    ]
  },
  {
    id: 'doc-ingest',
    name: 'Doc Ingest + Summarize',
    description: 'Reads documentation files and creates a concise summary.',
    steps: [
      { tool: 'read_file', params: { path: 'docs/' } },
      { tool: 'summarize_text', params: { length: 'short' } }
    ]
  },
  {
    id: 'ui-task-plan',
    name: 'UI Task Plan + DAG',
    description: 'Converts a UI requirement into a technical task DAG.',
    steps: [
      { tool: 'analyze_ui_spec', params: {} },
      { tool: 'generate_dag', params: { format: 'mermaid' } }
    ]
  }
];

export async function runWorkflow(workflowId: string) {
  const workflow = PREDEFINED_WORKFLOWS.find(w => w.id === workflowId);
  if (!workflow) throw new Error('Workflow not found');

  // Start a run via the facade to trigger the bridge
  const runId = await execFacade.startRun({
    agentId: 'workflow-orchestrator',
    input: 'Executing Workflow: ' + workflow.name
  });

  return runId;
}
