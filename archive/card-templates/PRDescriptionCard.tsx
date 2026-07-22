/**
 * PR Description Template
 * Generates pull request descriptions
 */

export interface PRDescriptionParams {
  changes: string[];
  ticket?: string;
  type: 'feature' | 'bugfix' | 'refactor';
}

export async function prDescription(params: PRDescriptionParams) {
  const { changes, ticket, type = 'feature' } = params;
  return {
    title: `[${type.toUpperCase()}] Description`,
    body: `## Changes\n${changes.map(c => `- ${c}`).join('\n')}`,
    ticket
  };
}

export default prDescription;
