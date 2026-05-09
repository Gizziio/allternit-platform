export interface OrbitDigestConfig {
  projectName: string;
  sources: ('github' | 'linear' | 'notion' | 'gmail')[];
  scheduleCron?: string;
}

export interface OrbitDigestResult {
  generatedAt: string;
  html: string;
  summary: string;
  sources: string[];
}

export async function generateOrbitDigest(
  config: OrbitDigestConfig,
  sessionSendMessage: (text: string) => Promise<void>,
): Promise<void> {
  const prompt = buildOrbitPrompt(config);
  await sessionSendMessage(prompt);
}

function buildOrbitPrompt(config: OrbitDigestConfig): string {
  return `[ORBIT DIGEST REQUEST]
Generate a daily design briefing for project: "${config.projectName}".
Sources to synthesize: ${config.sources.join(', ')}.

The briefing should be a complete HTML artifact with:
- A header with today's date and project name
- A "What shipped" section (recent GitHub commits/PRs if connected)
- A "In progress" section (Linear/Notion items)
- A "Design decisions" section (key choices made today)
- A "Focus for today" section with 3 prioritized next actions

Use the active design system's palette. Make it scannable and dense — this is a morning briefing, not a report. Output as a single artifact block.

Include an EDITMODE config block with at least: primary color, accent color, font family.`;
}
