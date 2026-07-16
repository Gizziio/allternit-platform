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

    expect(theme.background).toBe('rgb(253, 248, 243)');
    expect(theme.foreground).toBe('rgb(42, 31, 22)');
    expect(theme.cursor).toBe('rgb(42, 31, 22)');
    expect(theme.red).toBe('rgb(190, 24, 93)');
    expect(theme.green).toBe('rgb(5, 150, 105)');
    expect(theme.cyan).toBe('rgb(8, 145, 178)');
  });
});
