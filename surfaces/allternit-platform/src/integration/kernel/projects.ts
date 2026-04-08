import { api } from '../api-client';

// Projects are managed through the API, not direct kernel access
// This file is deprecated - use api-client directly instead

export async function createProject(title: string) {
  // Create a workflow to represent the project
  const workflow = await api.createWorkflow({
    name: title,
    description: 'Project workspace',
    definition: { type: 'project', title },
    version: '1.0.0',
  });
  return { id: workflow.id, title };
}

export async function listProjects() {
  const { workflows } = await api.listWorkflows();
  return workflows.map(w => ({ id: w.id, title: w.name }));
}
