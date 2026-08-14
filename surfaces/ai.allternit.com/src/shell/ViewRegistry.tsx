"use client";

import React from 'react';
import { lazy } from 'react';
import { ErrorBoundary } from '../components/error-boundary';
import { 
  ChatViewWrapper 
} from './ChatViewWrapper';
import { 
  BrowserPaneWrapper, 
  BrowserSurfaceFrame 
} from './BrowserPane';
import { 
  ErrorFallbackWrapper, 
  OpenClawErrorFallback, 
  ElementsView 
} from './ShellFallbacks';
import { createViewRegistry } from '../views/registry';
import type { ViewContext, ViewType } from '../nav/nav.types';
import { useCoworkSessionStore } from '../views/cowork/CoworkSessionStore';
import type { AppMode } from './ShellHeader';
import type { CanonicalAgentModeId } from '@/lib/agents/agent-mode-contracts';
import { ToastProvider } from '@/components/ui/toast-provider';

const SkillsRegistryView   = lazy(() => import('../views/code/SkillsRegistryView').then(m => ({ default: m.SkillsRegistryView })));
const DesignRegistryView   = lazy(() => import('../views/design/DesignRegistryView').then(m => ({ default: m.DesignRegistryView })));
const OpenClawView         = lazy(() => import('../views/openclaw/OpenClawView').then(m => ({ default: m.OpenClawView })));
const HermesView           = lazy(() => import('../views/hermes/HermesView').then(m => ({ default: m.HermesView })));
const VaultViewerView      = lazy(() => import('../views/vault-viewer/VaultViewerView').then(m => ({ default: m.VaultViewerView })));
const OhMyPiView           = lazy(() => import('../views/omp/OhMyPiView').then(m => ({ default: m.OhMyPiView })));
const ChatModeAgentSession = lazy(() => import('../views/agent-sessions/ChatModeAgentSession').then(m => ({ default: m.ChatModeAgentSession })));
const CodeModeAgentSession = lazy(() => import('../views/agent-sessions/CodeModeAgentSession').then(m => ({ default: m.CodeModeAgentSession })));
const DesignModeAgentSession = lazy(() => import('../views/agent-sessions/DesignModeAgentSession').then(m => ({ default: m.DesignModeAgentSession })));
const SwarmADE             = lazy(() => import('../views/swarm').then(m => ({ default: m.SwarmADE })));
const AllternitCanvasView  = lazy(() => import('../views/AllternitCanvasView').then(m => ({ default: m.AllternitCanvasView })));
const CoworkRoot           = lazy(() => import('../views/cowork/CoworkRoot').then(m => ({ default: m.CoworkRoot })));
const PluginRegistryView   = lazy(() => import('../views/cowork/PluginRegistryView').then(m => ({ default: m.PluginRegistryView })));
const TerminalView         = lazy(() => import('../views/TerminalView').then(m => ({ default: m.TerminalView })));
const CodeRoot             = lazy(() => import('../views/code/CodeRoot').then(m => ({ default: m.CodeRoot })));
const AgentHub             = lazy(() => import('../views/AgentHub').then(m => ({ default: m.AgentHub })));
const NativeAgentView      = lazy(() => import('../views/NativeAgentView').then(m => ({ default: m.NativeAgentView })));
const BrowserCapsuleEnhanced = lazy(() => import('../capsules/browser/BrowserCapsuleEnhanced').then(m => ({ default: m.BrowserCapsuleEnhanced })));
const AciMiniAppsView = lazy(() => import('../views/aci/AciMiniAppsView').then(m => ({ default: m.AciMiniAppsView })));
const MiniAppReviewConsoleView = lazy(() => import('../views/aci/MiniAppReviewConsoleView').then(m => ({ default: m.MiniAppReviewConsoleView })));
const AciMiniAppFrameView = lazy(() => import('../views/aci/AciMiniAppFrameView').then(m => ({ default: m.AciMiniAppFrameView })));
const AciAddinView = lazy(() => import('../views/aci/AciAddinView').then(m => ({ default: m.AciAddinView })));
const ProjectView          = lazy(() => import('../views/ProjectView').then(m => ({ default: m.ProjectView })));
const ToolsView            = lazy(() => import('../views/code/ToolsView').then(m => ({ default: m.ToolsView })));
const RunReplayView        = lazy(() => import('../views/code/RunReplayView').then(m => ({ default: m.RunReplayView })));
const AppsExtensionsView     = lazy(() => import('../views/AppsExtensionsView').then(m => ({ default: m.AppsExtensionsView })));
const DispatchView           = lazy(() => import('../views/DispatchView').then(m => ({ default: m.DispatchView })));
const PlaygroundView       = lazy(() => import('../views/PlaygroundView').then(m => ({ default: m.PlaygroundView })));
const AllternitPlaygroundView = lazy(() => import('../views/AllternitPlaygroundView').then(m => ({ default: m.AllternitPlaygroundView })));
const AgentStudioView      = lazy(() => import('../views/AgentStudioView').then(m => ({ default: m.AgentStudioView })));
const DagIntegrationPage   = lazy(() => import('../views/DagIntegrationPage').then(m => ({ default: m.DagIntegrationPage })));
const CloudDeployView      = lazy(() => import('../views/cloud-deploy/CloudDeployView').then(m => ({ default: m.CloudDeployView })));
const DesignModeView         = lazy(() => import('../views/design/DesignModeView').then(m => ({ default: m.default })));
const NodesView              = lazy(() => import('../views/nodes').then(m => ({ default: m.NodesView })));
const CapsuleManagerView     = lazy(() => import('../views/CapsuleManagerView').then(m => ({ default: m.CapsuleManagerView })));
const OperatorBrowserView    = lazy(() => import('../views/OperatorBrowserView').then(m => ({ default: m.OperatorBrowserView })));
const FormSurfacesView       = lazy(() => import('../views/FormSurfacesView').then(m => ({ default: m.FormSurfacesView })));
const CanvasProtocolView     = lazy(() => import('../views/CanvasProtocolView').then(m => ({ default: m.CanvasProtocolView })));
const HooksSystemView        = lazy(() => import('../views/HooksSystemView').then(m => ({ default: m.HooksSystemView })));
const EvolutionLayerView     = lazy(() => import('../views/EvolutionLayerView').then(m => ({ default: m.EvolutionLayerView })));
const ContextControlPlaneView = lazy(() => import('../views/ContextControlPlaneView').then(m => ({ default: m.ContextControlPlaneView })));
const MemoryKernelView       = lazy(() => import('../views/MemoryKernelView').then(m => ({ default: m.MemoryKernelView })));
const AutonomousCodeFactoryView = lazy(() => import('../views/AutonomousCodeFactoryView').then(m => ({ default: m.AutonomousCodeFactoryView })));

