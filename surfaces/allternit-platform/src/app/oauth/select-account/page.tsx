'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useClerk, useAuth } from '@clerk/nextjs';
import { MatrixLogo } from '@/components/ai-elements/MatrixLogo';
import { Check, Plus } from 'lucide-react';

function initials(firstName?: string | null, lastName?: string | null, email?: string | null): string {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return '??';
}

function SelectAccountContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { client, setActive } = useClerk();
  const { sessionId: activeSessionId } = useAuth();

  const clientId = searchParams.get('client_id') ?? 'gizzi-code';
  const redirectUri = searchParams.get('redirect_uri') ?? '/shell';
  const oauthState = searchParams.get('state') ?? '';

  // Sessions from Clerk client — populated after hydration
  const sessions = client?.sessions ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [switching, setSwitching] = useState(false);

  // Default selection to the active session once sessions load
  useEffect(() => {
    if (sessions.length > 0 && selected === null) {
      setSelected(activeSessionId ?? sessions[0].id);
    }
  }, [sessions, activeSessionId, selected]);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  async function handleContinue() {
    if (!selected) return;
    setSwitching(true);
    try {
      // Switch to the chosen session before proceeding
      if (selected !== activeSessionId) {
        await setActive({ session: selected });
      }
      const session = sessions.find(s => s.id === selected);
      const email = session?.user?.primaryEmailAddress?.emailAddress ?? '';
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        state: oauthState,
        login_hint: email,
      });
      router.push(`/oauth/authorize?${params.toString()}`);
    } catch {
      setSwitching(false);
    }
  }

  function handleAddAccount() {
    const returnTo = `/oauth/select-account?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${oauthState}`;
    router.push(`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`);
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0A0806',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'inherit',
      padding: '24px 16px',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 400,
        background: 'radial-gradient(ellipse, rgba(217,119,87,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: '100%',
            maxWidth: 440,
            background: '#110E0B',
            borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{ padding: '36px 36px 24px', textAlign: 'center' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.4, type: 'spring', stiffness: 200 }}
              style={{ display: 'inline-block', marginBottom: 20 }}
            >
              <MatrixLogo state="idle" size={44} />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.35 }}
              style={{
                fontSize: 18, fontWeight: 700, color: '#F5EDE3',
                letterSpacing: '-0.02em', marginBottom: 8,
              }}
            >
              Choose an account
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.28, duration: 0.35 }}
              style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}
            >
              Select the account you&apos;d like to continue with
            </motion.p>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 0 8px' }} />

          {/* Account list */}
          <div style={{ padding: '8px 16px 4px' }}>
            {sessions.length === 0 ? (
              /* Loading skeleton */
              [0, 1].map(i => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
                  style={{
                    height: 62, borderRadius: 12, marginBottom: 4,
                    background: 'rgba(255,255,255,0.04)',
                  }}
                />
              ))
            ) : (
              sessions.map((session, i) => {
                const user = session.user;
                const email = user?.primaryEmailAddress?.emailAddress ?? '';
                const name = user?.fullName ?? user?.firstName ?? email.split('@')[0];
                const ini = initials(user?.firstName, user?.lastName, email);
                const isActive = session.id === activeSessionId;
                const isSelected = selected === session.id;

                return (
                  <motion.button
                    key={session.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.07, duration: 0.3 }}
                    onClick={() => setSelected(session.id)}
                    style={{
                      width: '100%',
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 14px', borderRadius: 12,
                      border: isSelected ? '1px solid rgba(217,119,87,0.35)' : '1px solid transparent',
                      background: isSelected ? 'rgba(217,119,87,0.07)' : 'transparent',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.18s', marginBottom: 4,
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                  >
                    {/* Avatar */}
                    {user?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={user.imageUrl}
                        alt={name}
                        style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                        background: isSelected ? 'linear-gradient(135deg, #E8886A, #D97757)' : 'rgba(255,255,255,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700,
                        color: isSelected ? '#fff' : 'rgba(255,255,255,0.5)',
                        transition: 'all 0.18s',
                      }}>
                        {ini}
                      </div>
                    )}

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 13.5, fontWeight: 600,
                        color: isSelected ? '#F5EDE3' : 'rgba(255,255,255,0.7)',
                        margin: 0, lineHeight: 1.3,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {name}
                      </p>
                      <p style={{
                        fontSize: 12, color: 'rgba(255,255,255,0.3)',
                        margin: '2px 0 0', lineHeight: 1.3,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {email}
                      </p>
                    </div>

                    {/* Selected indicator */}
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      >
                        <Check size={16} color="#D97757" strokeWidth={2.5} />
                      </motion.div>
                    )}

                    {/* Current session badge */}
                    {isActive && !isSelected && (
                      <span style={{
                        fontSize: 10, fontWeight: 600,
                        color: 'rgba(255,255,255,0.25)',
                        background: 'rgba(255,255,255,0.06)',
                        padding: '2px 7px', borderRadius: 20,
                        letterSpacing: '0.04em', textTransform: 'uppercase',
                      }}>
                        Current
                      </span>
                    )}
                  </motion.button>
                );
              })
            )}

            {/* Add account */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45, duration: 0.3 }}
              onClick={handleAddAccount}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 14px', borderRadius: 12,
                border: '1px solid transparent', background: 'transparent',
                cursor: 'pointer', marginBottom: 4, transition: 'background 0.18s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px dashed rgba(255,255,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Plus size={15} color="rgba(255,255,255,0.3)" />
              </div>
              <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>
                Use another account
              </span>
            </motion.button>
          </div>

          {/* Continue button */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.52, duration: 0.35 }}
            style={{ padding: '12px 20px 24px' }}
          >
            <button
              onClick={handleContinue}
              disabled={!selected || switching}
              style={{
                width: '100%', padding: '13px 20px', borderRadius: 12, border: 'none',
                background: selected && !switching
                  ? 'linear-gradient(135deg, #E8886A 0%, #D97757 100%)'
                  : 'rgba(255,255,255,0.06)',
                color: selected && !switching ? '#fff' : 'rgba(255,255,255,0.2)',
                fontSize: 14, fontWeight: 700,
                cursor: selected && !switching ? 'pointer' : 'not-allowed',
                letterSpacing: '-0.01em',
                boxShadow: selected && !switching ? '0 4px 20px rgba(217,119,87,0.3)' : 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                if (selected && !switching) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
            >
              {switching ? 'Switching…' : 'Continue'}
            </button>
          </motion.div>

          {/* Footer */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.05)',
            background: '#0D0A07', padding: '14px 36px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: 0, lineHeight: 1.6 }}>
              By continuing you agree to the{' '}
              <a href="/terms" style={{ color: '#664E3A', textDecoration: 'underline' }}>Terms</a>
              {' '}and{' '}
              <a href="/privacy" style={{ color: '#664E3A', textDecoration: 'underline' }}>Privacy Policy</a>
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function SelectAccountPage() {
  return (
    <Suspense>
      <SelectAccountContent />
    </Suspense>
  );
}
