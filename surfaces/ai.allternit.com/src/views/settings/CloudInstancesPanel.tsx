/**
 * CloudInstancesPanel - BYO-VPS provisioning wizard.
 *
 * Drives the session-based deploy wizard on the cloud API
 * (`/api/v1/cloud/wizard/deployments`) with the Clerk session token, exactly
 * like DevicePairingPanel talks to the pairing endpoints. One panel covers:
 *
 * - starting a deployment (provider select → credentials → config),
 * - walking the server state machine (advance → bootstrap → success),
 * - resuming / cancelling / deleting saved wizard sessions,
 * - managing saved provider tokens (`/api/v1/provider-tokens`).
 *
 * Secrets (provider tokens, SSH keys, SSH passwords) are only ever held in
 * form state, submitted once, and cleared immediately after submission. They
 * are never rendered back or logged; the API redacts them in every response.
 */

"use client";

import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowClockwise,
  ArrowLeft,
  CheckCircle,
  CircleNotch,
  CloudArrowUp,
  HardDrives,
  Trash,
  Warning,
} from '@phosphor-icons/react';
import { STATUS, TEXT } from '@/design/allternit.tokens';
import { SectionHeading } from '@/components/settings/SectionHeading';
import { QUIET_BUTTON_CLASS, DESTRUCTIVE_BUTTON_CLASS } from '@/components/settings/buttonStyles';
import { cn } from '@/lib/utils';
import { env } from '@/lib/env';
import { usePlatformAuth } from '@/lib/platform-auth-client';

/* -------------------------------------------------------------------------- */
/* API shapes (mirror allternit-cloud-wizard state_machine.rs / handlers.rs)  */
/* -------------------------------------------------------------------------- */

type WizardProvider = 'hetzner' | 'digitalocean' | 'aws' | 'manual';

/** WizardStep serializes with default (PascalCase) variant names. */
type WizardStepName =
  | 'SelectProvider'
  | 'AgentAssistedSignup'
  | 'HumanPaymentCheckpoint'
  | 'HumanVerificationCheckpoint'
  | 'EnterCredentials'
  | 'ValidateCredentials'
  | 'Preflight'
  | 'Provisioning'
  | 'Bootstrap'
  | 'Verification'
  | 'Complete'
  | 'Failed'
  | 'Cancelled'
  | 'AwaitingHumanAction';

interface WizardContextShape {
  provider?: WizardProvider | null;
  auth_method?: 'ssh_key' | 'ssh_password' | 'api_token' | null;
  region?: string | null;
  instance_type?: string | null;
  instance_name?: string | null;
  storage_gb?: number | null;
  ssh_host?: string | null;
  ssh_port?: number | null;
  ssh_username?: string | null;
  instance_id?: string | null;
  instance_ip?: string | null;
  bootstrap_log?: string | null;
  verification_passed?: boolean | null;
  agent_guidance?: string[];
}

interface WizardSession {
  deployment_id: string;
  current_step: WizardStepName;
  context: WizardContextShape;
  timestamps: {
    created_at: string;
    last_step_started_at?: string | null;
    last_step_completed_at?: string | null;
    completed_at?: string | null;
  };
  retry_count: number;
  max_retries: number;
}

interface ProviderTokenStatus {
  provider: string;
  configured: boolean;
}

interface BootstrapResult {
  deployment_id: string;
  status: string;
  mesh_ip: string;
  instance_name: string;
  url: string;
  wizard?: WizardSession;
}

/* -------------------------------------------------------------------------- */
/* State machine mapping                                                       */
/* -------------------------------------------------------------------------- */

/** Rank of each step in the normal happy path, for done/active rendering. */
const STEP_RANK: Record<WizardStepName, number> = {
  SelectProvider: 0,
  AgentAssistedSignup: 0,
  HumanPaymentCheckpoint: 1,
  HumanVerificationCheckpoint: 1,
  AwaitingHumanAction: 1,
  EnterCredentials: 1,
  ValidateCredentials: 2,
  Preflight: 3,
  Provisioning: 4,
  Bootstrap: 5,
  Verification: 6,
  Complete: 7,
  Failed: 5,
  Cancelled: 0,
};

/** Steps `POST .../advance` can execute (it runs the current step, then moves on). */
const ADVANCEABLE: ReadonlySet<WizardStepName> = new Set([
  'SelectProvider',
  'EnterCredentials',
  'ValidateCredentials',
  'Preflight',
  'Provisioning',
]);

const TERMINAL: ReadonlySet<WizardStepName> = new Set(['Complete', 'Failed', 'Cancelled']);

const PROVIDER_LABEL: Record<string, string> = {
  hetzner: 'Hetzner Cloud',
  digitalocean: 'DigitalOcean',
  aws: 'AWS',
  manual: 'Existing server (SSH)',
};

