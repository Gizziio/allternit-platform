"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle,
  CircleDashed,
  Link,
  Pause,
  Play,
  ArrowsClockwise,
  WifiHigh as Router,
  GearSix,
  ShieldWarning,
  Square,
  Plugs as Unplug,
  Waves,
  XCircle,
} from '@phosphor-icons/react';
import { useBrowserAgentStore } from './browserAgent.store';
import { getComputerUsePortLabel } from '@/integration/computer-use-engine';
import { BACKGROUND, SAND, STATUS, TEXT } from '@/design/allternit.tokens';

function toneForStatus(status: string): { bg: string; border: string; text: string } {
  switch (status) {
    case 'Running':
      return {
        bg: `${STATUS.success}24`,
        border: `${STATUS.success}4c`,
        text: '#bbf7d0',
      };
    case 'WaitingApproval':
      return {
        bg: 'rgba(217,119,6,0.16)',
        border: `${STATUS.warning}4c`,
        text: '#fde68a',
      };
    case 'Blocked':
      return {
        bg: 'rgba(185,28,28,0.14)',
        border: '#ef444442',
        text: '#fecaca',
      };
    case 'Done':
      return {
        bg: `${STATUS.info}1f`,
        border: `${STATUS.info}3d`,
        text: '#bfdbfe',
      };
    default:
      return {
        bg: 'rgba(148,163,184,0.12)',
        border: 'rgba(148,163,184,0.22)',
        text: '#cbd5e1',
      };
  }
}

function endpointOptionValue(
  endpoint: ReturnType<typeof useBrowserAgentStore.getState>['endpoint'],
): string {
  if (!endpoint) {
    return 'detached';
  }
  if (endpoint.type === 'platform_webview') {
    return `platform_webview:${endpoint.tabId}`;
  }
  return endpoint.type === 'extension'
    ? `extension:${endpoint.endpointId}`
    : `shell:${endpoint.sessionId}`;
}

