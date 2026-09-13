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
import { CloudAccountsPage } from "@/pages/CloudAccountsPage";
import { SignInPage } from "@/pages/SignInPage";
import { SignUpPage } from "@/pages/SignUpPage";
import { RunsPage } from "@/pages/RunsPage";
import { SchedulesPage } from "@/pages/SchedulesPage";
import { ApprovalsPage } from "@/pages/ApprovalsPage";
import { FabricPage } from "@/pages/FabricPage";
import { PortalLandingPage } from "@/pages/PortalLandingPage";
import { ModelsPage } from "@/pages/ModelsPage";
import { PlansPage } from "@/pages/PlansPage";
import { PlaygroundPage } from "@/pages/console/PlaygroundPage";
import { FilesPage } from "@/pages/console/FilesPage";
import { BatchesPage } from "@/pages/console/BatchesPage";
import { SkillsPage } from "@/pages/console/SkillsPage";
import { BuilderPage } from "@/pages/console/BuilderPage";
import { AgentsPage } from "@/pages/console/agents/AgentsPage";
import { AgentDetailPage } from "@/pages/console/agents/AgentDetailPage";
import { AgentFormPage } from "@/pages/console/agents/AgentFormPage";
import { SessionsPage } from "@/pages/console/sessions/SessionsPage";
import { SessionNewPage } from "@/pages/console/sessions/SessionNewPage";
import { SessionDetailPage } from "@/pages/console/sessions/SessionDetailPage";
import { DeploymentsPage } from "@/pages/console/deployments/DeploymentsPage";
import { ComputersPage } from "@/pages/console/computers/ComputersPage";
import { VaultsPage, VaultDetailPage } from "@/pages/console/vaults/VaultsPage";
import { MemoryPage, MemoryStorePage } from "@/pages/console/memory/MemoryPage";
import {
  AnalyticsUsageStubPage,
  AnalyticsLogsStubPage,
  AnalyticsCachingStubPage,
  AnalyticsRateLimitsStubPage,
  AnalyticsCostStubPage,
  GizziUsageStubPage,
  ManageRateLimitsStubPage,
  ManageSpendLimitsStubPage,
  ManageMembersStubPage,
  ManageServiceAccountsStubPage,
  ManageSecurityStubPage,
  ManageWebhooksStubPage,
  ManageTagsStubPage,
} from "@/pages/stubs/consoleStubs";
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

/** Phase 1 designed stubs — one per future console page. */
const consoleStubRoutes: Array<{ path: string; element: React.ReactNode }> = [
  { path: "/analytics/usage/*", element: <AnalyticsUsageStubPage /> },
  { path: "/analytics/logs/*", element: <AnalyticsLogsStubPage /> },
  { path: "/analytics/caching/*", element: <AnalyticsCachingStubPage /> },
  { path: "/analytics/rate-limits/*", element: <AnalyticsRateLimitsStubPage /> },
  { path: "/analytics/cost/*", element: <AnalyticsCostStubPage /> },
  { path: "/gizzi/usage/*", element: <GizziUsageStubPage /> },
  { path: "/manage/rate-limits/*", element: <ManageRateLimitsStubPage /> },
  { path: "/manage/spend-limits/*", element: <ManageSpendLimitsStubPage /> },
  { path: "/manage/members/*", element: <ManageMembersStubPage /> },
  { path: "/manage/service-accounts/*", element: <ManageServiceAccountsStubPage /> },
  { path: "/manage/security/*", element: <ManageSecurityStubPage /> },
  { path: "/manage/webhooks/*", element: <ManageWebhooksStubPage /> },
  { path: "/manage/tags/*", element: <ManageTagsStubPage /> },
];

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
        path="/agents"
        element={
          <ConsoleRoute>
            <AgentsPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/agents/new"
        element={
          <ConsoleRoute>
            <AgentFormPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/agents/:id"
        element={
          <ConsoleRoute>
            <AgentDetailPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/agents/:id/edit"
        element={
          <ConsoleRoute>
            <AgentFormPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/sessions"
        element={
          <ConsoleRoute>
            <SessionsPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/sessions/new"
        element={
          <ConsoleRoute>
            <SessionNewPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/sessions/:id"
        element={
          <ConsoleRoute>
            <SessionDetailPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/deployments"
        element={
          <ConsoleRoute>
            <DeploymentsPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/computers"
        element={
          <ConsoleRoute>
            <ComputersPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/vaults"
        element={
          <ConsoleRoute>
            <VaultsPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/vaults/:id"
        element={
          <ConsoleRoute>
            <VaultDetailPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/memory"
        element={
          <ConsoleRoute>
            <MemoryPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/memory/:id"
        element={
          <ConsoleRoute>
            <MemoryStorePage />
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
        path="/cloud-accounts/*"
        element={
          <ConsoleRoute>
            <CloudAccountsPage />
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
      <Route
        path="/fabric/*"
        element={
          <ConsoleRoute>
            <FabricPage />
          </ConsoleRoute>
        }
      />
      {/* Phase 2 Build group — real pages on the console-ui kit. */}
      <Route
        path="/playground/*"
        element={
          <ConsoleRoute>
            <PlaygroundPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/files/*"
        element={
          <ConsoleRoute>
            <FilesPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/skills/*"
        element={
          <ConsoleRoute>
            <SkillsPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/batches/*"
        element={
          <ConsoleRoute>
            <BatchesPage />
          </ConsoleRoute>
        }
      />
      <Route
        path="/builder/*"
        element={
          <ConsoleRoute>
            <BuilderPage />
          </ConsoleRoute>
        }
      />
      {consoleStubRoutes.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={<ConsoleRoute>{route.element}</ConsoleRoute>}
        />
      ))}
      {/* Fallback Clerk path-routed pages. Public marketing pages open the auth modal
          inline, but /sign-in and /sign-up remain available for direct navigation. */}
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
