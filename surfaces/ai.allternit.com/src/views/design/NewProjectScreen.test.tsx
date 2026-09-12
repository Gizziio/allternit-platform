import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import saasLandingSkill from '../../../skills/saas-landing-skill/SKILL.md?raw';
import { parseSkillMarkdown } from '../../lib/design/skill-registry';
import { NewProjectScreen } from './NewProjectScreen';

const skill = parseSkillMarkdown('saas-landing', saasLandingSkill, ['assets/base.html']);

function Harness({ onStart }: { onStart: (config: { name: string; prompt: string; skillValues?: Record<string, unknown> }) => void }) {
  const [skillValues, setSkillValues] = useState<Record<string, unknown>>({});
  return (
    <NewProjectScreen
      onStart={onStart}
      selectedSkill={skill}
      skillValues={skillValues}
      onChangeSkillValues={setSkillValues}
    />
  );
}

describe('NewProjectScreen skill inputs (issue #374)', () => {
  it('renders one control per declared od.inputs entry', () => {
    render(<Harness onStart={vi.fn()} />);
    expect(screen.getByLabelText('Product name')).toBeTruthy();
    expect(screen.getByLabelText('Tagline')).toBeTruthy();
    expect(screen.getByLabelText('Include pricing section')).toBeTruthy();
  });

  it('blocks submit until required inputs are filled, then passes values through', () => {
    const onStart = vi.fn();
    render(<Harness onStart={onStart} />);

    const prompt = screen.getByPlaceholderText('Describe the design you want to create');
    fireEvent.change(prompt, { target: { value: 'Landing page for my devtool' } });

    const submit = screen.getByRole('button', { name: 'Create project' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true); // required inputs still empty

    fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Acme Dev' } });
    fireEvent.change(screen.getByLabelText('Tagline'), { target: { value: 'Ship faster' } });
    fireEvent.click(screen.getByLabelText('Include pricing section')); // default true → false

    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    expect(onStart).toHaveBeenCalledTimes(1);
    const config = onStart.mock.calls[0]![0] as { name: string; skillValues?: Record<string, unknown> };
    expect(config.skillValues).toEqual({
      product_name: 'Acme Dev',
      tagline: 'Ship faster',
      has_pricing: false,
    });
  });

  it('declared defaults count as filled values', () => {
    const onStart = vi.fn();
    render(<Harness onStart={onStart} />);
    fireEvent.change(screen.getByPlaceholderText('Describe the design you want to create'), {
      target: { value: 'Landing page' },
    });
    const submit = screen.getByRole('button', { name: 'Create project' }) as HTMLButtonElement;
    // has_pricing defaults to true, but the two required strings are empty → gated.
    expect(submit.disabled).toBe(true);
  });
});
