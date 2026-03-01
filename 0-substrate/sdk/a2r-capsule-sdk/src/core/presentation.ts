/**
 * Presentation Types
 *
 * Presentation mode and stage preset definitions.
 */

export type Presentation = 'capsule' | 'stage';
export type StagePreset = 0.5 | 0.7 | 1.0;

export const STAGE_PRESETS: StagePreset[] = [0.5, 0.7, 1.0];

export function isValidStagePreset(value: number): value is StagePreset {
  return STAGE_PRESETS.includes(value as StagePreset);
}

export function stagePresetToString(preset: StagePreset): string {
  switch (preset) {
    case 0.5:
      return '50%';
    case 0.7:
      return '70%';
    case 1.0:
      return '100%';
    default:
      return `${Math.round(preset * 100)}%`;
  }
}

export function parseStagePreset(value: string): StagePreset | null {
  switch (value) {
    case '50%':
    case '0.5':
      return 0.5;
    case '70%':
    case '0.7':
      return 0.7;
    case '100%':
    case '1.0':
    case '1':
      return 1.0;
    default:
      return null;
  }
}
