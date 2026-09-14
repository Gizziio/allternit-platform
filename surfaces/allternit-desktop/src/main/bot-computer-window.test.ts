import { describe, expect, it } from 'vitest';
import {
  BOT_COMPUTER_DETACHED_SURFACE,
  buildBotComputerWindowUrl,
  isBotComputerWindowUrl,
} from './bot-computer-window.js';

describe('buildBotComputerWindowUrl', () => {
  it('builds a detached /shell URL for the bot computer', () => {
    const href = buildBotComputerWindowUrl('https://platform.example', {
      botId: 'bot-1',
      title: "Gizzi's computer",
    });
    const url = new URL(href);
    expect(url.pathname).toBe('/shell');
    expect(url.searchParams.get('detachedSurface')).toBe(BOT_COMPUTER_DETACHED_SURFACE);
    expect(url.searchParams.get('botId')).toBe('bot-1');
    expect(url.searchParams.get('title')).toBe("Gizzi's computer");
  });

  it('forwards sandboxId onto the detached URL', () => {
    const href = buildBotComputerWindowUrl('https://platform.example', {
      botId: 'bot-1',
      sandboxId: 'account-box',
    });
    expect(new URL(href).searchParams.get('sandboxId')).toBe('account-box');
  });

  it('rejects a missing bot id', () => {
    expect(() => buildBotComputerWindowUrl('https://platform.example', { botId: '' })).toThrow(
      /bot ID/i,
    );
  });
});

describe('isBotComputerWindowUrl', () => {
  it('matches /shell and legacy /platform detached computer URLs', () => {
    const shell = new URL(buildBotComputerWindowUrl('https://platform.example', { botId: 'b' }));
    expect(isBotComputerWindowUrl(shell)).toBe(true);
    const platform = new URL('https://platform.example/platform?detachedSurface=bot-computer&botId=b');
    expect(isBotComputerWindowUrl(platform)).toBe(true);
  });

  it('rejects other detached surfaces', () => {
    const code = new URL('https://platform.example/shell?detachedSurface=code&detachedSessionId=s');
    expect(isBotComputerWindowUrl(code)).toBe(false);
  });
});
