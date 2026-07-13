import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SettingsCard, SettingsCardRow } from './SettingsCard';
import { Toggle } from './Toggle';

describe('SettingsCard', () => {
  it('renders title, description, and children', () => {
    render(
      <SettingsCard title="Card Title" description="Card description" action={<button type="button">Action</button>}>
        <SettingsCardRow label="Row Label" description="Row description">
          <Toggle value={false} onChange={() => {}} />
        </SettingsCardRow>
      </SettingsCard>
    );

    expect(screen.getByText('Card Title')).toBeInTheDocument();
    expect(screen.getByText('Card description')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('Row Label')).toBeInTheDocument();
    expect(screen.getByText('Row description')).toBeInTheDocument();
  });

  it('renders without header when title/description/action are omitted', () => {
    render(
      <SettingsCard>
        <SettingsCardRow label="Only Row" />
      </SettingsCard>
    );

    expect(screen.getByText('Only Row')).toBeInTheDocument();
  });
});
