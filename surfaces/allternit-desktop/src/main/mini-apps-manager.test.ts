import { describe, expect, it } from 'vitest';
import { MINI_APP_CONFIGS } from './mini-apps-manager.js';

describe('official mini-app runtime contracts', () => {
  it('uses the upstream OpenClaw package and gateway command', () => {
    expect(MINI_APP_CONFIGS.openclaw).toMatchObject({
      packageName: 'openclaw@latest',
      installArgs: ['install', '-g', 'openclaw@latest'],
      binary: 'openclaw',
      startArgs: ['gateway', '--port', '18789'],
    });
  });

  it('uses the Nous Hermes installer and gateway lifecycle', () => {
    expect(MINI_APP_CONFIGS.hermes.installArgs.join(' ')).toContain('hermes-agent.nousresearch.com/install.sh');
    expect(MINI_APP_CONFIGS.hermes.startArgs).toEqual(['dashboard', '--no-open', '--port', '9119']);
  });

  it('uses the official OMP installer and RPC mode', () => {
    expect(MINI_APP_CONFIGS['oh-my-pi'].installArgs.join(' ')).toContain('https://omp.sh/install');
    expect(MINI_APP_CONFIGS['oh-my-pi'].startArgs).toEqual(['acp']);
  });
});
