import { useEffect, useState } from 'react';
import { ClerkProvider, SignIn, SignUp, useClerk } from '@clerk/clerk-react';
import { loadClerkConfig } from './clerk-config.js';

function AuthFlow() {
  // Local state only — Clerk rewrites the location hash for its own routing,
  // so deriving the mode from the hash would fight that and snap back.
  const [isSignUp, setIsSignUp] = useState(false);

  const toggle = () => setIsSignUp((current) => !current);

  return (
    <>
      {isSignUp ? (
        <SignUp
          appearance={clerkAppearance}
          routing="hash"
          forceRedirectUrl={selfRedirectUrl}
          signInForceRedirectUrl={selfRedirectUrl}
        />
      ) : (
        <SignIn
          appearance={clerkAppearance}
          routing="hash"
          forceRedirectUrl={selfRedirectUrl}
          signUpForceRedirectUrl={selfRedirectUrl}
        />
      )}
      <div
        style={{
          marginTop: '18px',
          textAlign: 'center',
          fontSize: '14px',
          color: '#74716B',
          WebkitAppRegion: 'no-drag',
        }}
      >
        {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
        <button
          type="button"
          onClick={toggle}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: '#9A7658',
            cursor: 'pointer',
            fontSize: 'inherit',
            fontFamily: 'inherit',
            textDecoration: 'underline',
            WebkitAppRegion: 'no-drag',
          }}
        >
          {isSignUp ? 'Sign in' : 'Sign up'}
        </button>
      </div>
    </>
  );
}

/**
 * URL of the auth page itself (https://accounts.<instance>/__desktop_auth__/).
 * Clerk redirects to the instance's home_url after sign-in/sign-up (and after
 * session tasks like organization setup), which would navigate the auth
 * window away to the platform before the TokenBridge can hand the session
 * token to the main process. Forcing the redirect back to this page makes
 * Clerk reload the auth renderer instead; TokenBridge then fires on mount.
 */
const selfRedirectUrl =
  typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '/';

/**
 * The instance's application name does not reach the embedded component, which
 * leaves the default title rendering as "Sign in to ". Pin the titles instead.
 */
const clerkLocalization = {
  signIn: {
    start: {
      title: 'Sign in to Allternit',
    },
  },
  signUp: {
    start: {
      title: 'Create your Allternit account',
    },
  },
} as const;

const clerkAppearance = {
  variables: {
    colorBackground: '#FFFEFC',
    colorPrimary: '#1A1916',
    colorText: '#0D0C0A',
    colorTextSecondary: '#74716B',
    colorInputBackground: '#FFFFFF',
    colorInputText: '#0D0C0A',
    colorNeutral: '#74716B',
    colorDanger: '#f87171',
    borderRadius: '16px',
    fontFamily: 'inherit',
  },
  elements: {
    cardBox: {
      background: 'transparent',
      border: 'none',
      boxShadow: 'none',
      width: '100%',
      maxWidth: '100%',
    },
    rootBox: {
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
    },
    card: {
      background: 'transparent',
      border: 'none',
      boxShadow: 'none',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      padding: '0',
    },
    headerTitle: {
      color: '#0D0C0A',
      fontSize: '28px',
      fontWeight: '700',
      letterSpacing: '-0.03em',
    },
    headerSubtitle: {
      color: '#74716B',
    },
    socialButtonsBlockButton: {
      background: '#FFFFFF',
      border: '1px solid #E1E0DC',
      color: '#1A1916',
      boxShadow: 'none',
    },
    socialButtonsBlockButtonText: {
      color: '#1A1916',
    },
    dividerLine: {
      background: '#E1E0DC',
    },
    dividerText: {
      color: '#989590',
    },
    formFieldLabel: {
      color: '#403E39',
    },
    formFieldInput: {
      background: '#FFFFFF',
      border: '1px solid #D7D5D0',
      color: '#0D0C0A',
      boxShadow: 'none',
    },
    footerActionText: {
      display: 'none',
    },
    footerActionLink: {
      display: 'none',
    },
    footer: {
      background: 'transparent',
      padding: '20px 0 0',
      margin: '0',
    },
    footerAction: {
      display: 'none',
    },
    form: {
      gap: '14px',
    },
    main: {
      gap: '18px',
    },
    formButtonPrimary: {
      background: '#1A1916',
      color: '#FAF9F7',
      boxShadow: 'none',
      fontWeight: '700',
    },
    identityPreviewText: {
      color: '#0D0C0A',
    },
    formResendCodeLink: {
      color: '#9A7658',
    },
    otpCodeFieldInput: {
      background: '#FFFFFF',
      border: '1px solid #D7D5D0',
      color: '#0D0C0A',
    },
    alertText: {
      color: '#0D0C0A',
    },
    alertClerkError: {
      background: 'rgba(248,113,113,0.12)',
      border: '1px solid rgba(248,113,113,0.24)',
    },
  },
} as const;

/**
 * Sends the Clerk session token to the Electron main process once the user is
 * signed in. The main process then completes the runtime pairing exchange.
 */
function TokenBridge() {
  const { session, user, loaded } = useClerk();
  const [reported, setReported] = useState(false);

  useEffect(() => {
    if (!loaded || !session || reported) return;

    let active = true;
    void (async () => {
      try {
        const token = await session.getToken();
        if (!active || !token) return;
        const email =
          user?.primaryEmailAddress?.emailAddress ??
          user?.emailAddresses?.[0]?.emailAddress ??
          '';
        setReported(true);
        await window.allternitAuth?.onClerkToken?.({ token, userId: user?.id ?? '', email });
      } catch (err) {
        await window.allternitAuth?.onClerkError?.(err instanceof Error ? err.message : 'Clerk session error');
      }
    })();

    return () => {
      active = false;
    };
  }, [loaded, session, user, reported]);

  return null;
}

export default function AuthApp() {
  const [config, setConfig] = useState<Awaited<ReturnType<typeof loadClerkConfig>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadClerkConfig()
      .then(setConfig)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (error) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          textAlign: 'center',
          color: '#9c2a25',
        }}
      >
        {error}
      </div>
    );
  }

  if (!config) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            border: '2px solid #e1e5eb',
            borderTopColor: '#B08D6E',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <ClerkProvider
      publishableKey={config.publishableKey}
      appearance={clerkAppearance}
      localization={clerkLocalization}
      signInForceRedirectUrl={selfRedirectUrl}
      signUpForceRedirectUrl={selfRedirectUrl}
      signInFallbackRedirectUrl={selfRedirectUrl}
      signUpFallbackRedirectUrl={selfRedirectUrl}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '48px 32px 24px',
          WebkitAppRegion: 'drag',
          overflow: 'auto',
        }}
      >
        <div style={{ width: '100%', maxWidth: '380px', WebkitAppRegion: 'no-drag' }}>
          <div
            style={{
              textAlign: 'center',
              marginBottom: '28px',
              fontFamily: "'Allternit Serif', Georgia, ui-serif, Cambria, 'Times New Roman', Times, serif",
              fontSize: '28px',
              fontWeight: 700,
              color: '#0d0c0a',
            }}
          >
            Allternit
          </div>
          <AuthFlow />
        </div>
      </div>
      <TokenBridge />
    </ClerkProvider>
  );
}