// DAG views
const PolicyManager          = lazy(() => import('../views/dag').then(m => ({ default: m.PolicyManager })));
const TaskExecutor           = lazy(() => import('../views/dag').then(m => ({ default: m.TaskExecutor })));
const OntologyViewer         = lazy(() => import('../views/dag').then(m => ({ default: m.OntologyViewer })));
const DirectiveCompiler      = lazy(() => import('../views/dag').then(m => ({ default: m.DirectiveCompiler })));
const EvaluationHarness      = lazy(() => import('../views/dag').then(m => ({ default: m.EvaluationHarness })));
const GCAgents               = lazy(() => import('../views/dag').then(m => ({ default: m.GCAgents })));
const ReceiptsViewer         = lazy(() => import('../views/dag').then(m => ({ default: m.ReceiptsViewer })));
const PolicyGating           = lazy(() => import('../views/dag').then(m => ({ default: m.PolicyGating })));
const SecurityDashboard      = lazy(() => import('../views/dag').then(m => ({ default: m.SecurityDashboard })));
const PurposeBinding         = lazy(() => import('../views/dag').then(m => ({ default: m.PurposeBinding })));
const DAGWIH                 = lazy(() => import('../views/dag').then(m => ({ default: m.DAGWIH })));
const Checkpointing          = lazy(() => import('../views/dag').then(m => ({ default: m.Checkpointing })));
const ObservabilityDashboard = lazy(() => import('../views/dag').then(m => ({ default: m.ObservabilityDashboard })));
const IVKGEPanel             = lazy(() => import('../views/dag').then(m => ({ default: m.IVKGEPanel })));
const MultimodalInput        = lazy(() => import('../views/dag').then(m => ({ default: m.MultimodalInput })));
const UIForge                = lazy(() => import('../views/dag').then(m => ({ default: m.UIForge })));

