import { formatSelectionToPromptBlock, isCreationMode, type FormatSelection } from './presets';

export interface CreationPayload {
  modeId: string;
  prompt: string;
  formatSelection: FormatSelection;
}

/**
 * Inject deterministic constraints into a creation-mode prompt.
 *
 * The model receives explicit [CREATE_MODE], [FORMAT_TAB], [FORMAT] and
 * [DETAIL]/[CUSTOM_SIZE] markers, plus a one-line instruction that locks the
 * output type. This prevents the model from improvising format or medium.
 */
export function enrichCreationPrompt(input: string, modeId: string, formatSelection: FormatSelection | null): string {
  if (!isCreationMode(modeId) || !formatSelection) return input;

  const block = formatSelectionToPromptBlock(formatSelection);
  if (!block) return input;

  const instruction = `You are in deterministic creation mode. Produce only the requested ${modeId} artifact using the format constraints below. Do not ask clarifying questions unless a required fact is missing.`;

  return `${instruction}\n\n${block}\n\nUser request: ${input}`;
}

export function parseCreationPayload(enriched: string): CreationPayload | null {
  const modeMatch = /\[CREATE_MODE: ([^\]]+)\]/.exec(enriched);
  if (!modeMatch) return null;

  const modeId = modeMatch[1];
  const promptMatch = /User request: (.+)/s.exec(enriched);
  const prompt = promptMatch?.[1]?.trim() ?? enriched;

  const tabMatch = /\[FORMAT_TAB: ([^\]]+)\]/.exec(enriched);
  const formatMatch = /\[FORMAT: ([^\]]+)\]/.exec(enriched);
  const customMatch = /\[CUSTOM_SIZE: ([\d.]+) × ([\d.]+) (px|cm)\]/.exec(enriched);

  const formatSelection: FormatSelection = {
    modeId,
    tabId: tabMatch?.[1] ?? 'type',
    optionId: formatMatch?.[1] ?? 'default',
    custom: customMatch
      ? {
          width: Number(customMatch[1]),
          height: Number(customMatch[2]),
          unit: customMatch[3] as 'px' | 'cm',
        }
      : null,
  };

  return { modeId, prompt, formatSelection };
}
