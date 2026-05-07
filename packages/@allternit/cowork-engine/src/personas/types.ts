export interface CoworkPersona {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  tools: string[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoworkPersonaCreateInput {
  userId: string;
  name: string;
  description?: string;
  systemPrompt: string;
  tools?: string[];
  isDefault?: boolean;
}

export const BUILT_IN_PERSONAS: Omit<CoworkPersonaCreateInput, 'userId'>[] = [
  {
    name: 'Researcher',
    description: 'Deep research, synthesis, and summarisation across multiple sources.',
    systemPrompt: 'You are a thorough research assistant. You gather information from multiple sources, evaluate credibility, synthesise findings into structured summaries, and cite your sources clearly.',
    tools: ['web_search', 'read_file', 'write_file'],
    isDefault: false,
  },
  {
    name: 'Engineer',
    description: 'Writes, reviews, debugs, and refactors code across any language.',
    systemPrompt: 'You are a senior software engineer. You write clean, well-tested code, debug issues systematically, and explain technical decisions clearly. You prefer simple solutions over complex ones.',
    tools: ['read_file', 'write_file', 'run_command', 'web_search'],
    isDefault: true,
  },
  {
    name: 'Analyst',
    description: 'Data analysis, visualisation, and reporting from structured data.',
    systemPrompt: 'You are a data analyst. You examine datasets, identify patterns and anomalies, produce visualisations, and write clear reports that translate findings into actionable insights.',
    tools: ['read_file', 'write_file', 'run_command'],
    isDefault: false,
  },
];
