import {
  BrowserEventSchema,
  BrowserObservationSchema,
  COMPUTER_USE_PROTOCOL_VERSION,
  type ActionIntent,
  type BrowserEvent,
  type BrowserObservation,
  type BrowserProvider,
  type ProviderCapabilities,
} from '@allternit/computer-use-protocol';
import {
  clickViaPlaywright,
  hoverViaPlaywright,
  navigateViaPlaywright,
  pressKeyViaPlaywright,
  typeViaPlaywright,
  waitForViaPlaywright,
} from '../browser/playwright/actions.js';
import { snapshotRoleViaPlaywright } from '../browser/playwright/snapshot.js';
import {
  defaultRecordingsRoot,
  finalizeVideoRecording,
  prepareVideoRecording,
  recordVideoOptions,
  type FinalizedVideo,
} from './video-recorder.js';

export interface LocalBrowserSessionBinding {
  sessionId: string;
  cdpUrl: string;
  targetId: string;
}

export interface StartRecordedSessionInput {
  sessionId: string;
  cdpUrl: string;
  /** Recording/run id used to name the artifact (<id>.webm in recordingsRoot). */
  recordingId?: string;
  recordingsRoot?: string;
  size?: { width: number; height: number };
}

export interface StartedRecordedSession {
  binding: LocalBrowserSessionBinding;
  startedAtEpoch: number;
}

interface RecordedSessionHandle {
  browser: import('playwright').Browser;
  context: import('playwright').BrowserContext;
  artifactName: string;
  recordingsRoot: string;
  startedAtEpoch: number;
}

export class LocalPlaywrightProvider implements BrowserProvider {
  readonly capabilities: ProviderCapabilities = {
    provider: 'local-playwright',
    capabilities: [
      'navigate', 'observe.dom', 'observe.accessibility', 'observe.screenshot',
      'interact.pointer', 'interact.keyboard', 'tabs', 'frames', 'dialogs',
      'files.upload', 'files.download', 'network.inspect', 'console.inspect',
      'record', 'replay',
    ],
    local: true,
    attachedToUserSession: false,
    supportsPrivateNetwork: true,
    supportsPersistentProfile: true,
    limits: { maxObservationChars: 32_000 },
  };

  private readonly bindings = new Map<string, LocalBrowserSessionBinding>();
  private readonly refs = new Map<string, Record<string, string>>();
  private readonly sequences = new Map<string, number>();
  private readonly recordedSessions = new Map<string, RecordedSessionHandle>();
  private readonly finalizedVideos = new Map<string, FinalizedVideo>();

  bind(binding: LocalBrowserSessionBinding): void {
    this.bindings.set(binding.sessionId, binding);
  }

  getBinding(sessionId: string): LocalBrowserSessionBinding | undefined {
    return this.bindings.get(sessionId);
  }

  /**
   * Bind the session to a fresh Playwright-created context with video
   * recording. Only Playwright-created contexts support recordVideo, so this
   * replaces any existing binding for the session. Works over CDP-attach
   * connections (verified on playwright 1.58.2); the profile's own
   * externally-created tab keeps running but is no longer the bound target.
   */
  async startRecordedSession(input: StartRecordedSessionInput): Promise<StartedRecordedSession> {
    const { chromium } = await import('playwright');
    const recordingsRoot = input.recordingsRoot ?? defaultRecordingsRoot();
    const artifactName = input.recordingId ?? input.sessionId;
    const browser = await chromium.connectOverCDP(input.cdpUrl);
    try {
      const start = await prepareVideoRecording(recordingsRoot, artifactName);
      const context = await browser.newContext(recordVideoOptions(start, input.size));
      const page = await context.newPage();
      // The CDP action primitives resolve "the page" as the first context
      // with pages; close the profile tab so the recorded tab is unambiguous
      // (the session binding is re-pointed at it below regardless).
      for (const other of browser.contexts()) {
        if (other === context) continue;
        for (const existing of other.pages()) await existing.close().catch(() => {});
      }
      this.recordedSessions.set(input.sessionId, {
        browser,
        context,
        artifactName,
        recordingsRoot,
        startedAtEpoch: start.startedAtEpoch,
      });
      // targetId is a page URL in this binding's convention; pageIdentity
      // falls back to the first page when no URL matches.
      this.bind({ sessionId: input.sessionId, cdpUrl: input.cdpUrl, targetId: page.url() });
      return {
        binding: this.requireBinding(input.sessionId),
        startedAtEpoch: start.startedAtEpoch,
      };
    } catch (error) {
      await browser.close().catch(() => {});
      throw error;
    }
  }

  getRecordedSessionStart(sessionId: string): number | undefined {
    return this.recordedSessions.get(sessionId)?.startedAtEpoch;
  }

  hasRecordedSession(sessionId: string): boolean {
    return this.recordedSessions.has(sessionId);
  }

  /**
   * Stop the session's video recording: closing the context finalizes the
   * .webm, which is then moved to <recordingsRoot>/<artifactName>.webm.
   */
  async stopRecordedSession(sessionId: string): Promise<FinalizedVideo | null> {
    const handle = this.recordedSessions.get(sessionId);
    if (!handle) return null;
    this.recordedSessions.delete(sessionId);
    try {
      const video = handle.context.pages()[0]?.video() ?? null;
      await handle.context.close();
      const stagedPath = video ? await video.path() : null;
      if (!stagedPath) return null;
      const finalized = await finalizeVideoRecording(
        stagedPath,
        handle.recordingsRoot,
        handle.artifactName,
        handle.startedAtEpoch,
      );
      this.finalizedVideos.set(sessionId, finalized);
      return finalized;
    } finally {
      await handle.browser.close().catch(() => {});
    }
  }

