import { afterEach, describe, expect, it } from 'vitest';
import { terminalThemeFromElement } from './UnifiedTerminal';

describe('terminalThemeFromElement', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('style');
    document.body.innerHTML = '';
  });

  it('derives xterm colors from the active platform theme', () => {
    document.documentElement.style.setProperty('--status-error', 'rgb(190, 24, 93)');
    document.documentElement.style.setProperty('--status-success', 'rgb(5, 150, 105)');
    document.documentElement.style.setProperty('--status-warning', 'rgb(217, 119, 6)');
    document.documentElement.style.setProperty('--status-info', 'rgb(37, 99, 235)');
    document.documentElement.style.setProperty('--accent-code', 'rgb(8, 145, 178)');
    document.documentElement.style.setProperty('--surface-active', 'rgba(124, 92, 66, 0.2)');

    const element = document.createElement('div');
    element.style.backgroundColor = 'rgb(253, 248, 243)';
    element.style.color = 'rgb(42, 31, 22)';
    document.body.appendChild(element);

    const theme = terminalThemeFromElement(element);

    // The terminal is intentionally rendered on a dark, code-branded surface
    // regardless of the surrounding canvas theme.
    expect(theme.background).toBe('#111415');
    expect(theme.foreground).toBe('#e8e4df');
    expect(theme.cursor).toBe('#e8e4df');
    expect(theme.red).toBe('rgb(190, 24, 93)');
    expect(theme.green).toBe('rgb(5, 150, 105)');
    expect(theme.cyan).toBe('rgb(8, 145, 178)');
  });
});