// Runtime views
const BudgetDashboardView    = lazy(() => import('../views/runtime/BudgetDashboardView').then(m => ({ default: m.BudgetDashboardView })));
const ReplayManagerView      = lazy(() => import('../views/runtime/ReplayManagerView').then(m => ({ default: m.ReplayManagerView })));
const PrewarmManagerView     = lazy(() => import('../views/runtime/PrewarmManagerView').then(m => ({ default: m.PrewarmManagerView })));
const RuntimeOperationsView  = lazy(() => import('../views/runtime/RuntimeOperationsView').then(m => ({ default: m.RuntimeOperationsView })));
const HistoryView            = lazy(() => import('../views/HistoryView').then(m => ({ default: m.HistoryView })));
const ArchivedView           = lazy(() => import('../views/ArchivedView').then(m => ({ default: m.ArchivedView })));
const RecentsView            = lazy(() => import('../views/RecentsView').then(m => ({ default: m.RecentsView })));
const SearchView             = lazy(() => import('../views/SearchView').then(m => ({ default: m.SearchView })));
const DebugView              = lazy(() => import('../views/code/DebugView').then(m => ({ default: m.DebugView })));
const InsightsView           = lazy(() => import('../views/cowork/InsightsView').then(m => ({ default: m.InsightsView })));
const ActivityView           = lazy(() => import('../views/cowork/ActivityView').then(m => ({ default: m.ActivityView })));
const GoalsView              = lazy(() => import('../views/cowork/GoalsView').then(m => ({ default: m.GoalsView })));
const MarketplaceView        = lazy(() => import('../views/MarketplaceView').then(m => ({ default: m.MarketplaceView })));
const SettingsView           = lazy(() => import('../views/settings/SettingsView').then(m => ({ default: m.SettingsView })));
const ModelManagementView    = lazy(() => import('../views/settings/ModelManagementView').then(m => ({ default: m.ModelManagementView })));
const MonitorView            = lazy(() => import('../views/MonitorView').then(m => ({ default: m.MonitorView })));
const CoworkRunsView         = lazy(() => import('../views/cowork/RunsView').then(m => ({ default: m.default })));
const DraftsView             = lazy(() => import('../views/cowork/DraftsView').then(m => ({ default: m.DraftsView })));
const TasksView              = lazy(() => import('../views/cowork/TasksView').then(m => ({ default: m.TasksView })));
const AutomationTasksView = lazy(() => import('../views/cowork/AutomationTasksView').then(m => ({ default: m.AutomationTasksView })));
const CoworkProjectView      = lazy(() => import('../views/cowork/CoworkProjectView').then(m => ({ default: m.CoworkProjectView })));
const DocumentsView          = lazy(() => import('../views/cowork/DocumentsView').then(m => ({ default: m.DocumentsView })));
const TablesView             = lazy(() => import('../views/cowork/TablesView').then(m => ({ default: m.TablesView })));
const FilesView              = lazy(() => import('../views/cowork/FilesView').then(m => ({ default: m.FilesView })));
const ExportsView            = lazy(() => import('../views/cowork/ExportsView').then(m => ({ default: m.ExportsView })));
const ProductsDiscoveryView  = lazy(() => import('../views/products/ProductsDiscoveryView').then(m => ({ default: m.ProductsDiscoveryView })));
const ManufacturingView      = lazy(() => import('../views/manufacturing/ManufacturingView').then(m => ({ default: m.ManufacturingView })));
const LibraryView            = lazy(() => import('../views/library/LibraryView').then(m => ({ default: m.LibraryView })));
const LabsView               = lazy(() => import('../views/LabsView').then(m => ({ default: m.LabsView })));
const BrainView              = lazy(() => import('../views/brain/BrainView').then(m => ({ default: m.BrainView })));
const CatalogView            = lazy(() => import('../views/CatalogView').then(m => ({ default: m.CatalogView })));
const ExplorerView           = lazy(() => import('../views/code/ExplorerView').then(m => ({ default: m.ExplorerView })));
const GitView                = lazy(() => import('../views/code/GitView').then(m => ({ default: m.GitView })));
const ThreadsView            = lazy(() => import('../views/code/ThreadsView').then(m => ({ default: m.ThreadsView })));
const SkillsView             = lazy(() => import('../views/code/SkillsView').then(m => ({ default: m.SkillsView })));
const CodeProjectView        = lazy(() => import('../views/code/CodeProjectView').then(m => ({ default: m.CodeProjectView })));
const AllternitOSView        = lazy(() => import('../views/AllternitOSView').then(m => ({ default: m.AllternitOSView })));
const VerificationView       = lazy(() => import('../views/VerificationView').then(m => ({ default: m.VerificationView })));
const BrowserExtensionsView  = lazy(() => import('../views/BrowserExtensionsView').then(m => ({ default: m.BrowserExtensionsView })));
const GoalsListView          = lazy(() => import('../views/automation/GoalsListView').then(m => ({ default: m.GoalsListView })));
const GoalDetailView         = lazy(() => import('../views/automation/GoalDetailView').then(m => ({ default: m.GoalDetailView })));
const RoutinesListView       = lazy(() => import('../views/automation/RoutinesListView').then(m => ({ default: m.RoutinesListView })));
const LoopsListView          = lazy(() => import('../views/automation/LoopsListView').then(m => ({ default: m.LoopsListView })));
const DocsView               = lazy(() => import('../views/docs/DocsView').then(m => ({ default: m.DocsView })));
const SlidesView             = lazy(() => import('../views/slides/SlidesView').then(m => ({ default: m.SlidesView })));
const SheetsView             = lazy(() => import('../views/sheets/SheetsView').then(m => ({ default: m.SheetsView })));
const PdfView                = lazy(() => import('../views/pdf/PdfView').then(m => ({ default: m.PdfView })));
const MarkdownPreviewView    = lazy(() => import('../views/office/MarkdownPreviewView').then(m => ({ default: m.MarkdownPreviewView })));

