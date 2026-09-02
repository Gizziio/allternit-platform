import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { PublicPageShell } from "@/components/PublicPageShell";
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
import { RunsPage } from "@/pages/RunsPage";
import { SchedulesPage } from "@/pages/SchedulesPage";
import { ApprovalsPage } from "@/pages/ApprovalsPage";
import { PortalLandingPage } from "@/pages/PortalLandingPage";
import { ModelsPage } from "@/pages/ModelsPage";
import { PlansPage } from "@/pages/PlansPage";
import { usePlatformAuth } from "@/lib/platform-auth-client";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const auth = usePlatformAuth();
  const location = useLocation();

  if (!auth.isLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--bg-primary)]">
        <div className="size-8 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!auth.isSignedIn) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-in?redirect_url=${returnUrl}`} replace />;
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

function HomeRoute() {
  const auth = usePlatformAuth();

  if (!auth.isLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--bg-primary)]">
        <div className="size-8 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
      </div>
    );
  }

  if (auth.isSignedIn) {
    return (
      <ConsoleRoute>
        <DashboardPage />
      </ConsoleRoute>
    );
  }

  return <PortalLandingPage />;
}

function BillingRoute() {
  const auth = usePlatformAuth();

  if (!auth.isLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--bg-primary)]">
        <div className="size-8 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
      </div>
    );
  }

  if (auth.isSignedIn) {
    return (
      <ConsoleLayout>
        <BillingPage />
      </ConsoleLayout>
    );
  }

  return (
    <PublicPageShell>
      <BillingPage />
    </PublicPageShell>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/models/*" element={<ModelsPage />} />
      <Route path="/plans/*" element={<PlansPage />} />
      <Route path="/billing/*" element={<BillingRoute />} />
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
        path="/runs/*"
        element={
          <ConsoleRoute>
            <RunsPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/schedules/*"
        element={
          <ConsoleRoute>
            <SchedulesPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/approvals/*"
        element={
          <ConsoleRoute>
            <ApprovalsPage />
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
      {/* Fallback Clerk path-routed pages. Public marketing pages open the auth modal
          inline, but /sign-in and /sign-up remain available for direct navigation. */}
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
