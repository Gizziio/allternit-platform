import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LabsSettingsTab } from './LabsSettingsTab';

describe('LabsSettingsTab', () => {
  it('wires toggles to saveConfig', () => {
    const saveConfig = vi.fn();
    render(
      <LabsSettingsTab
        canvasToken=""
        canvasDomain="https://canvas.instructure.com"
        autoGenerateLessons={false}
        researchNotebookSync={true}
        saveConfig={saveConfig}
      />
    );

    const toggles = screen.getAllByRole('switch');
    // toggles: Show token, Auto-generate lessons, Research notebook sync
    fireEvent.click(toggles[1]);
    expect(saveConfig).toHaveBeenCalledWith({ autoGenerateLessons: true });

    fireEvent.click(toggles[2]);
    expect(saveConfig).toHaveBeenCalledWith({ researchNotebookSync: false });
  });
});
