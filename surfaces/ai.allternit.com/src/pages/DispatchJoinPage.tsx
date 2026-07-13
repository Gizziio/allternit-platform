"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Check, Copy, DeviceMobile, Warning } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { claimDispatchToken } from '@/lib/dispatch/handoff';

const TOKEN_HEX_LENGTH = 48; // 24 bytes hex encoded

function isValidDispatchToken(token: string | null): token is string {
  return typeof token === 'string' && token.length === TOKEN_HEX_LENGTH && /^[0-9a-fA-F]+$/.test(token);
}

export default function DispatchJoinPage(): React.ReactNode {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const ts = searchParams.get('ts');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const sessionUrl = typeof window !== 'undefined' ? window.location.href : '';

  useEffect(() => {
    if (!isValidDispatchToken(token)) {
      setError('This Dispatch link is invalid or has expired.');
      return;
    }

    setError(null);

    // Claim the token so the desktop Dispatch view can detect that a phone
    // has scanned the QR code. In production this is backed by the Allternit API.
    let cancelled = false;
    setClaiming(true);
    claimDispatchToken(token)
      .then(() => {
        if (cancelled) return;
        setClaimed(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[DispatchJoin] Failed to claim token:', err);
      })
      .finally(() => {
        if (!cancelled) setClaiming(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, ts]);

  const handleCopy = async () => {
    if (!sessionUrl) return;
    try {
      await navigator.clipboard.writeText(sessionUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--bg-elevated)] p-6">
      <div className="w-full max-w-md rounded-3xl border border-solid border-[var(--border-default)] bg-[var(--bg-primary)] p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-6 text-[var(--text-primary)]">
          <span className="text-[22px] font-bold" style={{ fontFamily: 'var(--font-research, Georgia, serif)' }}>
            Dispatch
          </span>
          <span className="text-[12px] font-bold px-2 py-0.5 rounded-full bg-[var(--surface-hover)] text-[var(--shell-item-muted)] border border-solid border-[var(--border-subtle)]">
            Beta
          </span>
        </div>

        {error ? (
          <div className="flex items-start gap-3 rounded-2xl bg-[var(--status-error-bg)] border border-solid border-[var(--status-error)] p-4 mb-6">
            <Warning size={20} className="text-[var(--status-error)] shrink-0 mt-0.5" />
            <p className="m-0 text-[14px] text-[var(--status-error)]">{error}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center mb-6">
              <div className="size-16 rounded-2xl bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text-secondary)]">
                <DeviceMobile size={32} />
              </div>
            </div>

            <h1 className="text-[20px] font-bold text-[var(--text-primary)] m-0 mb-2 text-center">
              Join this Dispatch session
            </h1>
            <p className="text-[14px] text-[var(--text-tertiary)] m-0 mb-6 text-center leading-relaxed">
              You're about to hand off this session to another device. Make sure you trust the source.
            </p>

            <div className="rounded-xl bg-[var(--surface-hover)] border border-solid border-[var(--border-default)] p-3 mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] uppercase tracking-wider font-bold text-[var(--text-tertiary)]">Session token</span>
                <span className="text-[11px] text-[var(--text-tertiary)]">One-time use</span>
              </div>
              <code className="block text-[13px] text-[var(--text-secondary)] font-mono break-all">
                {token}
              </code>
            </div>

            {claiming && (
              <p className="text-[12px] text-[var(--text-tertiary)] text-center mb-4">
                Handing off to your computer…
              </p>
            )}
            {!claiming && claimed && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-[var(--status-success)]/15 text-[var(--status-success)] px-3 py-2 mb-4">
                <Check size={16} weight="bold" />
                <span className="text-[13px] font-medium">Desktop session notified</span>
              </div>
            )}
          </>
        )}

        <div className="flex flex-col gap-2.5">
          {!error && (
            <button
              type="button"
              onClick={() => navigate('/shell')}
              className="w-full py-3 rounded-2xl bg-[var(--text-primary)] text-[var(--bg-elevated)] text-[15px] font-semibold cursor-pointer border-none hover:opacity-90 transition-opacity"
            >
              Continue in Allternit
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            disabled={!sessionUrl}
            className={cn(
              'w-full py-3 rounded-2xl border text-[15px] font-semibold cursor-pointer transition-colors flex items-center justify-center gap-2',
              copied
                ? 'bg-green-500 border-green-500 text-white'
                : 'bg-transparent border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
            )}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? 'Copied link' : 'Copy link'}
          </button>
        </div>

        <p className="mt-6 text-[12px] text-[var(--text-tertiary)] text-center leading-relaxed">
          If the Allternit app is installed, this link will open it automatically. Otherwise you can continue in the browser.
        </p>
      </div>
    </div>
  );
}
