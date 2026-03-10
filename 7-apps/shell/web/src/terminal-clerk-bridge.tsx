import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';

type BridgeState = 'booting' | 'signin' | 'submitting' | 'error';

function parseURL(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function bridgeShell(body: React.ReactNode) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0d1117',
        color: '#e6edf3',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: 'min(560px, 100%)',
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Connect GIZZI Terminal</h1>
        {body}
      </div>
    </div>
  );
}

export function TerminalClerkBridgeApp() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [state, setState] = useState<BridgeState>('booting');
  const [error, setError] = useState<string>('');
  const openedOnce = useRef(false);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const requestID = params.get('request_id') ?? '';
  const callbackURL = parseURL(params.get('callback_url'));
  const platformURL = parseURL(params.get('platform_url'));

  useEffect(() => {
    if (!callbackURL) {
      setState('error');
      setError('Missing or invalid callback URL. Restart terminal login.');
      return;
    }

    if (!isLoaded) {
      setState('booting');
      return;
    }

    if (!isSignedIn) {
      setState('signin');
      if (!openedOnce.current) {
        openedOnce.current = true;
        try {
          (window as any).Clerk?.openSignIn?.({
            afterSignInUrl: window.location.href,
            afterSignUpUrl: window.location.href,
          });
        } catch {
          // Ignore and let the user use the manual button.
        }
      }
      return;
    }

    let cancelled = false;

    const submit = async () => {
      setState('submitting');

      try {
        const token = await getToken();
        if (!token) {
          throw new Error('Clerk did not return a session token.');
        }

        if (cancelled) return;

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = callbackURL;

        const tokenField = document.createElement('input');
        tokenField.type = 'hidden';
        tokenField.name = 'token';
        tokenField.value = token;
        form.appendChild(tokenField);

        if (requestID) {
          const requestField = document.createElement('input');
          requestField.type = 'hidden';
          requestField.name = 'request_id';
          requestField.value = requestID;
          form.appendChild(requestField);
        }

        if (platformURL) {
          const platformField = document.createElement('input');
          platformField.type = 'hidden';
          platformField.name = 'platform_url';
          platformField.value = platformURL;
          form.appendChild(platformField);
        }

        document.body.appendChild(form);
        form.submit();
      } catch (cause) {
        if (cancelled) return;
        setState('error');
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    };

    void submit();

    return () => {
      cancelled = true;
    };
  }, [callbackURL, getToken, isLoaded, isSignedIn, platformURL, requestID]);

  if (state === 'booting') {
    return bridgeShell(<p style={{ margin: 0, color: '#9ba7b4' }}>Loading Clerk session...</p>);
  }

  if (state === 'signin') {
    return bridgeShell(
      <>
        <p style={{ margin: 0, color: '#9ba7b4' }}>
          Sign in with Clerk in the dialog. After authentication, this page will send your session token back to GIZZI
          Terminal automatically.
        </p>
        <button
          type="button"
          onClick={() =>
            (window as any).Clerk?.openSignIn?.({
              afterSignInUrl: window.location.href,
              afterSignUpUrl: window.location.href,
            })
          }
          style={{
            border: '1px solid #2f81f7',
            background: '#1f6feb',
            color: '#fff',
            borderRadius: '8px',
            padding: '10px 12px',
            cursor: 'pointer',
          }}
        >
          Open Clerk Sign In
        </button>
      </>,
    );
  }

  if (state === 'submitting') {
    return bridgeShell(
      <p style={{ margin: 0, color: '#9ba7b4' }}>
        Login complete. Sending secure callback to GIZZI Terminal...
      </p>,
    );
  }

  return bridgeShell(
    <>
      <p style={{ margin: 0, color: '#fda4af' }}>{error || 'Login bridge failed.'}</p>
      <p style={{ margin: 0, color: '#9ba7b4' }}>Return to terminal and start the login step again.</p>
    </>,
  );
}
