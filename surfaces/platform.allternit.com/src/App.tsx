import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { OrganizationsPage } from "@/pages/OrganizationsPage";
import { ComputePage } from "@/pages/ComputePage";
import { DevicesPage } from "@/pages/DevicesPage";
import { BillingPage } from "@/pages/BillingPage";
import { ApiKeysPage } from "@/pages/ApiKeysPage";
import { DocsPage } from "@/pages/DocsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SignInPage } from "@/pages/SignInPage";
import { SignUpPage } from "@/pages/SignUpPage";
import { usePlatformAuth } from "@/lib/platform-auth-client";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const auth = usePlatformAuth();

  if (!auth.isLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--bg-primary)]">
        <div className="size-8 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!auth.isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
}

function ConsoleRoute({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <ConsoleLayout>{children}</ConsoleLayout>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <ConsoleRoute>
            <DashboardPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/organizations/*"
        element={
          <ConsoleRoute>
            <OrganizationsPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/compute/*"
        element={
          <ConsoleRoute>
            <ComputePage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/devices/*"
        element={
          <ConsoleRoute>
            <DevicesPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/billing/*"
        element={
          <ConsoleRoute>
            <BillingPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/api-keys/*"
        element={
          <ConsoleRoute>
            <ApiKeysPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/docs/*"
        element={
          <ConsoleRoute>
            <DocsPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/settings/*"
        element={
          <ConsoleRoute>
            <SettingsPage />
          </ConsoleRoute>
        }
      />
      {/* Clerk's path-routed SignIn/SignUp navigate to sub-routes such as
          /sign-in/factor-one. Keep wildcards so React Router renders the page
          on those steps and lets Clerk manage redirects. */}
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
