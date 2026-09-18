import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CreateAgentInput } from '@/lib/agents/agent.types';
import { IdentityStep } from '../steps/IdentityStep';
import { StartStep } from '../steps/StartStep';
import { JobStep } from '../steps/JobStep';
import { starterPromptSuggestionsFor, STARTER_PROMPT_MAX } from '../starter-prompt-suggestions';
import { WIZARD_COPY } from '../wizard-copy';

function buildFormData(overrides: Partial<CreateAgentInput> = {}): Partial<CreateAgentInput> {
  return {
    name: 'quinn',
    description: '',
    systemPrompt: '',
    allowedTools: [],
    botProfile: {
      displayName: 'Quinn',
      tagline: '',
      welcomeMessage: '',
      starterPrompts: [],
      accentColor: '#B08D6E',
      groupChatEnabled: true,
      botCategory: 'research',
    },
    ...overrides,
  };
}

function renderIdentityStep(botProfileOverrides: Record<string, unknown> = {}) {
  const formData = buildFormData({
    botProfile: { ...buildFormData().botProfile!, ...botProfileOverrides } as CreateAgentInput['botProfile'],
  });
  const updateBotProfile = vi.fn();
  const props = {
    formData,
    setFormData: vi.fn(),
    updateBotProfile,
    updateAccentColor: vi.fn(),
    onError: vi.fn(),
    avatarMode: 'gizzi' as const,
    setAvatarMode: vi.fn(),
    avatarPicker: {} as never,
    setAvatarPicker: vi.fn(),
    mascotTemplate: 'gizzi' as never,
    setMascotTemplate: vi.fn(),
    gizziColor: '#B08D6E',
    setGizziColor: vi.fn(),
    gizziEmotion: 'pleased' as never,
    setGizziEmotion: vi.fn(),
    imageDataUrl: null,
    setImageDataUrl: vi.fn(),
    petUrl: '',
    setPetUrl: vi.fn(),
    packSelection: { packId: 'alloy-classic', spriteId: 'atlas' },
    setPackSelection: vi.fn(),
  };
  render(<IdentityStep {...props} />);
  return { updateBotProfile };
}

describe('IdentityStep starter-prompt chips', () => {
  it('renders suggestions for the selected category', () => {
    renderIdentityStep({ botCategory: 'research' });
    for (const suggestion of starterPromptSuggestionsFor('research')) {
      expect(screen.getByRole('button', { name: suggestion })).toBeInTheDocument();
    }
  });

  it('clicking a chip appends it to starterPrompts', () => {
    const { updateBotProfile } = renderIdentityStep();
    const suggestion = starterPromptSuggestionsFor('research')[0];
    fireEvent.click(screen.getByRole('button', { name: suggestion }));
    expect(updateBotProfile).toHaveBeenCalledWith({ starterPrompts: [suggestion] });
  });

  it('disables an already-added chip instead of duplicating it', () => {
    const suggestion = starterPromptSuggestionsFor('research')[0];
    renderIdentityStep({ starterPrompts: [suggestion] });
    const chip = screen.getByRole('button', { name: suggestion });
    expect(chip).toBeDisabled();
  });

  it('disables every chip once the cap is reached', () => {
    const prompts = starterPromptSuggestionsFor('research').slice(0, STARTER_PROMPT_MAX);
    renderIdentityStep({ starterPrompts: prompts });
    const remaining = starterPromptSuggestionsFor('research').slice(STARTER_PROMPT_MAX);
    for (const suggestion of remaining) {
      expect(screen.getByRole('button', { name: suggestion })).toBeDisabled();
    }
  });

  it('falls back to default suggestions for an unknown category', () => {
    renderIdentityStep({ botCategory: 'something-else' });
    for (const suggestion of starterPromptSuggestionsFor('default')) {
      expect(screen.getByRole('button', { name: suggestion })).toBeInTheDocument();
    }
  });
});

describe('StartStep describe states', () => {
  it('shows an inline error when the describe call failed', () => {
    render(
      <StartStep
        selectedTemplateId={null}
        onSelectTemplate={vi.fn()}
        describing={false}
        onDescribe={vi.fn()}
        describeError={WIZARD_COPY.errors.describeFailed}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: WIZARD_COPY.steps.start.describeToggle }));
    expect(screen.getByText(WIZARD_COPY.errors.describeFailed)).toBeInTheDocument();
  });

  it('shows the working state and disables the button while describing', () => {
    render(
      <StartStep
        selectedTemplateId={null}
        onSelectTemplate={vi.fn()}
        describing
        onDescribe={vi.fn()}
      />,
    );
    const toggle = screen.getByRole('button', { name: WIZARD_COPY.steps.start.describeToggle });
    fireEvent.click(toggle);
    expect(screen.getByText(WIZARD_COPY.steps.start.describeWorking)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /working/i })).toBeDisabled();
  });
});

describe('JobStep refine states', () => {
  it('shows the working state while refining and an inline error on failure', () => {
    render(
      <JobStep
        formData={buildFormData()}
        setFormData={vi.fn()}
        refining={false}
        onRefine={vi.fn()}
        refineError={WIZARD_COPY.errors.refineFailed}
      />,
    );
    expect(screen.getByText(WIZARD_COPY.errors.refineFailed)).toBeInTheDocument();

    render(
      <JobStep
        formData={buildFormData()}
        setFormData={vi.fn()}
        refining
        onRefine={vi.fn()}
      />,
    );
    expect(screen.getByText(WIZARD_COPY.steps.job.refineWorking)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /working/i })).toBeDisabled();
  });
});
