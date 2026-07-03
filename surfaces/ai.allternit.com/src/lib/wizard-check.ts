import type { WizardState } from '@/services/setup-api';
import { APP_VERSION } from './app-version';

/**
 * Decide whether the first-start env wizard should be shown.
 *
 * Mirrors the OpenClaw pattern: a `wizard` block in user config records the
 * last time the wizard ran (version, timestamp, command, mode). The wizard is
 * shown when:
 *   - it has never run, or
 *   - the app version has changed since it last ran, or
 *   - the user explicitly cleared onboarding.
 */
export function shouldRunWizard(
  onboardingComplete: boolean | undefined,
  wizard: WizardState | undefined,
): boolean {
  if (!onboardingComplete) return true;
  if (!wizard?.lastRunAt) return true;
  if (wizard.lastRunVersion !== APP_VERSION) return true;
  return false;
}

export function buildWizardState(command?: string, mode?: string): WizardState {
  return {
    lastRunAt: new Date().toISOString(),
    lastRunVersion: APP_VERSION,
    lastRunCommand: command ?? 'onboard',
    lastRunMode: mode ?? 'local',
  };
}
