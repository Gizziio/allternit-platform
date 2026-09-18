import { beforeEach, describe, expect, it } from 'vitest';
import { useScreenControlStore } from './screen-control-ask';

describe('screen-control-ask', () => {
  beforeEach(() => {
    useScreenControlStore.setState({ alwaysAllowByBot: {} });
  });

  it('does not open foreground until always-allow is remembered', () => {
    expect(useScreenControlStore.getState().isAlwaysAllowed('bot-1')).toBe(false);
    useScreenControlStore.getState().rememberAlways('bot-1');
    expect(useScreenControlStore.getState().isAlwaysAllowed('bot-1')).toBe(true);
    useScreenControlStore.getState().forget('bot-1');
    expect(useScreenControlStore.getState().isAlwaysAllowed('bot-1')).toBe(false);
  });
});