export function getShellViewRegistry(handlers: {
  handleOpenAgentSession: (text: string, surface: AppMode, execution?: { modeId: CanonicalAgentModeId; templateTitle?: string }) => void;
  open: (viewType: any, context?: any) => void;
}) {
  const { handleOpenAgentSession, open } = handlers;
  
  return createViewRegistry({
    home: () => <ChatViewWrapper onOpenAgentSession={handleOpenAgentSession} />,
    chat: () => <ChatViewWrapper onOpenAgentSession={handleOpenAgentSession} />,
    "chat-legacy": () => <ChatViewWrapper onOpenAgentSession={handleOpenAgentSession} />,
    project: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Projects" />}>
        <ProjectView />
      </ErrorBoundary>
    ),
    workspace: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Cowork" />}>
        <CoworkRoot />
      </ErrorBoundary>
    ),
    browser: ({ context }: { context?: ViewContext }) => (
      <BrowserPaneWrapper>
        <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="ACI" />}>
          <BrowserCapsuleEnhanced />
        </ErrorBoundary>
      </BrowserPaneWrapper>
    ),
    browserview: ({ context }: { context?: ViewContext }) => (
      <BrowserPaneWrapper>
        <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="ACI" />}>
          <BrowserCapsuleEnhanced />
        </ErrorBoundary>
      </BrowserPaneWrapper>
    ),
    'mini-apps-store': () => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Mini-apps" />}>
        <AciMiniAppsView />
      </ErrorBoundary>
    ),
    'mini-app-review': () => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Mini-app review" />}>
        <MiniAppReviewConsoleView />
      </ErrorBoundary>
    ),
    'mini-app': ({ context }: { context?: ViewContext }) => {
      const miniAppContext = context?.context as { name?: string } | undefined;
      return (
        <BrowserSurfaceFrame
          title={String(miniAppContext?.name ?? 'Mini-app')}
          subtitle="Embedded connector/runtime view in the browser surface."
        >
          <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Mini-app" />}>
            <AciMiniAppFrameView context={context as { context?: { url: string; name: string } } | undefined} />
          </ErrorBoundary>
        </BrowserSurfaceFrame>
      );
    },
    'addin-word': ({ context }: { context?: ViewContext }) => (
      <BrowserSurfaceFrame title="Word Add-in" subtitle="Real Microsoft Word connector companion view.">
        <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Word Add-in" />}>
          <AciAddinView host="word" context={context} />
        </ErrorBoundary>
      </BrowserSurfaceFrame>
    ),
    'addin-excel': ({ context }: { context?: ViewContext }) => (
      <BrowserSurfaceFrame title="Excel Add-in" subtitle="Real Microsoft Excel connector companion view.">
        <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Excel Add-in" />}>
          <AciAddinView host="excel" context={context} />
        </ErrorBoundary>
      </BrowserSurfaceFrame>
    ),
    'addin-ppt': ({ context }: { context?: ViewContext }) => (
      <BrowserSurfaceFrame title="PowerPoint Add-in" subtitle="Real Microsoft PowerPoint connector companion view.">
        <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="PowerPoint Add-in" />}>
          <AciAddinView host="powerpoint" context={context} />
        </ErrorBoundary>
      </BrowserSurfaceFrame>
    ),
    marketplace: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Marketplace" />}>
        <MarketplaceView />
      </ErrorBoundary>
    ),
    plugins: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Plugin Registry" />}>
        <PluginRegistryView />
      </ErrorBoundary>
    ),
    registry: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Tools Registry" />}>
        <ToolsView />
      </ErrorBoundary>
    ),
    memory: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Skills Registry" />}>
        <SkillsRegistryView />
      </ErrorBoundary>
    ),
    settings: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Settings" />}>
        <SettingsView />
      </ErrorBoundary>
    ),
    'browser-extensions': () => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Office & Extensions" />}>
        <BrowserExtensionsView openView={open} />
      </ErrorBoundary>
    ),
    terminal: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Terminal" />}>
        <TerminalView />
      </ErrorBoundary>
    ),
    monitor: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Monitor" />}>
        <MonitorView />
      </ErrorBoundary>
    ),
    "run-replay": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Run Replay" />}>
        <RunReplayView sessionId={(context?.context as any)?.sessionId} />
      </ErrorBoundary>
    ),
    'apps-extensions': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Apps & Extensions" />}>
        <AppsExtensionsView />
      </ErrorBoundary>
    ),
    "models-manage": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Model Management" />}>
        <ModelManagementView />
      </ErrorBoundary>
    ),
    code: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Code Editor" />}>
        <CodeRoot />
      </ErrorBoundary>
    ),
    playground: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Playground" />}>
        <PlaygroundView />
      </ErrorBoundary>
    ),
    "allternit-playground": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Allternit Playground" />}>
        <AllternitPlaygroundView />
      </ErrorBoundary>
    ),
    "agent-studio": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Agent Studio" />}>
        <AgentStudioView />
      </ErrorBoundary>
    ),
    elements: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Elements" />}>
        <ElementsView />
      </ErrorBoundary>
    ),
    'agent-hub': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Agent Hub" />}>
        <AgentHub />
      </ErrorBoundary>
    ),
    'bots': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Bots" />}>
        <AgentHub initialTab="bots" />
      </ErrorBoundary>
    ),
    "native-agent": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Native Agent" />}>
        <NativeAgentView onOpenRuntimeOps={() => open("runtime-ops")} />
      </ErrorBoundary>
    ),
    openclaw: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<OpenClawErrorFallback />}>
        <OpenClawView />
      </ErrorBoundary>
    ),
    "openclaw-chat": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<OpenClawErrorFallback />}>
        <OpenClawView />
      </ErrorBoundary>
    ),
    "openclaw-sessions": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<OpenClawErrorFallback />}>
        <OpenClawView />
      </ErrorBoundary>
    ),
    hermes: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Hermes" />}>
        <HermesView />
      </ErrorBoundary>
    ),
    'oh-my-pi': () => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Oh My Pi" />}>
        <OhMyPiView />
      </ErrorBoundary>
    ),
    'vault-viewer': () => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Vault Viewer" />}>
        <VaultViewerView />
      </ErrorBoundary>
    ),
    dag: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load DAG Integration</div>}>
        <DagIntegrationPage />
      </ErrorBoundary>
    ),
    deploy: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Cloud Deploy</div>}>
        <CloudDeployView />
      </ErrorBoundary>
    ),
    nodes: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Nodes</div>}>
        <NodesView />
      </ErrorBoundary>
    ),
    capsules: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Capsule Manager</div>}>
        <CapsuleManagerView />
      </ErrorBoundary>
    ),
    operator: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Operator Browser</div>}>
        <OperatorBrowserView />
      </ErrorBoundary>
    ),
    "allternit-ix": ({ context }: { context?: ViewContext }) => {
      const ctx = context?.context as any;
      return (
        <ErrorBoundary fallback={<div>Failed to load Design Workspace</div>}>
          <DesignModeView openView={open} initialDesignMd={ctx?.designMd} initialStream={ctx?.stream} />
        </ErrorBoundary>
      );
    },
    design: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Design Workspace</div>}>
        <DesignModeView openView={open} />
      </ErrorBoundary>
    ),
    "design-view-questions": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Design Discovery</div>}>
        <DesignModeView openView={open} initialTab="questions" />
      </ErrorBoundary>
    ),
    "design-view-mobile": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Mobile View</div>}>
        <DesignModeView openView={open} initialTab="mobile" />
      </ErrorBoundary>
    ),
    "design-view-video": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Video Editor</div>}>
        <DesignModeView openView={open} initialTab="video" />
      </ErrorBoundary>
    ),
    "design-view-docs": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Documents View</div>}>
        <DesignModeView openView={open} initialTab="docs" />
      </ErrorBoundary>
    ),
    "design-view-handoff": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Handoff View</div>}>
        <DesignModeView openView={open} initialTab="handoff" />
      </ErrorBoundary>
    ),
    "design-view-graph": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Skill Graph</div>}>
        <DesignModeView openView={open} initialTab="graph" />
      </ErrorBoundary>
    ),
    "design-view-pipeline": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Pipeline View</div>}>
        <DesignModeView openView={open} initialTab="pipeline" />
      </ErrorBoundary>
    ),
    "design-view-market": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Design Marketplace</div>}>
        <DesignRegistryView />
      </ErrorBoundary>
    ),
    "design-view-compare": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Design Compare</div>}>
        <DesignRegistryView />
      </ErrorBoundary>
    ),
    "design-marketplace": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Hyperdesign Marketplace</div>}>
        <DesignRegistryView />
      </ErrorBoundary>
    ),
    docs: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Docs" />}>
        <DocsView
          artifactId={(context?.context as { artifactId?: string } | undefined)?.artifactId ?? context?.viewId}
          handoffId={(context?.context as { handoffId?: string } | undefined)?.handoffId}
        />
      </ErrorBoundary>
    ),
    slides: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Slides" />}>
        <SlidesView
          artifactId={(context?.context as { artifactId?: string } | undefined)?.artifactId ?? context?.viewId}
          handoffId={(context?.context as { handoffId?: string } | undefined)?.handoffId}
        />
      </ErrorBoundary>
    ),
    sheets: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Sheets" />}>
        <SheetsView
          artifactId={(context?.context as { artifactId?: string } | undefined)?.artifactId ?? context?.viewId}
          handoffId={(context?.context as { handoffId?: string } | undefined)?.handoffId}
        />
      </ErrorBoundary>
    ),
    pdf: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="PDF" />}>
        <PdfView
          artifactId={(context?.context as { artifactId?: string } | undefined)?.artifactId ?? context?.viewId}
          handoffId={(context?.context as { handoffId?: string } | undefined)?.handoffId}
        />
      </ErrorBoundary>
    ),
    "markdown-preview": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Markdown Preview" />}>
        <MarkdownPreviewView
          handoffId={(context?.context as { handoffId?: string } | undefined)?.handoffId}
          sourceUrl={(context?.context as { sourceUrl?: string } | undefined)?.sourceUrl}
        />
      </ErrorBoundary>
    ),
    "form-surfaces": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Form Surfaces</div>}>
        <FormSurfacesView />
      </ErrorBoundary>
    ),
    canvas: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Canvas Protocol</div>}>
        <CanvasProtocolView />
      </ErrorBoundary>
    ),
    "allternit-canvas": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Allternit-Canvas</div>}>
        <AllternitCanvasView
          sourceView={((context!.viewType as string) as any) || 'chat'}
          sessionId={context!.viewId}
        />
      </ErrorBoundary>
    ),
    "allternit-os": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load AllternitOS</div>}>
        <AllternitOSView context={context!} />
      </ErrorBoundary>
    ),
    hooks: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Hooks System</div>}>
        <HooksSystemView />
      </ErrorBoundary>
    ),
    evolution: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Evolution Layer</div>}>
        <EvolutionLayerView />
      </ErrorBoundary>
    ),
    "context-control": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Context Control</div>}>
        <ContextControlPlaneView />
      </ErrorBoundary>
    ),
    "memory-kernel": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Memory Kernel</div>}>
        <MemoryKernelView />
      </ErrorBoundary>
    ),
    acf: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div>Failed to load Autonomous Code Factory</div>}>
        <AutonomousCodeFactoryView />
      </ErrorBoundary>
    ),
    swarm: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Swarm ADE" />}>
        <SwarmADE />
      </ErrorBoundary>
    ),
    policy: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Policy Manager" />}>
        <PolicyManager />
      </ErrorBoundary>
    ),
    "task-executor": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Task Executor" />}>
        <TaskExecutor />
      </ErrorBoundary>
    ),
    ontology: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Ontology Viewer" />}>
        <OntologyViewer />
      </ErrorBoundary>
    ),
    ivkge: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="IVKGE Panel" />}>
        <IVKGEPanel />
      </ErrorBoundary>
    ),
    multimodal: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Multimodal Input" />}>
        <MultimodalInput />
      </ErrorBoundary>
    ),
    tambo: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="UI Forge" />}>
        <UIForge />
      </ErrorBoundary>
    ),
    receipts: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Receipts Viewer" />}>
        <ReceiptsViewer />
      </ErrorBoundary>
    ),
    "policy-gating": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Policy Gating" />}>
        <PolicyGating />
      </ErrorBoundary>
    ),
    security: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Security Dashboard" />}>
        <SecurityDashboard />
      </ErrorBoundary>
    ),
    purpose: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Purpose Binding" />}>
        <PurposeBinding />
      </ErrorBoundary>
    ),
    "dag-wih": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="DAG WIH" />}>
        <DAGWIH />
      </ErrorBoundary>
    ),
    checkpointing: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Checkpointing" />}>
        <Checkpointing />
      </ErrorBoundary>
    ),
    observability: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Observability Dashboard" />}>
        <ObservabilityDashboard />
      </ErrorBoundary>
    ),
    directive: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Directive Compiler" />}>
        <DirectiveCompiler />
      </ErrorBoundary>
    ),
    evaluation: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Evaluation Harness" />}>
        <EvaluationHarness />
      </ErrorBoundary>
    ),
    "gc-agents": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="GC Agents" />}>
        <GCAgents />
      </ErrorBoundary>
    ),
    "runtime-ops": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Runtime Operations" />}>
        <RuntimeOperationsView onOpenView={open} />
      </ErrorBoundary>
    ),
    "budget-dashboard": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Budget Dashboard" />}>
        <BudgetDashboardView />
      </ErrorBoundary>
    ),
    "replay-manager": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Replay Manager" />}>
        <ReplayManagerView />
      </ErrorBoundary>
    ),
    "prewarm-manager": ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Prewarm Manager" />}>
        <PrewarmManagerView />
      </ErrorBoundary>
    ),
    history: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="History" />}>
        <HistoryView />
      </ErrorBoundary>
    ),
    archived: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Archived" />}>
        <ArchivedView />
      </ErrorBoundary>
    ),
    recents: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Recents" />}>
        <RecentsView />
      </ErrorBoundary>
    ),
    search: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Search" />}>
        <SearchView />
      </ErrorBoundary>
    ),
    debug: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Debug" />}>
        <DebugView />
      </ErrorBoundary>
    ),
    insights: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Insights" />}>
        <InsightsView />
      </ErrorBoundary>
    ),
    activity: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Activity" />}>
        <ActivityView />
      </ErrorBoundary>
    ),
    goals: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Goals" />}>
        <GoalsView />
      </ErrorBoundary>
    ),
    'cowork-runs': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Cowork Runs" />}>
        <CoworkRunsView />
      </ErrorBoundary>
    ),
    'cowork-drafts': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Drafts" />}>
        <DraftsView />
      </ErrorBoundary>
    ),
    'cowork-tasks': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Tasks" />}>
        <TasksView />
      </ErrorBoundary>
    ),
    'cowork-cron': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Automation Tasks" />}>
        <AutomationTasksView />
      </ErrorBoundary>
    ),
    'cowork-project': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Cowork Project" />}>
        <CoworkProjectView />
      </ErrorBoundary>
    ),
    'cowork-documents': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Documents" />}>
        <DocumentsView openView={open} />
      </ErrorBoundary>
    ),
    'cowork-tables': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Tables" />}>
        <TablesView />
      </ErrorBoundary>
    ),
    'cowork-files': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Files" />}>
        <FilesView />
      </ErrorBoundary>
    ),
    'cowork-exports': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Exports" />}>
        <ExportsView />
      </ErrorBoundary>
    ),
    'cowork-new-task': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="New Task" />}>
        <CoworkRoot />
      </ErrorBoundary>
    ),
    products: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Products Discovery" />}>
        <ProductsDiscoveryView />
      </ErrorBoundary>
    ),
    manufacturing: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Allternit Manufacturing" />}>
        <ManufacturingView />
      </ErrorBoundary>
    ),
    library: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Artifacts Library" />}>
        <LibraryView openView={open} />
      </ErrorBoundary>
    ),
    labs: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="A://Labs" />}>
        <LabsView />
      </ErrorBoundary>
    ),
    brain: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Second Brain" />}>
        <ToastProvider>
          <BrainView />
        </ToastProvider>
      </ErrorBoundary>
    ),
    catalog: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Udemy Catalog" />}>
        <CatalogView />
      </ErrorBoundary>
    ),
    'code-explorer': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Code Explorer" />}>
        <ExplorerView />
      </ErrorBoundary>
    ),
    'code-git': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Git" />}>
        <GitView />
      </ErrorBoundary>
    ),
    'code-threads': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Code Recents" />}>
        <ThreadsView />
      </ErrorBoundary>
    ),
    'code-automations': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Automation Tasks" />}>
        <AutomationTasksView />
      </ErrorBoundary>
    ),
    'code-skills': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Code Skills" />}>
        <SkillsView />
      </ErrorBoundary>
    ),
    'code-project': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Code Workspace" />}>
        <CodeProjectView />
      </ErrorBoundary>
    ),
    'chat-agent-session': ({ context }: { context?: ViewContext }) => {
      const ctx = context?.context as { sessionId?: string; originView?: ViewType } | undefined;
      return (
        <ChatModeAgentSession
          mode="chat"
          sessionId={ctx?.sessionId ?? context!.viewId}
          context={typeof window !== 'undefined' ? window.sessionStorage.getItem('allternit-pending-agent-message') || undefined : undefined}
          onClose={() => open(ctx?.originView ?? 'chat')}
        />
      );
    },
    'cowork-agent-session': ({ context }: { context?: ViewContext }) => {
      const ctx = context?.context as { sessionId?: string; originView?: ViewType } | undefined;
      React.useEffect(() => {
        if (ctx?.sessionId) {
          useCoworkSessionStore.getState().setActiveSession(ctx.sessionId);
        }
      }, [ctx?.sessionId]);
      return (
        <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Cowork Agent Workspace" />}>
          <CoworkRoot />
        </ErrorBoundary>
      );
    },
    'code-agent-session': ({ context }: { context?: ViewContext }) => {
      const ctx = context?.context as { sessionId?: string; originView?: ViewType } | undefined;
      return (
        <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Code Agent Workspace" />}>
          <CodeModeAgentSession sessionId={ctx?.sessionId ?? context!.viewId} onClose={() => open(ctx?.originView ?? 'code')} />
        </ErrorBoundary>
      );
    },
    'design-agent-session': ({ context }: { context?: ViewContext }) => {
      const ctx = context?.context as { sessionId?: string; originView?: ViewType } | undefined;
      return (
        <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Design Agent Workspace" />}>
          <DesignModeAgentSession sessionId={ctx?.sessionId ?? context!.viewId} onClose={() => open(ctx?.originView ?? 'design')} />
        </ErrorBoundary>
      );
    },
    'new-document': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div style={{ padding: 16, color: 'var(--text-secondary)' }}>Failed to load</div>}>
        <CoworkRoot />
      </ErrorBoundary>
    ),
    'new-file': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<div style={{ padding: 16, color: 'var(--text-secondary)' }}>Failed to load</div>}>
        <CodeRoot />
      </ErrorBoundary>
    ),
    verification: ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Visual Verification" />}>
        <VerificationView />
      </ErrorBoundary>
    ),
    'goals-list': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Automation Tasks" />}>
        <AutomationTasksView initialTab="goal" />
      </ErrorBoundary>
    ),
    'goal-detail': ({ context }: { context?: ViewContext }) => {
      const ctx = context?.context as { goalId?: string } | undefined;
      return (
        <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Goal Detail" />}>
          <GoalDetailView goalId={ctx?.goalId ?? ''} />
        </ErrorBoundary>
      );
    },
    'routines-list': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Automation Tasks" />}>
        <AutomationTasksView initialTab="routine" />
      </ErrorBoundary>
    ),
    'loops-list': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Automation Tasks" />}>
        <AutomationTasksView initialTab="loop" />
      </ErrorBoundary>
    ),
    'cron': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Automation Tasks" />}>
        <AutomationTasksView />
      </ErrorBoundary>
    ),
    'dispatch': ({ context }: { context?: ViewContext }) => (
      <ErrorBoundary fallback={<ErrorFallbackWrapper viewName="Dispatch" />}>
        <DispatchView />
      </ErrorBoundary>
    ),
  });
}
