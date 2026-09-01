import React, { ReactNode, createContext, useContext, useEffect, useMemo } from "react";
import {
  ClerkProvider,
  OrganizationSwitcher,
  useAuth,
  useClerk as useClerkReact,
  useOrganization,
  useSignIn,
  useUser,
} from "@clerk/clerk-react";
import { api } from "@/lib/api-client";
import {
  CLERK_PUBLISHABLE_KEY,
  CLERK_PROXY_URL,
  CLERK_SIGN_IN_PATH,
  CLERK_SIGN_UP_PATH,
  getAllowedRedirectOrigins,
} from "@/clerkConfig";

export interface PlatformUser {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  userEmail?: string;
  primaryEmailAddress?: { emailAddress: string } | null;
  emailAddresses?: Array<{ emailAddress: string }>;
  imageUrl?: string | null;
}

export interface PlatformOrganization {
  id: string;
  name: string;
  slug?: string | null;
  imageUrl?: string | null;
}

export interface PlatformOrganizationMembership {
  role?: string | null;
}

interface PlatformAuthShape {
  user: {
    isLoaded: boolean;
    isSignedIn: boolean;
    user: PlatformUser | null;
  };
  organization: {
    isLoaded: boolean;
    organization: PlatformOrganization | null;
    membership: PlatformOrganizationMembership | null;
  };
  auth: {
    isLoaded: boolean;
    isSignedIn: boolean | undefined;
    userId: string | null | undefined;
    sessionId: string | null | undefined;
    orgId: string | null | undefined;
    orgRole: string | null | undefined;
    actor: unknown;
    getToken: () => Promise<string | null>;
  };
  signOut: (_options?: any) => Promise<void>;
  clerk: any;
}

const PlatformAuthContext = createContext<PlatformAuthShape | null>(null);

export function isPlatformAuthDisabled(): boolean {
  return !CLERK_PUBLISHABLE_KEY;
}

const clerkAppearance = {
  variables: {
    colorBackground: "#FFFEFC",
    colorPrimary: "#1A1916",
    colorText: "#0D0C0A",
    colorTextSecondary: "#74716B",
    colorInputBackground: "#FFFFFF",
    colorInputText: "#0D0C0A",
    colorNeutral: "#74716B",
    colorDanger: "#f87171",
    borderRadius: "16px",
    fontFamily: "inherit",
  },
  elements: {
    cardBox: { background: "transparent", border: "none", boxShadow: "none", width: "100%", maxWidth: "100%" },
    rootBox: { width: "100%", maxWidth: "100%", boxSizing: "border-box" },
    card: { background: "transparent", border: "none", boxShadow: "none", width: "100%", maxWidth: "100%", boxSizing: "border-box", padding: "0" },
    headerTitle: { color: "#0D0C0A", fontSize: "28px", fontWeight: 700, letterSpacing: "-0.03em" },
    headerSubtitle: { color: "#74716B" },
    socialButtonsBlockButton: { background: "#FFFFFF", border: "1px solid #E1E0DC", color: "#1A1916", boxShadow: "none" },
    socialButtonsBlockButtonText: { color: "#1A1916" },
    dividerLine: { background: "#E1E0DC" },
    dividerText: { color: "#989590" },
    formFieldLabel: { color: "#403E39" },
    formFieldInput: { background: "#FFFFFF", border: "1px solid #D7D5D0", color: "#0D0C0A", boxShadow: "none" },
    formFieldInputShowPasswordButton: { color: "#74716B" },
    formFieldInputShowPasswordButtonIcon: { color: "#74716B" },
    footerActionText: { color: "#74716B" },
    footerActionLink: { color: "#9A7658" },
    footer: { background: "transparent", padding: "20px 0 0", margin: "0" },
    form: { gap: "14px" },
    main: { gap: "18px" },
    formButtonPrimary: { background: "#1A1916", color: "#FAF9F7", boxShadow: "none", fontWeight: 700 },
    identityPreviewText: { color: "#0D0C0A" },
    formResendCodeLink: { color: "#9A7658" },
    otpCodeFieldInput: { background: "#FFFFFF", border: "1px solid #D7D5D0", color: "#0D0C0A" },
    alertText: { color: "#0D0C0A" },
    alertClerkError: { background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.24)" },
  },
} as const;

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  if (!CLERK_PUBLISHABLE_KEY) {
    const value = buildDisabledAuthValue();
    return <PlatformAuthContext.Provider value={value}>{children}</PlatformAuthContext.Provider>;
  }

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      appearance={clerkAppearance}
      signInUrl={CLERK_SIGN_IN_PATH}
      signUpUrl={CLERK_SIGN_UP_PATH}
      proxyUrl={CLERK_PROXY_URL}
      allowedRedirectOrigins={getAllowedRedirectOrigins()}
    >
      <ClerkPlatformAuthBridge>{children}</ClerkPlatformAuthBridge>
    </ClerkProvider>
  );
}

export function usePlatformUser(): {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: PlatformUser | null;
} {
  return usePlatformAuthContext().user;
}

export function usePlatformOrganization(): {
  isLoaded: boolean;
  organization: PlatformOrganization | null;
  membership: PlatformOrganizationMembership | null;
} {
  return usePlatformAuthContext().organization;
}

export function PlatformOrganizationSwitcher() {
  const { clerk } = usePlatformAuthContext();
  if (!clerk) return null;
  return (
    <OrganizationSwitcher
      appearance={{
        elements: {
          rootBox: { width: "100%" },
          organizationSwitcherTrigger: {
            width: "100%",
            justifyContent: "space-between",
            border: "1px solid var(--border-subtle)",
            borderRadius: "10px",
            padding: "9px 11px",
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            boxShadow: "none",
          },
        },
      }}
    />
  );
}