const PROVIDER_DEFAULTS: Record<'hetzner' | 'digitalocean', { region: string; instanceType: string }> = {
  hetzner: { region: 'fsn1', instanceType: 'cx21' },
  digitalocean: { region: 'nyc3', instanceType: 's-1vcpu-2gb' },
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function cloudApiUrl(path: string): string {
  const base = env('NEXT_PUBLIC_ALLTERNIT_CLOUD_API_URL', 'https://allternit-cloud-api.fly.dev')!;
  return `${base.replace(/\/$/, '')}${path}`;
}

async function readError(response: Response, fallback: string): Promise<Error> {
  const payload = await response.json().catch(() => ({})) as { message?: string; error?: string };
  return new Error(payload.message || payload.error || fallback);
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '';
  return new Date(value).toLocaleString();
}

function sessionTitle(session: WizardSession): string {
  return session.context.instance_name || `Deployment ${session.deployment_id.slice(0, 8)}`;
}

function stepLabel(step: WizardStepName): string {
  switch (step) {
    case 'SelectProvider': return 'Provider selected';
    case 'EnterCredentials': return 'Credentials entered';
    case 'ValidateCredentials': return 'Validating credentials';
    case 'Preflight': return 'Running preflight checks';
    case 'Provisioning': return 'Provisioning';
    case 'Bootstrap': return 'Ready to install';
    case 'Verification': return 'Verifying';
    case 'Complete': return 'Complete';
    case 'Failed': return 'Failed';
    case 'Cancelled': return 'Cancelled';
    default: return 'Waiting for input';
  }
}

const CARD_STYLE: React.CSSProperties = {
  marginBottom: '24px',
  padding: '20px',
  borderRadius: '10px',
  background: 'rgba(37,37,37,0.4)',
  border: '1px solid var(--ui-border-muted)',
};

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '10px',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
};

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: TEXT.secondary,
  marginBottom: '6px',
};

const ERROR_BANNER_STYLE: React.CSSProperties = {
  marginBottom: '20px',
  padding: '14px 18px',
  borderRadius: '10px',
  background: 'var(--status-error-bg)',
  border: '1px solid rgba(239,68,68,0.25)',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  color: STATUS.error,
  fontSize: '13px',
};

/* -------------------------------------------------------------------------- */
/* Panel                                                                       */
/* -------------------------------------------------------------------------- */

type WizardPhase = 'provider' | 'credentials' | 'config' | 'run';
type AutomatedProvider = 'hetzner' | 'digitalocean';
type SelectedProvider = AutomatedProvider | 'manual';

type ValidateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'ok'; message: string }
  | { state: 'fail'; message: string };