export function BrowserAttachStrip() {
  const {
    status,
    mode,
    endpoint,
    connectedEndpoints,
    currentRunId,
    currentLayer,
    currentAdapterId,
    fallbackCount,
    lastEventMessage,
    runSummary,
    requiresApproval,
    approvalActionSummary,
    engineBaseUrl,
    engineHealthy,
    engineStatusMessage,
    engineRuntimeSource,
    engineRuntimeStatus,
    setEndpoint,
    setEngineBaseUrl,
    refreshEngineHealth,
    approveAction,
    denyAction,
    stopExecution,
    pauseExecution,
    resumeExecution,
    takeOver,
    handOff,
  } = useBrowserAgentStore();

  const [editingBaseUrl, setEditingBaseUrl] = useState(false);
  const [draftBaseUrl, setDraftBaseUrl] = useState(engineBaseUrl);
  const statusTone = toneForStatus(status);

  useEffect(() => {
    setDraftBaseUrl(engineBaseUrl);
  }, [engineBaseUrl]);

  useEffect(() => {
    void refreshEngineHealth();
    const interval = window.setInterval(() => {
      void refreshEngineHealth();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [refreshEngineHealth]);

  const attachLabel = useMemo(() => {
    if (!endpoint) {
      return 'Detached engine session';
    }
    if (endpoint.type === 'platform_webview') {
      return endpoint.label ?? 'Attached to this browser view';
    }
    if (endpoint.type === 'extension') {
      return `Attached to tab ${endpoint.tabId}`;
    }
    return `Attached to shell ${endpoint.sessionId}`;
  }, [endpoint]);

  const enginePort = useMemo(() => getComputerUsePortLabel(engineBaseUrl), [engineBaseUrl]);

  return (
    <div
      data-testid="browser-attach-strip"
      className="border-b"
      style={{
        borderColor: `${SAND[500]}24`,
        background:
          'linear-gradient(180deg, rgba(18,18,18,0.96) 0%, rgba(28,24,21,0.94) 100%)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) auto',
          gap: 12,
          alignItems: 'center',
          padding: '10px 14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 10px',
              borderRadius: 999,
              background: statusTone.bg,
              border: `1px solid ${statusTone.border}`,
              color: statusTone.text,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.02em',
              flexShrink: 0,
            }}
          >
            <CircleDashed size={12} />
            {status}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 9px',
                borderRadius: 999,
                background: endpoint ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.12)',
                border: endpoint
                  ? '1px solid rgba(52,211,153,0.22)'
                  : '1px solid rgba(148,163,184,0.18)',
                color: endpoint ? '#a7f3d0' : '#cbd5e1',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {endpoint ? <Link size={12} /> : <Unplug size={12} />}
              {attachLabel}
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 9px',
                borderRadius: 999,
                background: `${SAND[500]}14`,
                border: `1px solid ${SAND[500]}2e`,
                color: '#e7d3bf',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              <Router size={12} />
              {mode} · {currentLayer ?? 'route pending'}
            </div>

            {fallbackCount > 0 && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 9px',
                  borderRadius: 999,
                  background: `${STATUS.info}1f`,
                  border: `1px solid ${STATUS.info}33`,
                  color: '#bfdbfe',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                <Waves size={12} />
                {fallbackCount} fallback{fallbackCount === 1 ? '' : 's'}
              </div>
            )}
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#f5efe8',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {approvalActionSummary ?? runSummary ?? lastEventMessage ?? 'Browser engine ready'}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 4,
              flexWrap: 'wrap',
              color: '#97826f',
              fontSize: 11,
            }}
          >
            <span>{currentRunId ? `Run ${currentRunId.slice(-8)}` : 'No active run'}</span>
            <span>{currentAdapterId ?? 'adapter pending'}</span>
            <span>
              {(engineRuntimeSource as any) === 'managed'
                ? 'managed engine'
                : (engineRuntimeSource as any) === 'external'
                  ? 'external engine'
                  : 'engine source pending'}
            </span>
            <span>{engineHealthy === false ? 'engine offline' : 'engine online'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <select
            aria-label="Browser attach target"
            value={endpointOptionValue(endpoint)}
            onChange={(event) => {
              const value = event.target.value;
              if (value === 'detached') {
                setEndpoint(null);
                return;
              }
              const [kind, id] = value.split(':');
              const match = connectedEndpoints.find((entry) =>
                kind === 'platform_webview'
                  ? entry.type === 'platform_webview' && String(entry.tabId) === id
                  : kind === 'extension'
                    ? entry.type === 'extension' && entry.endpointId === id
                    : entry.type === 'shell_browser' && entry.sessionId === id,
              );
              setEndpoint(match ?? null);
            }}
            style={{
              minWidth: 170,
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: '#f3ede5',
              fontSize: 12,
            }}
          >
            <option value="detached">Detached engine session</option>
            {connectedEndpoints.map((entry) => (
              <option
                key={
                  entry.type === 'extension'
                    ? entry.endpointId
                    : entry.type === 'platform_webview'
                      ? `platform-${entry.tabId}`
                      : entry.sessionId
                }
                value={endpointOptionValue(entry)}
              >
                {entry.type === 'extension'
                  ? `Extension tab ${entry.tabId}`
                  : entry.type === 'platform_webview'
                    ? (entry.label ?? 'This browser view')
                    : `Shell browser ${entry.sessionId}`}
              </option>
            ))}
          </select>

          {editingBaseUrl ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                aria-label="Computer use engine base url"
                value={draftBaseUrl}
                onChange={(event) => setDraftBaseUrl(event.target.value)}
                style={{
                  width: 180,
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: `1px solid ${SAND[500]}40`,
                  background: 'rgba(0,0,0,0.28)',
                  color: '#f8f3ed',
                  fontSize: 12,
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setEngineBaseUrl(draftBaseUrl);
                  void refreshEngineHealth();
                  setEditingBaseUrl(false);
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(52,211,153,0.22)',
                  background: 'rgba(16,185,129,0.12)',
                  color: '#a7f3d0',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Save
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingBaseUrl(true)}
              title={engineStatusMessage ?? engineBaseUrl}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 10px',
                borderRadius: 10,
                border: `1px solid ${SAND[500]}2e`,
                background: 'rgba(255,255,255,0.04)',
                color: engineHealthy === false ? '#fca5a5' : '#f3ddc6',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <GearSix size={13} />
              {(engineRuntimeSource as any) === 'managed' ? 'Managed' : (engineRuntimeSource as any) === 'external' ? 'External' : 'Engine'} {enginePort}
            </button>
          )}

          <button
            type="button"
            onClick={() => void refreshEngineHealth()}
            title={engineRuntimeStatus ?? 'Refresh engine status'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: '#d7c7b8',
            }}
          >
            <ArrowsClockwise size={13} />
          </button>

          {requiresApproval ? (
            <>
              <button
                type="button"
                onClick={() => void approveAction()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(52,211,153,0.22)',
                  background: 'rgba(16,185,129,0.12)',
                  color: '#a7f3d0',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <CheckCircle size={13} />
                Approve
              </button>
              <button
                type="button"
                onClick={() => void denyAction()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(239,68,68,0.38)',
                  background: 'rgba(185,28,28,0.12)',
                  color: '#fecaca',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <XCircle size={13} />
                Deny
              </button>
            </>
          ) : status === 'Running' ? (
            <>
              <button
                type="button"
                onClick={() => void pauseExecution()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: `1px solid ${STATUS.info}33`,
                  background: `${STATUS.info}1f`,
                  color: '#bfdbfe',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <Pause size={13} />
                Pause
              </button>
              <button
                type="button"
                onClick={() => void stopExecution()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(239,68,68,0.38)',
                  background: 'rgba(185,28,28,0.12)',
                  color: '#fecaca',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <Square size={13} />
                Cancel
              </button>
            </>
          ) : status === 'Blocked' && currentRunId ? (
            <>
              <button
                type="button"
                onClick={() => void resumeExecution()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: `1px solid ${SAND[500]}38`,
                  background: `${SAND[500]}1f`,
                  color: '#f3ddc6',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <Play size={13} />
                Resume
              </button>
              <button
                type="button"
                onClick={() => void takeOver()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(250,204,21,0.2)',
                  background: 'rgba(202,138,4,0.12)',
                  color: '#fde68a',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <ShieldWarning size={13} />
                Take over
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void handOff()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 10px',
                borderRadius: 10,
                border: `1px solid ${SAND[500]}38`,
                background: `${SAND[500]}1f`,
                color: '#f3ddc6',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <Play size={13} />
              Hand off
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default BrowserAttachStrip;