export function useClerk() {
  return usePlatformAuthContext().clerk;
}

export function usePlatformAuth() {
  return usePlatformAuthContext().auth;
}

export function usePlatformSignOut() {
  return usePlatformAuthContext().signOut;
}

function buildDisabledAuthValue(): PlatformAuthShape {
  if (import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH_BYPASS === "1") {
    const mockUser: PlatformUser = {
      id: "dev-user",
      firstName: "Local",
      lastName: "Developer",
      userEmail: "dev@allternit.local",
      primaryEmailAddress: { emailAddress: "dev@allternit.local" },
      emailAddresses: [{ emailAddress: "dev@allternit.local" }],
      imageUrl: null,
    };
    return {
      user: { isLoaded: true, isSignedIn: true, user: mockUser },
      organization: { isLoaded: true, organization: null, membership: null },
      auth: {
        isLoaded: true,
        isSignedIn: true,
        userId: "dev-user",
        sessionId: "dev-session",
        orgId: null,
        orgRole: null,
        actor: null,
        getToken: async () => "dev-token",
      },
      signOut: async () => {},
      clerk: null,
    };
  }

  return {
    user: { isLoaded: true, isSignedIn: false, user: null },
    organization: { isLoaded: true, organization: null, membership: null },
    auth: {
      isLoaded: true,
      isSignedIn: false,
      userId: null,
      sessionId: null,
      orgId: null,
      orgRole: null,
      actor: null,
      getToken: async () => null,
    },
    signOut: async () => {},
    clerk: null,
  };
}

function ClerkPlatformAuthBridge({ children }: { children: ReactNode }) {
  const clerkUser = useUser();
  const clerkAuth = useAuth();
  const clerkOrganization = useOrganization();
  const clerk = useClerkReact();
  const { signIn, setActive } = useSignIn();

  // DEV-only seeded auto-login. If VITE_CLERK_SEED_EMAIL/PASSWORD are set in
  // .env.local, sign in automatically so agent/UI work can start authenticated.
  // The seed account should be a real verified test user; the effect also
  // ensures an active organization so the JWT is org-scoped.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!clerkAuth.isLoaded || clerkAuth.isSignedIn) return;
    if (!signIn || !setActive || !clerk) return;
    const email = import.meta.env.VITE_CLERK_SEED_EMAIL as string | undefined;
    const password = import.meta.env.VITE_CLERK_SEED_PASSWORD as string | undefined;
    if (!email || !password) return;
    let active = true;
    const run = async () => {
      try {
        const result = await signIn.create({ identifier: email, password });
        if (!active) return;
        if (result.status === "complete" && result.createdSessionId) {
          const memberships = clerk.user?.organizationMemberships;
          let orgId: string | undefined = memberships?.[0]?.organization.id;
          if (!orgId) {
            try {
              const org = await clerk.createOrganization({ name: "Allternit Seed" });
              orgId = org.id;
            } catch (orgErr) {
              console.warn("[PlatformSeedAuth] Failed to create seed organization:", orgErr);
            }
          }
          await clerk.setActive({ session: result.createdSessionId, organization: orgId });
        } else {
          console.warn("[PlatformSeedAuth] Clerk sign-in requires extra steps:", result.status);
        }
      } catch (err) {
        console.error("[PlatformSeedAuth] Auto sign-in failed:", err);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [clerkAuth.isLoaded, clerkAuth.isSignedIn, signIn, setActive, clerk]);

  useEffect(() => {
    if (!clerkAuth.isSignedIn || typeof clerkAuth.getToken !== "function") {
      api.clearToken();
      api.clearTokenProvider();
      return;
    }

    // Register the Clerk token provider so every API request gets a fresh
    // JWT on demand. This avoids race conditions where a page's useEffect
    // fires before the first token sync completes. The arrow function
    // preserves the Clerk auth object's `this` binding.
    api.setTokenProvider(() => clerkAuth.getToken());

    let active = true;
    const syncToken = async () => {
      try {
        const token = await clerkAuth.getToken();
        if (!active) return;
        if (token) api.setToken(token);
        else api.clearToken();
      } catch {
        if (active) api.clearToken();
      }
    };

    void syncToken();
    const interval = setInterval(syncToken, 50_000);
    return () => {
      active = false;
      clearInterval(interval);
      api.clearTokenProvider();
    };
  }, [clerkAuth.isSignedIn, clerkAuth.getToken]);

  const value = useMemo(
    () => ({
      user: {
        isLoaded: clerkUser.isLoaded,
        isSignedIn: clerkUser.isSignedIn ?? false,
        user: (clerkUser.user as PlatformUser | null | undefined) ?? null,
      },
      organization: {
        isLoaded: clerkOrganization.isLoaded,
        organization: clerkOrganization.organization
          ? {
              id: clerkOrganization.organization.id,
              name: clerkOrganization.organization.name,
              slug: clerkOrganization.organization.slug,
              imageUrl: clerkOrganization.organization.imageUrl,
            }
          : null,
        membership: clerkOrganization.membership
          ? { role: clerkOrganization.membership.role }
          : null,
      },
      auth: clerkAuth,
      signOut: clerk.signOut,
      clerk,
    }),
    [clerk, clerkAuth, clerkOrganization]
  );

  return <PlatformAuthContext.Provider value={value}>{children}</PlatformAuthContext.Provider>;
}

function usePlatformAuthContext() {
  const context = useContext(PlatformAuthContext);
  if (!context) {
    throw new Error("PlatformAuthProvider is missing");
  }
  return context;
}
