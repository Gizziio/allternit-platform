import type { WizardState } from '@/services/setup-api';
import { APP_VERSION } from './app-version';

/**
 * Decide whether the first-start env wizard should be shown.
 *
 * The server-side `user.onboardingComplete` flag is authoritative. The
 * `wizard` block (version, timestamp, command, mode) is metadata recorded for
 * analytics and future targeted upgrade prompts — it is never required to
 * pass the gate. A missing or stale wizard block, or an app version bump,
 * must NOT re-gate a completed onboarding: this is a self-hosted desktop app
 * and a returning user must never be locked out behind the marketing flow.
 */
export function shouldRunWizard(
  onboardingComplete: boolean | undefined,
  _wizard: WizardState | undefined,
): boolean {
  return !onboardingComplete;
}

export function buildWizardState(command?: string, mode?: string): WizardState {
  return {
    lastRunAt: new Date().toISOString(),
    lastRunVersion: APP_VERSION,
    lastRunCommand: command ?? 'onboard',
    lastRunMode: mode ?? 'local',
  };
}
