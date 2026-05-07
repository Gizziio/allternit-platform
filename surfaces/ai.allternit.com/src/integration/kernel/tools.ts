import { api } from '../api-client.js';

interface Tool {
  id: string;
  name: string;
  description?: string;
}

export async function listTools(): Promise<Tool[]> {
  const result = await api.listTools();
  return result.tools as Tool[];
}
