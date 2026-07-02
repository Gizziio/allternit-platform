"use client";

import { useEffect, useState } from "react";
import { useAuth, SignIn } from "@clerk/clerk-react";

const POPUP_ORIGIN_ALLOWLIST = [
  "https://localhost:3000",
  "http://localhost:3000",
  "https://localhost:3001",
  "http://localhost:3001",
];

function clerkAppearance() {
  return {
    elements: {
      rootBox: { width: "100%", maxWidth: 360 },
      card: {
        boxShadow: "none",
        border: "1px solid rgba(200,168,140,0.15)",
        background: "#1A1612",
      },
      headerTitle: { color: "#C8BDB4", fontSize: 18 },
      headerSubtitle: { color: "#8A7E74", fontSize: 13 },
      socialButtonsBlockButton: {
        border: "1px solid rgba(200,168,140,0.15)",
        color: "#C8BDB4",
      },
      formFieldLabel: { color: "#8A7E74", fontSize: 12 },
      formFieldInput: {
        background: "#0E0C0A",
        border: "1px solid rgba(200,168,140,0.15)",
        color: "#C8BDB4",
      },
      footerActionLink: { color: "#D97757" },
      primaryButton: {
        background: "#D97757",
        color: "#140F0B",
        fontWeight: 700,
      },
    },
    variables: {
      colorPrimary: "#D97757",
      colorBackground: "#1A1612",
      colorText: "#C8BDB4",
      colorTextSecondary: "#8A7E74",
      colorInputBackground: "#0E0C0A",
      colorInputText: "#C8BDB4",
      borderRadius: "8px",
      fontFamily: "var(--font-sans)",
    },
  };
}

/** Attempt to send the token back via Office Dialog API (messageParent).
 *  Returns true if Office Dialog API was available and used. */
function trySendTokenViaOfficeDialog(token: string): boolean {
  if (typeof Office !== "undefined" && Office.context?.ui?.messageParent) {
    Office.context.ui.messageParent(JSON.stringify({ token }));
    return true;
  }
  return false;
}

/** Dynamically load Office.js and then try messageParent. */
function loadOfficeJsAndSendToken(token: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof Office !== "undefined") {
      resolve(trySendTokenViaOfficeDialog(token));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://appsforoffice.microsoft.com/lib/1/hosted/office.js";
    script.onload = () => {
      resolve(trySendTokenViaOfficeDialog(token));
    };
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export default function OfficeAuthBridgePage() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const [status, setStatus] = useState<"loading" | "sign-in" | "sending" | "sent" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setStatus("sign-in");
      return;
    }

    let timerId: ReturnType<typeof setTimeout> | null = null;

    async function sendToken() {
      setStatus("sending");
      try {
        const token = await getToken();
        if (!token) {
          setStatus("error");
          setError("No token available from Clerk.");
          return;
        }

        // 1. Try Office Dialog API first (primary for Office add-ins)
        const sentViaOffice = await loadOfficeJsAndSendToken(token);
        if (sentViaOffice) {
          setStatus("sent");
          // Dialog stays open; parent add-in will close it
          return;
        }

        // 2. Fallback: postMessage to opener (regular popup flow)
        const payload = {
          source: "allternit-office-auth-bridge",
          type: "auth-token",
          token,
        };

        if (window.opener) {
          window.opener.postMessage(payload, "*");
        }

        // 3. Fallback: BroadcastChannel for same-origin communication
        try {
          const bc = new BroadcastChannel("allternit-office-auth");
          bc.postMessage(payload);
          bc.close();
        } catch {
          // BroadcastChannel not supported
        }

        setStatus("sent");
        // Give the message a moment to deliver before closing
        timerId = setTimeout(() => {
          window.close();
        }, 800);
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to get token");
      }
    }

    void sendToken();

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [isSignedIn, isLoaded, getToken]);


  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0E0C0A" }}>
        <div style={{ color: "#8A7E74", fontSize: 14 }}>Checking session…</div>
      </div>
    );
  }

  if (status === "sending" || status === "sent") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "#0E0C0A" }}>
        <div style={{ color: "#C8BDB4", fontSize: 16, fontWeight: 600 }}>{status === "sent" ? "Token delivered" : "Sending token…"}</div>
        <div style={{ color: "#8A7E74", fontSize: 13 }}>You can close this window.</div>
        {status === "sent" && (
          <button type="button"
            onClick={() => window.close()}
            style={{
              marginTop: 8,
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid rgba(200,168,140,0.2)",
              background: "transparent",
              color: "#C8BDB4",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Close window
          </button>
        )}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "#0E0C0A" }}>
        <div style={{ color: "#ef4444", fontSize: 16, fontWeight: 600 }}>Something went wrong</div>
        <div style={{ color: "#8A7E74", fontSize: 13, maxWidth: 320, textAlign: "center" }}>{error}</div>
        <button type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8,
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid rgba(200,168,140,0.2)",
            background: "transparent",
            color: "#C8BDB4",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // sign-in state
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#0E0C0A", padding: 24 }}>
      <div style={{ color: "#C8BDB4", fontSize: 18, fontWeight: 600, textAlign: "center" }}>
        Sign in to Allternit
      </div>
      <div style={{ color: "#8A7E74", fontSize: 13, textAlign: "center", maxWidth: 320 }}>
        Your session will be sent back to the Office add-in automatically.
      </div>
      <SignIn
        appearance={clerkAppearance()}
        forceRedirectUrl={window.location.href}
        routing="path"
        path="/office-auth-bridge"
      />
    </div>
  );
}
