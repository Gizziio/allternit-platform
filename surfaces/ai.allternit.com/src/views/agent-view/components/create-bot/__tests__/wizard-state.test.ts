import { describe, it, expect } from 'vitest';
import type { CreateAgentInput } from '@/lib/agents/agent.types';
import { BOT_TEMPLATES } from '@/lib/bots/bots.manifest';
import { BOT_CATEGORY_DEFAULT_TOOLS } from '@/lib/bots/bot-tool-registry';
import { defaultBotVMOperatorConfig } from '@/lib/bots/vm-operator';
import {
  WIZARD_STEPS,
  canNavigateTo,
  buildCreateBotPayload,
  createChecklistFor,
  deriveHandle,
  hasDisplayName,
  stepGateMet,
} from '../wizard-state';

function baseFormData(patch: Partial<CreateAgentInput> = {}): Partial<CreateAgentInput> {
  return {
    name: '',
    description: '',
    type: 'worker',
    model: 'test-model',
    provider: 'anthropic',
    maxIterations: 10,
    temperature: 0.7,
    trustTier: 'standard',
    writeScope: 'workspace',
    allowedSurfaces: ['chat'],
    harness: { mode: 'cloud' },
    isBot: true,
    systemPrompt: '',
    vmOperator: defaultBotVMOperatorConfig(),
    botProfile: {
      displayName: '',
      tagline: '',
      welcomeMessage: '',
      starterPrompts: [],
      accentColor: '#D4956A',
      groupChatEnabled: true,
      botCategory: 'custom',
    },
    ...patch,
  };
}

const dummyAvatar = {
  type: 'mascot',
  mascotTemplate: 'gizzi',
} as unknown as import('@/lib/agents/agent.types').AvatarConfig;

describe('wizard-state — gating', () => {
  it('has four steps in plan order', () => {
    expect(WIZARD_STEPS.map((s) => s.id)).toEqual(['start', 'identity', 'job', 'computer']);
  });

  it('start step always passes its gate', () => {
    expect(stepGateMet('start', baseFormData())).toBe(true);
  });

  it('identity/job/computer block without a display name', () => {
    const form = baseFormData();
    expect(hasDisplayName(form)).toBe(false);
    expect(stepGateMet('identity', form)).toBe(false);
    expect(stepGateMet('job', form)).toBe(false);
    expect(stepGateMet('computer', form)).toBe(false);
  });

  it('identity/job/computer pass with a 2+ char display name', () => {
    const form = baseFormData();
    form.botProfile = { ...form.botProfile!, displayName: 'Quinn — Chief of Staff' };
    expect(hasDisplayName(form)).toBe(true);
    expect(stepGateMet('identity', form)).toBe(true);
    expect(stepGateMet('job', form)).toBe(true);
    expect(stepGateMet('computer', form)).toBe(true);
  });

  it('a 1-char display name does not satisfy the gate', () => {
    const form = baseFormData();
    form.botProfile = { ...form.botProfile!, displayName: 'Q' };
    expect(stepGateMet('identity', form)).toBe(false);
  });

  it('no free step jumping: later steps are unreachable until identity passes', () => {
    const empty = baseFormData();
    expect(canNavigateTo(0, empty)).toBe(true);
    expect(canNavigateTo(1, empty)).toBe(true); // identity itself is reachable
    expect(canNavigateTo(2, empty)).toBe(false); // job requires passing identity
    expect(canNavigateTo(3, empty)).toBe(false); // computer requires passing identity + job

    const named = baseFormData();
    named.botProfile = { ...named.botProfile!, displayName: 'Quinn' };
    expect(canNavigateTo(2, named)).toBe(true);
    expect(canNavigateTo(3, named)).toBe(true);
  });
});

describe('wizard-state — payload building', () => {
  it('deriveHandle slugifies the display name', () => {
    expect(deriveHandle('Quinn — Chief of Staff')).toBe('quinn-chief-of-staff');
    expect(deriveHandle('')).toBe('my-bot');
  });

  it('pads handles shorter than the checklist minimum', () => {
    const form = baseFormData({ name: '' });
    form.botProfile = { ...form.botProfile!, displayName: 'My' };
    const payload = buildCreateBotPayload({ formData: form, avatar: dummyAvatar });
    expect(payload.name).toBe('my-bot');
    expect(payload.name.length).toBeGreaterThanOrEqual(3);
  });

  it('falls back to a checklist-safe description and adds a character layer', () => {
    const form = baseFormData({ description: '' });
    form.botProfile = { ...form.botProfile!, displayName: 'Quinn', tagline: '' };
    const payload = buildCreateBotPayload({ formData: form, avatar: dummyAvatar });
    expect(payload.description.length).toBeGreaterThanOrEqual(10);
    expect(payload.characterLayer?.identity.setup).toBe('generalist');
    expect(payload.characterLayer?.roleCard.domain).toBe('custom');
    const checklist = createChecklistFor(form, dummyAvatar);
    expect(checklist.isValid).toBe(true);
  });

  it('gates create on the real checklist (model missing → invalid)', () => {
    const form = baseFormData({ model: '' });
    form.botProfile = { ...form.botProfile!, displayName: 'Quinn' };
    const checklist = createChecklistFor(form, dummyAvatar);
    expect(checklist.isValid).toBe(false);
    expect(checklist.items.find((i) => i.id === 'runtime')).toMatchObject({ satisfied: false });
  });
});

describe('wizard-state — template seeding contract', () => {
  it('every BOT_TEMPLATES factory yields a display name, accent, and authored system prompt', () => {
    expect(BOT_TEMPLATES.length).toBe(7);
    for (const template of BOT_TEMPLATES) {
      const agent = template.create();
      expect(agent.botProfile?.displayName).toBeTruthy();
      expect(agent.botProfile?.accentColor).toMatch(/^#[0-9A-F]{6}$/i);
      expect(agent.systemPrompt?.length ?? 0).toBeGreaterThanOrEqual(10);
      expect(agent.description?.length ?? 0).toBeGreaterThanOrEqual(10);
    }
  });

  it('every category used by templates has a default tool allowlist', () => {
    const categories = new Set(
      BOT_TEMPLATES.map((t) => {
        const agent = t.create();
        return agent.category ?? 'general';
      }),
    );
    const reverse: Record<string, string> = {
      research: 'research',
      engineering: 'code',
      creative: 'writing',
      marketing: 'sales',
      design: 'design',
      operations: 'ops',
      general: 'custom',
    };
    for (const category of categories) {
      expect(BOT_CATEGORY_DEFAULT_TOOLS[reverse[category] ?? 'custom']).toBeDefined();
    }
  });
});