export function CloudInstancesPanel() {
  const { getToken } = usePlatformAuth();

  // Sessions list
  const [sessions, setSessions] = useState<WizardSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  // Saved provider tokens
  const [tokens, setTokens] = useState<ProviderTokenStatus[]>([]);
  const [tokensError, setTokensError] = useState<string | null>(null);
  const [deletingToken, setDeletingToken] = useState<string | null>(null);

  // Wizard draft
  const [wizardOpen, setWizardOpen] = useState(false);
  const [phase, setPhase] = useState<WizardPhase>('provider');
  const [provider, setProvider] = useState<SelectedProvider | null>(null);
  const [apiToken, setApiToken] = useState('');
  const [saveToken, setSaveToken] = useState(false);
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState('22');
  const [sshUsername, setSshUsername] = useState('root');
  const [sshAuth, setSshAuth] = useState<'key' | 'password'>('key');
  const [sshKey, setSshKey] = useState('');
  const [sshPassword, setSshPassword] = useState('');
  const [instanceName, setInstanceName] = useState('');
  const [region, setRegion] = useState('');
  const [instanceType, setInstanceType] = useState('');
  const [storageGb, setStorageGb] = useState('');
  const [validate, setValidate] = useState<ValidateStatus>({ state: 'idle' });
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Active deployment run
  const [active, setActive] = useState<WizardSession | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapResult, setBootstrapResult] = useState<BootstrapResult | null>(null);
  const [bootstrapError, setBootstrapError] = useState<{ message: string; recoverable: boolean } | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const webFetch = useCallback(async (path: string, init?: RequestInit) => {
    const token = await getToken();
    if (!token) throw new Error('Your Allternit session is unavailable. Sign in again to continue.');
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(cloudApiUrl(path), { ...init, headers });
  }, [getToken]);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const response = await webFetch('/api/v1/cloud/wizard/deployments');
      if (!response.ok) throw await readError(response, 'Unable to load deployments.');
      setSessions(await response.json() as WizardSession[]);
    } catch (failure) {
      setSessionsError(failure instanceof Error ? failure.message : 'Unable to load deployments.');
    } finally {
      setSessionsLoading(false);
    }
  }, [webFetch]);

  const loadTokens = useCallback(async () => {
    setTokensError(null);
    try {
      const response = await webFetch('/api/v1/provider-tokens');
      if (!response.ok) throw await readError(response, 'Unable to load saved tokens.');
      const payload = await response.json() as { providers?: ProviderTokenStatus[] };
      setTokens(payload.providers ?? []);
    } catch (failure) {
      setTokensError(failure instanceof Error ? failure.message : 'Unable to load saved tokens.');
    }
  }, [webFetch]);

  useEffect(() => {
    void loadSessions();
    void loadTokens();
  }, [loadSessions, loadTokens]);

  const tokenConfigured = useCallback(
    (id: string) => tokens.some((t) => t.provider === id && t.configured),
    [tokens],
  );

  /* ---------------------------- wizard actions --------------------------- */

  const validateCredentials = useCallback(async () => {
    if (!provider) return;
    setValidate({ state: 'checking' });
    try {
      const isManual = provider === 'manual';
      const body = isManual
        ? {
            api_key: sshAuth === 'key' ? sshKey : '',
            api_secret: sshAuth === 'password' ? sshPassword : '',
            ssh_host: sshHost.trim(),
            ssh_port: Number(sshPort) || 22,
            ssh_username: sshUsername.trim(),
          }
        : { api_key: apiToken };
      const response = await webFetch(`/api/v1/providers/${isManual ? 'ssh' : provider}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw await readError(response, 'Validation request failed.');
      const payload = await response.json() as { valid: boolean; message: string };
      setValidate(payload.valid
        ? { state: 'ok', message: payload.message }
        : { state: 'fail', message: payload.message });
    } catch (failure) {
      setValidate({ state: 'fail', message: failure instanceof Error ? failure.message : 'Validation failed.' });
    }
  }, [provider, sshAuth, sshKey, sshPassword, sshHost, sshPort, sshUsername, apiToken, webFetch]);

  /** Walk the state machine until it parks at Bootstrap (or a terminal step). */
  const runAdvanceLoop = useCallback(async (session: WizardSession) => {
    setAdvancing(true);
    setRunError(null);
    let current = session;
    try {
      while (ADVANCEABLE.has(current.current_step)) {
        const response = await webFetch(
          `/api/v1/cloud/wizard/deployments/${encodeURIComponent(current.deployment_id)}/advance`,
          { method: 'POST' },
        );
        if (!response.ok) {
          // The step stays put on failure; the server records the reason in
          // agent_guidance, so re-read the session for the message.
          let message = 'This step failed. You can retry it.';
          const stateResponse = await webFetch(
            `/api/v1/cloud/wizard/deployments/${encodeURIComponent(current.deployment_id)}`,
          );
          if (stateResponse.ok) {
            current = await stateResponse.json() as WizardSession;
            const guidance = current.context.agent_guidance ?? [];
            const lastError = [...guidance].reverse().find((entry) => entry.startsWith('Error:'));
            if (lastError) message = lastError.replace(/^Error:\s*/, '');
          }
          setActive(current);
          setRunError(message);
          return;
        }
        current = await response.json() as WizardSession;
        setActive(current);
      }
      void loadSessions();
    } catch (failure) {
      setRunError(failure instanceof Error ? failure.message : 'The deployment step could not be executed.');
    } finally {
      setAdvancing(false);
    }
  }, [webFetch, loadSessions]);

  const startDeployment = useCallback(async () => {
    if (!provider) return;
    setStarting(true);
    setStartError(null);
    try {
      if (saveToken && provider !== 'manual' && apiToken) {
        const put = await webFetch(`/api/v1/provider-tokens/${provider}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: apiToken }),
        });
        if (!put.ok) throw await readError(put, 'Allternit could not save this provider token.');
        void loadTokens();
      }

      const body: Record<string, unknown> = { provider };
      if (provider === 'manual') {
        body.ssh_host = sshHost.trim();
        body.ssh_port = Number(sshPort) || 22;
        body.ssh_username = sshUsername.trim();
        if (sshAuth === 'key') body.ssh_private_key = sshKey;
        else body.ssh_password = sshPassword;
      } else {
        body.api_token = apiToken;
        if (region.trim()) body.region = region.trim();
        if (instanceType.trim()) body.instance_type = instanceType.trim();
        if (storageGb.trim()) body.storage_gb = Number(storageGb);
      }
      if (instanceName.trim()) body.instance_name = instanceName.trim();

      const response = await webFetch('/api/v1/cloud/wizard/deployments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw await readError(response, 'Allternit could not start this deployment.');
      const session = await response.json() as WizardSession;

      // Secrets are submitted; drop them from local state immediately.
      setApiToken('');
      setSshKey('');
      setSshPassword('');
      setSaveToken(false);
      setValidate({ state: 'idle' });

      setActive(session);
      setBootstrapResult(null);
      setBootstrapError(null);
      setPhase('run');
      void loadSessions();
      void runAdvanceLoop(session);
    } catch (failure) {
      setStartError(failure instanceof Error ? failure.message : 'Allternit could not start this deployment.');
    } finally {
      setStarting(false);
    }
  }, [provider, saveToken, apiToken, sshHost, sshPort, sshUsername, sshAuth, sshKey, sshPassword,
    region, instanceType, storageGb, instanceName, webFetch, loadTokens, loadSessions, runAdvanceLoop]);

  const runBootstrap = useCallback(async () => {
    if (!active) return;
    setBootstrapping(true);
    setBootstrapError(null);
    try {
      const response = await webFetch(
        `/api/v1/cloud/wizard/deployments/${encodeURIComponent(active.deployment_id)}/bootstrap`,
        { method: 'POST' },
      );
      const payload = await response.json().catch(() => ({})) as {
        error?: string; message?: string; recoverable?: boolean;
      } & Partial<BootstrapResult>;
      if (!response.ok) {
        setBootstrapError({
          message: payload.message || payload.error || 'The install on the server failed.',
          recoverable: Boolean(payload.recoverable),
        });
        // The server marks the session Failed; re-read it.
        const stateResponse = await webFetch(
          `/api/v1/cloud/wizard/deployments/${encodeURIComponent(active.deployment_id)}`,
        );
        if (stateResponse.ok) setActive(await stateResponse.json() as WizardSession);
        void loadSessions();
        return;
      }
      const result = payload as BootstrapResult;
      setBootstrapResult(result);
      if (result.wizard) setActive(result.wizard);
      void loadSessions();
    } catch (failure) {
      setBootstrapError({
        message: failure instanceof Error ? failure.message : 'The install on the server failed.',
        recoverable: true,
      });
    } finally {
      setBootstrapping(false);
    }
  }, [active, webFetch, loadSessions]);

  const cancelSession = useCallback(async (id: string) => {
    setCancelling(true);
    try {
      const response = await webFetch(
        `/api/v1/cloud/wizard/deployments/${encodeURIComponent(id)}/cancel`,
        { method: 'POST' },
      );
      if (!response.ok) throw await readError(response, 'Unable to cancel this deployment.');
      if (active?.deployment_id === id) {
        setActive(null);
        setWizardOpen(false);
        setPhase('provider');
        setProvider(null);
      }
      void loadSessions();
    } catch (failure) {
      setSessionsError(failure instanceof Error ? failure.message : 'Unable to cancel this deployment.');
    } finally {
      setCancelling(false);
    }
  }, [active, webFetch, loadSessions]);

  const deleteSession = useCallback(async (id: string) => {
    try {
      const response = await webFetch(
        `/api/v1/cloud/wizard/deployments/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      );
      if (response.status === 409) {
        throw new Error('Only finished, failed, or cancelled deployments can be deleted. Cancel it first.');
      }
      if (!response.ok) throw await readError(response, 'Unable to delete this deployment.');
      if (active?.deployment_id === id) {
        setActive(null);
        setWizardOpen(false);
        setPhase('provider');
        setProvider(null);
      }
      void loadSessions();
    } catch (failure) {
      setSessionsError(failure instanceof Error ? failure.message : 'Unable to delete this deployment.');
    }
  }, [active, webFetch, loadSessions]);

  const deleteToken = useCallback(async (id: string) => {
    setDeletingToken(id);
    setTokensError(null);
    try {
      const response = await webFetch(`/api/v1/provider-tokens/${id}`, { method: 'DELETE' });
      if (!response.ok) throw await readError(response, 'Unable to delete this token.');
      void loadTokens();
    } catch (failure) {
      setTokensError(failure instanceof Error ? failure.message : 'Unable to delete this token.');
    } finally {
      setDeletingToken(null);
    }
  }, [webFetch, loadTokens]);

  const resumeSession = useCallback((session: WizardSession) => {
    setActive(session);
    setRunError(null);
    setBootstrapResult(null);
    setBootstrapError(null);
    setWizardOpen(true);
    setPhase('run');
    if (ADVANCEABLE.has(session.current_step)) void runAdvanceLoop(session);
  }, [runAdvanceLoop]);

  const resetWizard = useCallback(() => {
    setWizardOpen(false);
    setPhase('provider');
    setProvider(null);
    setActive(null);
    setRunError(null);
    setBootstrapResult(null);
    setBootstrapError(null);
    setStartError(null);
    setValidate({ state: 'idle' });
  }, []);

  // Poll the session while the run view is active and nothing is in flight,
  // so resumed sessions and long server-side transitions stay fresh.
  useEffect(() => {
    if (phase !== 'run' || !active || advancing || bootstrapping || bootstrapResult) return;
    if (TERMINAL.has(active.current_step)) return;
    const id = active.deployment_id;
    const timer = window.setInterval(async () => {
      try {
        const response = await webFetch(`/api/v1/cloud/wizard/deployments/${encodeURIComponent(id)}`);
        if (response.ok) setActive(await response.json() as WizardSession);
      } catch {
        // Polling is best-effort; the next tick retries.
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [phase, active, advancing, bootstrapping, bootstrapResult, webFetch]);

  /* ------------------------------ rendering ------------------------------ */

  const credentialsValid = provider === 'manual'
    ? Boolean(sshHost.trim() && sshUsername.trim() && (sshAuth === 'key' ? sshKey.trim() : sshPassword))
    : Boolean(apiToken.trim());

  const renderProviderStep = () => {
    const cards: { id: SelectedProvider; title: string; description: string; automated: boolean }[] = [
      { id: 'hetzner', title: 'Hetzner Cloud', description: 'Create a new server automatically with an API token.', automated: true },
      { id: 'digitalocean', title: 'DigitalOcean', description: 'Create a new droplet automatically with an API token.', automated: true },
      { id: 'manual', title: 'Other / existing server', description: 'Any VPS or bare-metal box reachable over SSH.', automated: false },
    ];
    return (
      <div>
        <SectionHeading>Choose a provider</SectionHeading>
        <p style={{ fontSize: '13px', color: TEXT.secondary, margin: '0 0 14px', lineHeight: '1.5' }}>
          Allternit can create the server for you, or install on a machine you already have.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {cards.map((card) => {
            const selected = provider === card.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => { setProvider(card.id); setValidate({ state: 'idle' }); setStartError(null); }}
                style={{
                  textAlign: 'left',
                  padding: '16px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  background: selected ? 'var(--bg-secondary)' : 'transparent',
                  border: selected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', color: 'var(--accent-primary)' }}>
                  {card.automated ? <CloudArrowUp size={22} /> : <HardDrives size={22} />}
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{card.title}</span>
                </div>
                <div style={{ fontSize: '12px', color: TEXT.secondary, lineHeight: '1.5' }}>{card.description}</div>
                {card.automated && tokenConfigured(card.id) && (
                  <div style={{ marginTop: '10px', fontSize: '11px', fontWeight: 600, color: STATUS.success }}>
                    Token saved
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button type="button" disabled={!provider} onClick={() => setPhase('credentials')} className={QUIET_BUTTON_CLASS}>
            Continue
          </button>
          <button type="button" onClick={resetWizard} className={QUIET_BUTTON_CLASS}>
            Cancel
          </button>
        </div>
      </div>
    );
  };

  const renderValidateRow = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
      <button
        type="button"
        disabled={!credentialsValid || validate.state === 'checking'}
        onClick={() => void validateCredentials()}
        className={QUIET_BUTTON_CLASS}
      >
        {validate.state === 'checking' ? <CircleNotch size={16} className="animate-spin" /> : null}
        {validate.state === 'checking' ? 'Validating…' : 'Validate'}
      </button>
      {validate.state === 'ok' && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: STATUS.success }}>
          <CheckCircle size={15} weight="fill" /> {validate.message}
        </span>
      )}
      {validate.state === 'fail' && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: STATUS.error }}>
          <Warning size={15} weight="fill" /> {validate.message}
        </span>
      )}
    </div>
  );

  const renderCredentialsStep = () => {
    if (provider === 'manual') {
      return (
        <div>
          <SectionHeading>Server access</SectionHeading>
          <p style={{ fontSize: '13px', color: TEXT.secondary, margin: '0 0 14px', lineHeight: '1.5' }}>
            Allternit signs in over SSH once to validate access, then again to install the runtime.
            Credentials are sent to the Allternit API and never shown again.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={LABEL_STYLE} htmlFor="ci-ssh-host">Host</label>
              <input id="ci-ssh-host" value={sshHost} onChange={(e) => setSshHost(e.target.value)}
                placeholder="203.0.113.10" autoComplete="off" style={INPUT_STYLE} />
            </div>
            <div>
              <label style={LABEL_STYLE} htmlFor="ci-ssh-port">Port</label>
              <input id="ci-ssh-port" value={sshPort} onChange={(e) => setSshPort(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="22" inputMode="numeric" autoComplete="off" style={INPUT_STYLE} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={LABEL_STYLE} htmlFor="ci-ssh-user">Username</label>
              <input id="ci-ssh-user" value={sshUsername} onChange={(e) => setSshUsername(e.target.value)}
                placeholder="root" autoComplete="off" style={INPUT_STYLE} />
            </div>
            <div>
              <label style={LABEL_STYLE} htmlFor="ci-instance-name">Instance name (optional)</label>
              <input id="ci-instance-name" value={instanceName} onChange={(e) => setInstanceName(e.target.value)}
                placeholder="my-server" autoComplete="off" style={INPUT_STYLE} />
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <span style={LABEL_STYLE}>Authentication</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['key', 'password'] as const).map((mode) => (
                <button key={mode} type="button" onClick={() => setSshAuth(mode)} className={QUIET_BUTTON_CLASS}
                  style={sshAuth === mode ? { borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' } : undefined}>
                  {mode === 'key' ? 'Private key' : 'Password'}
                </button>
              ))}
            </div>
          </div>
          {sshAuth === 'key' ? (
            <div style={{ marginBottom: '12px' }}>
              <label style={LABEL_STYLE} htmlFor="ci-ssh-key">Private key (PEM or OpenSSH)</label>
              <textarea id="ci-ssh-key" value={sshKey} onChange={(e) => setSshKey(e.target.value)}
                rows={4} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" autoComplete="off" spellCheck={false}
                style={{ ...INPUT_STYLE, fontFamily: 'ui-monospace, monospace', resize: 'vertical' }} />
            </div>
          ) : (
            <div style={{ marginBottom: '12px' }}>
              <label style={LABEL_STYLE} htmlFor="ci-ssh-password">Password</label>
              <input id="ci-ssh-password" type="password" value={sshPassword} onChange={(e) => setSshPassword(e.target.value)}
                autoComplete="new-password" style={INPUT_STYLE} />
            </div>
          )}
          {renderValidateRow()}
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button type="button" onClick={() => setPhase('provider')} className={QUIET_BUTTON_CLASS}>
              <ArrowLeft size={15} /> Back
            </button>
            <button type="button" disabled={!credentialsValid || starting} onClick={() => void startDeployment()} className={QUIET_BUTTON_CLASS}>
              {starting ? 'Starting…' : 'Start deployment'}
            </button>
          </div>
        </div>
      );
    }

    const automated = provider as AutomatedProvider;
    return (
      <div>
        <SectionHeading>{PROVIDER_LABEL[automated]} API token</SectionHeading>
        <p style={{ fontSize: '13px', color: TEXT.secondary, margin: '0 0 14px', lineHeight: '1.5' }}>
          Paste a read/write API token. It is used to create the server and is never displayed again.
          {tokenConfigured(automated) ? ' You already have a token saved for this provider; the wizard still needs it pasted here.' : ''}
        </p>
        <div style={{ marginBottom: '12px' }}>
          <label style={LABEL_STYLE} htmlFor="ci-api-token">API token</label>
          <input id="ci-api-token" type="password" value={apiToken}
            onChange={(e) => { setApiToken(e.target.value); setValidate({ state: 'idle' }); }}
            autoComplete="off" style={INPUT_STYLE} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-primary)', marginBottom: '12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={saveToken} onChange={(e) => setSaveToken(e.target.checked)} />
          Save this token for later deployments
        </label>
        {renderValidateRow()}
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button type="button" onClick={() => setPhase('provider')} className={QUIET_BUTTON_CLASS}>
            <ArrowLeft size={15} /> Back
          </button>
          <button type="button" disabled={!credentialsValid} onClick={() => setPhase('config')} className={QUIET_BUTTON_CLASS}>
            Continue
          </button>
        </div>
      </div>
    );
  };

  const renderConfigStep = () => {
    const automated = (provider ?? 'hetzner') as AutomatedProvider;
    const defaults = PROVIDER_DEFAULTS[automated] ?? PROVIDER_DEFAULTS.hetzner;
    return (
      <div>
        <SectionHeading>Server configuration</SectionHeading>
        <p style={{ fontSize: '13px', color: TEXT.secondary, margin: '0 0 14px', lineHeight: '1.5' }}>
          Leave a field empty to use the default shown.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={LABEL_STYLE} htmlFor="ci-cfg-name">Instance name</label>
            <input id="ci-cfg-name" value={instanceName} onChange={(e) => setInstanceName(e.target.value)}
              placeholder="allternit-instance" autoComplete="off" style={INPUT_STYLE} />
          </div>
          <div>
            <label style={LABEL_STYLE} htmlFor="ci-cfg-storage">Storage (GB)</label>
            <input id="ci-cfg-storage" value={storageGb} onChange={(e) => setStorageGb(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="50" inputMode="numeric" autoComplete="off" style={INPUT_STYLE} />
          </div>
          <div>
            <label style={LABEL_STYLE} htmlFor="ci-cfg-region">Region</label>
            <input id="ci-cfg-region" value={region} onChange={(e) => setRegion(e.target.value)}
              placeholder={defaults.region} autoComplete="off" style={INPUT_STYLE} />
          </div>
          <div>
            <label style={LABEL_STYLE} htmlFor="ci-cfg-type">Instance type</label>
            <input id="ci-cfg-type" value={instanceType} onChange={(e) => setInstanceType(e.target.value)}
              placeholder={defaults.instanceType} autoComplete="off" style={INPUT_STYLE} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button type="button" onClick={() => setPhase('credentials')} className={QUIET_BUTTON_CLASS}>
            <ArrowLeft size={15} /> Back
          </button>
          <button type="button" disabled={starting} onClick={() => void startDeployment()} className={QUIET_BUTTON_CLASS}>
            {starting ? 'Starting…' : 'Start deployment'}
          </button>
        </div>
      </div>
    );
  };

  const renderRunStep = () => {
    if (!active) return null;
    const isManual = active.context.provider === 'manual';
    const rank = STEP_RANK[active.current_step];
    const failed = active.current_step === 'Failed';
    const cancelled = active.current_step === 'Cancelled';

    const items: { key: string; label: string; itemRank: number }[] = [
      { key: 'validate', label: 'Validate credentials', itemRank: STEP_RANK.ValidateCredentials },
      { key: 'preflight', label: 'Preflight checks', itemRank: STEP_RANK.Preflight },
      { key: 'provision', label: isManual ? 'Connect to server' : 'Provision server', itemRank: STEP_RANK.Provisioning },
      { key: 'bootstrap', label: 'Install Allternit & join the mesh', itemRank: STEP_RANK.Bootstrap },
    ];

    return (
      <div>
        <SectionHeading>{sessionTitle(active)}</SectionHeading>
        <p style={{ fontSize: '13px', color: TEXT.secondary, margin: '0 0 14px', lineHeight: '1.5' }}>
          {PROVIDER_LABEL[active.context.provider ?? 'manual'] ?? 'Deployment'}
          {active.context.instance_ip ? ` · ${active.context.instance_ip}` : ''}
          {` · ${stepLabel(active.current_step)}`}
        </p>

        {bootstrapResult ? (
          <div
            style={{
              padding: '18px',
              borderRadius: '10px',
              background: 'var(--status-success-bg, rgba(34,197,94,0.12))',
              border: '1px solid rgba(34,197,94,0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: STATUS.success, fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>
              <CheckCircle size={20} weight="fill" />
              {bootstrapResult.instance_name} is online
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.8' }}>
              <div>Mesh IP: <code style={{ fontFamily: 'ui-monospace, monospace' }}>{bootstrapResult.mesh_ip}</code></div>
              <div>Runtime URL: <code style={{ fontFamily: 'ui-monospace, monospace' }}>{bootstrapResult.url}</code></div>
            </div>
            <div style={{ marginTop: '14px' }}>
              <button type="button" onClick={resetWizard} className={QUIET_BUTTON_CLASS}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '16px' }}>
              {items.map((item) => {
                const done = active.current_step === 'Complete' || rank > item.itemRank;
                const isActive = !failed && !cancelled && rank === item.itemRank && (advancing || bootstrapping);
                const isFailed = failed && item.key === 'bootstrap';
                return (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', fontSize: '13px' }}>
                    <span style={{ width: '20px', display: 'grid', placeItems: 'center', flex: 'none' }}>
                      {done ? (
                        <CheckCircle size={17} weight="fill" style={{ color: STATUS.success }} />
                      ) : isFailed ? (
                        <Warning size={17} weight="fill" style={{ color: STATUS.error }} />
                      ) : isActive ? (
                        <CircleNotch size={17} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
                      ) : (
                        <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: 'var(--border-subtle)' }} />
                      )}
                    </span>
                    <span style={{ color: done || isActive ? 'var(--text-primary)' : TEXT.secondary }}>{item.label}</span>
                  </div>
                );
              })}
            </div>

            {runError && (
              <div style={ERROR_BANNER_STYLE}>
                <Warning size={18} weight="fill" />
                <span style={{ flex: 1 }}>{runError}</span>
              </div>
            )}
            {bootstrapError && (
              <div style={ERROR_BANNER_STYLE}>
                <Warning size={18} weight="fill" />
                <span style={{ flex: 1 }}>
                  {bootstrapError.message}
                  {bootstrapError.recoverable ? ' (recoverable — fix the issue and start a new deployment)' : ''}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {runError && (
                <button type="button" disabled={advancing} onClick={() => void runAdvanceLoop(active)} className={QUIET_BUTTON_CLASS}>
                  {advancing ? 'Retrying…' : 'Retry step'}
                </button>
              )}
              {active.current_step === 'Bootstrap' && !bootstrapError && (
                <button type="button" disabled={bootstrapping} onClick={() => void runBootstrap()} className={QUIET_BUTTON_CLASS}>
                  {bootstrapping ? <CircleNotch size={16} className="animate-spin" /> : null}
                  {bootstrapping ? 'Installing… this can take several minutes' : 'Install Allternit'}
                </button>
              )}
              {(failed || cancelled || bootstrapError) && (
                <button type="button" onClick={resetWizard} className={QUIET_BUTTON_CLASS}>
                  Back to deployments
                </button>
              )}
              {!cancelled && active.current_step !== 'Complete' && (
                <button type="button" disabled={cancelling} onClick={() => void cancelSession(active.deployment_id)} className={DESTRUCTIVE_BUTTON_CLASS}>
                  {cancelling ? 'Cancelling…' : 'Cancel deployment'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Header card */}
      <div
        style={{
          marginBottom: '24px',
          padding: '24px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(37,37,37,0.6) 0%, rgba(37,37,37,0.3) 100%)',
          border: '1px solid var(--ui-border-muted)',
        }}
      >
        <SectionHeading className="mb-2">Cloud instances</SectionHeading>
        <p style={{ fontSize: '14px', color: TEXT.secondary, margin: 0, lineHeight: '1.5' }}>
          Deploy an Allternit runtime to your own server — create one automatically on Hetzner or
          DigitalOcean, or install on any machine you can reach over SSH.
        </p>
      </div>

      {sessionsError && (
        <div style={ERROR_BANNER_STYLE}>
          <Warning size={18} weight="fill" />
          <span style={{ flex: 1 }}>{sessionsError}</span>
          <button type="button" onClick={() => setSessionsError(null)} className={QUIET_BUTTON_CLASS}>Dismiss</button>
        </div>
      )}

      {/* Wizard */}
      <div style={CARD_STYLE}>
        {!wizardOpen ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <SectionHeading className="mb-0">New deployment</SectionHeading>
              <p style={{ fontSize: '13px', color: TEXT.secondary, margin: '6px 0 0', lineHeight: '1.5' }}>
                Provision a server, install the runtime, and join it to your mesh in one flow.
              </p>
            </div>
            <button type="button" onClick={() => setWizardOpen(true)} className={QUIET_BUTTON_CLASS}>
              <CloudArrowUp size={16} />
              Deploy a new instance
            </button>
          </div>
        ) : (
          <>
            {startError && phase !== 'run' && (
              <div style={ERROR_BANNER_STYLE}>
                <Warning size={18} weight="fill" />
                <span style={{ flex: 1 }}>{startError}</span>
              </div>
            )}
            {phase === 'provider' && renderProviderStep()}
            {phase === 'credentials' && renderCredentialsStep()}
            {phase === 'config' && renderConfigStep()}
            {phase === 'run' && renderRunStep()}
          </>
        )}
      </div>

      {/* Existing sessions */}
      <div style={CARD_STYLE}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <SectionHeading className="mb-0">Deployments</SectionHeading>
          <button type="button" onClick={() => void loadSessions()} disabled={sessionsLoading} className={QUIET_BUTTON_CLASS}>
            <ArrowClockwise size={16} className={cn(sessionsLoading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {!sessionsLoading && sessions.length === 0 && !sessionsError && (
          <p style={{ fontSize: '13px', color: TEXT.secondary, margin: '12px 0 4px' }}>
            No deployments yet.
          </p>
        )}

        {sessions.map((session) => {
          const terminal = TERMINAL.has(session.current_step);
          return (
            <div
              key={session.deployment_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 0',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '9px',
                  background: 'var(--bg-secondary)',
                  color: 'var(--accent-primary)',
                  flex: 'none',
                }}
              >
                {session.context.provider === 'manual' ? <HardDrives size={19} /> : <CloudArrowUp size={19} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sessionTitle(session)}
                </div>
                <div style={{ fontSize: '12px', color: TEXT.secondary }}>
                  {PROVIDER_LABEL[session.context.provider ?? 'manual'] ?? 'Deployment'}
                  {session.context.instance_ip ? ` · ${session.context.instance_ip}` : ''}
                  {` · ${formatDate(session.timestamps.created_at)}`}
                </div>
              </div>
              <span
                style={{
                  flex: 'none',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: session.current_step === 'Complete'
                    ? STATUS.success
                    : session.current_step === 'Failed' || session.current_step === 'Cancelled'
                      ? STATUS.error
                      : TEXT.secondary,
                  background: session.current_step === 'Complete'
                    ? 'var(--status-success-bg, rgba(34,197,94,0.12))'
                    : 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {stepLabel(session.current_step)}
              </span>
              {!terminal && (
                <button type="button" onClick={() => resumeSession(session)} className={QUIET_BUTTON_CLASS}>
                  Resume
                </button>
              )}
              {!terminal && (
                <button type="button" disabled={cancelling} onClick={() => void cancelSession(session.deployment_id)} className={QUIET_BUTTON_CLASS}>
                  Cancel
                </button>
              )}
              {terminal && (
                <button type="button" onClick={() => void deleteSession(session.deployment_id)} className={DESTRUCTIVE_BUTTON_CLASS}>
                  <Trash size={15} />
                  Delete
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Saved provider tokens */}
      <div style={CARD_STYLE}>
        <SectionHeading>Saved provider tokens</SectionHeading>
        <p style={{ fontSize: '13px', color: TEXT.secondary, margin: '0 0 8px', lineHeight: '1.5' }}>
          Tokens saved with “Save this token for later deployments” are validated by the provider and
          stored encrypted. They are never displayed again.
        </p>

        {tokensError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: STATUS.error, fontSize: '13px', padding: '12px 0' }}>
            <Warning size={16} weight="fill" />
            <span>{tokensError}</span>
          </div>
        )}

        {tokens.length === 0 && !tokensError && (
          <p style={{ fontSize: '13px', color: TEXT.secondary, margin: '12px 0 4px' }}>Loading…</p>
        )}

        {tokens.map((entry) => (
          <div
            key={entry.provider}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 0',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {PROVIDER_LABEL[entry.provider] ?? entry.provider}
              </div>
              <div style={{ fontSize: '12px', color: TEXT.secondary }}>
                {entry.configured ? 'Token saved' : 'No token saved'}
              </div>
            </div>
            {entry.configured && (
              <button
                type="button"
                disabled={deletingToken === entry.provider}
                onClick={() => void deleteToken(entry.provider)}
                className={DESTRUCTIVE_BUTTON_CLASS}
              >
                <Trash size={15} />
                {deletingToken === entry.provider ? 'Deleting…' : 'Delete token'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default CloudInstancesPanel;
