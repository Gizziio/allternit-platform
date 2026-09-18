import { beforeEach, describe, expect, it } from 'vitest';
import { useBotPluginAllowStore } from './bot-plugin-allow.store';

describe('bot-plugin-allow', () => {
  beforeEach(() => {
    useBotPluginAllowStore.setState({ allowedByBot: {} });
  });

  it('keeps connect and Allow as separate switches', () => {
    expect(useBotPluginAllowStore.getState().isAllowed('scout')).toBe(false);
    useBotPluginAllowStore.getState().setAllowed('scout', true);
    expect(useBotPluginAllowStore.getState().isAllowed('scout')).toBe(true);
    useBotPluginAllowStore.getState().setAllowed('lin', false);
    expect(useBotPluginAllowStore.getState().isAllowed('lin')).toBe(false);
  });
});