  /** Artifact metadata for a finalized recording, when stop has run. */
  getVideoArtifact(sessionId: string): FinalizedVideo | undefined {
    return this.finalizedVideos.get(sessionId);
  }

  async observe(sessionId: string): Promise<BrowserObservation> {
    const binding = this.requireBinding(sessionId);
    const result = await snapshotRoleViaPlaywright({
      cdpUrl: binding.cdpUrl,
      targetId: binding.targetId,
      refsMode: 'role',
      options: { compact: true, maxDepth: 12 },
    });
    this.refs.set(sessionId, result.refs);
    const page = await this.pageIdentity(binding);
    return BrowserObservationSchema.parse({
      schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
      observationId: crypto.randomUUID(),
      sessionId,
      url: page.url,
      title: page.title,
      capturedAt: new Date().toISOString(),
      format: 'accessibility',
      text: result.snapshot.slice(0, this.capabilities.limits?.maxObservationChars),
      refs: Object.entries(result.refs).map(([ref, selector]) => ({
        ref, role: 'unknown', name: '', selector,
      })),
      truncated: result.snapshot.length > (this.capabilities.limits?.maxObservationChars ?? Infinity),
    });
  }

  async execute(action: ActionIntent): Promise<BrowserEvent[]> {
    const binding = this.requireBinding(action.sessionId);
    const events: BrowserEvent[] = [];
    events.push(this.event(action, 'action.state_changed', { actionId: action.actionId, state: 'executing' }));
    try {
      await this.dispatch(binding, action);
      events.push(this.event(action, 'action.state_changed', { actionId: action.actionId, state: 'committed' }));
      return events;
    } catch (error) {
      events.push(this.event(action, 'action.state_changed', {
        actionId: action.actionId,
        state: 'failed',
        error: error instanceof Error ? error.message : String(error),
      }));
      return events;
    }
  }

  async close(sessionId: string): Promise<void> {
    this.bindings.delete(sessionId);
    this.refs.delete(sessionId);
    this.sequences.delete(sessionId);
  }

  private async dispatch(binding: LocalBrowserSessionBinding, action: ActionIntent): Promise<void> {
    const common = { cdpUrl: binding.cdpUrl, targetId: binding.targetId };
    const selector = action.targetRef ? this.refs.get(action.sessionId)?.[action.targetRef] : undefined;
    switch (action.kind) {
      case 'navigate':
        return navigateViaPlaywright({ ...common, url: this.stringInput(action, 'url') });
      case 'click':
        return clickViaPlaywright({ ...common, ref: action.targetRef ?? '', selector });
      case 'type':
        return typeViaPlaywright({
          ...common,
          ref: action.targetRef ?? '',
          selector,
          text: this.stringInput(action, 'text'),
          submit: action.input.submit === true,
        });
      case 'hover':
        return hoverViaPlaywright({ ...common, ref: action.targetRef ?? '', selector });
      case 'press':
        return pressKeyViaPlaywright({ ...common, key: this.stringInput(action, 'key') });
      case 'wait':
        return waitForViaPlaywright({
          ...common,
          timeMs: typeof action.input.timeMs === 'number' ? action.input.timeMs : undefined,
          selector: typeof action.input.selector === 'string' ? action.input.selector : undefined,
          loadState: action.input.loadState as 'load' | 'domcontentloaded' | 'networkidle' | undefined,
        });
      default:
        throw new Error(`Local provider action not implemented: ${action.kind}`);
    }
  }

  private event(action: ActionIntent, type: BrowserEvent['type'], payload: Record<string, unknown>): BrowserEvent {
    const sequence = (this.sequences.get(action.runId) ?? 0) + 1;
    this.sequences.set(action.runId, sequence);
    return BrowserEventSchema.parse({
      schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
      eventId: crypto.randomUUID(),
      runId: action.runId,
      sessionId: action.sessionId,
      sequence,
      emittedAt: new Date().toISOString(),
      type,
      payload,
    });
  }

  private requireBinding(sessionId: string): LocalBrowserSessionBinding {
    const binding = this.bindings.get(sessionId);
    if (!binding) throw new Error(`No local browser binding for session ${sessionId}`);
    return binding;
  }

  private stringInput(action: ActionIntent, field: string): string {
    const value = action.input[field];
    if (typeof value !== 'string' || !value) throw new Error(`Action ${action.actionId} requires input.${field}`);
    return value;
  }

  private async pageIdentity(binding: LocalBrowserSessionBinding): Promise<{ url: string; title: string }> {
    const { chromium } = await import('playwright');
    const browser = await chromium.connectOverCDP(binding.cdpUrl);
    try {
      const pages = browser.contexts().flatMap((context) => context.pages());
      const page = pages.find((candidate) => candidate.url() === binding.targetId) ?? pages[0];
      if (!page) throw new Error('Page not found');
      return { url: page.url(), title: await page.title() };
    } finally {
      await browser.close();
    }
  }
}
