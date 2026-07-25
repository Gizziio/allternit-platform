/**
 * Agent Preferences API Client
 *
 * GET/PUT /api/v1/agent-preferences — per-user response style preferences.
 * The PUT also syncs STYLE.md into agent workspaces server-side, and the
 * chat bridge composes the style for every chat — clients only need this
 * settings surface, sends require no changes.
 */

import { apiRequestWithError, runtimeApiUrl } from './api-config';

export type AgentResponseStyle = 'concise' | 'balanced' | 'detailed' | 'custom';

export interface AgentPreferences {
  response_style: AgentResponseStyle;
  custom_instructions: string;
  updated_at: string;
}

export const agentPreferencesApi = {
  /** GET /api/v1/agent-preferences */
  async get(): Promise<AgentPreferences> {
    return apiRequestWithError<AgentPreferences>(runtimeApiUrl('/agent-preferences'));
  },

  /** PUT /api/v1/agent-preferences */
  async update(input: {
    response_style: AgentResponseStyle;
    custom_instructions: string;
  }): Promise<AgentPreferences> {
    return apiRequestWithError<AgentPreferences>(runtimeApiUrl('/agent-preferences'), {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },
};
