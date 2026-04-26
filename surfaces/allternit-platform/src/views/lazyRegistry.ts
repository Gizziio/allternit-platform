/**
 * Lazy View Registry - Route-based Code Splitting
 * 
 * Dynamically imports views only when needed, reducing initial bundle size.
 * 
 * Performance Targets:
 * - Initial bundle: < 500KB
 * - Lazy chunks loaded on demand
 * - View transitions: < 100ms perceived delay
 */

import React, { lazy, Suspense, ComponentType } from 'react';
import type { ViewContext, ViewType } from '../nav/nav.types';
import { ViewSkeleton, DashboardSkeleton, CodeEditorSkeleton } from '../components/performance/ViewSkeleton';

// ============================================================================
// Lazy-loaded View Components
// ============================================================================

// Core views - Eager loaded for fast initial render
export { HomeView } from './HomeView';

// Chat view - Critical path, eager loaded with internal lazy components
export { ChatView } from './ChatView';

// Playground - eager loaded (lightweight, no heavy deps)
export { PlaygroundView } from './PlaygroundView';

// Lazy-loaded views by category

// Workspace & Collaboration
export const CoworkRoot = lazy(() => import('./cowork/CoworkRoot').then(m => ({ default: m.CoworkRoot })));
export const PluginRegistryView = lazy(() => import('./cowork/PluginRegistryView').then(m => ({ default: m.PluginRegistryView })));

// Code & Development
export const CodeRoot = lazy(() => import('./code/CodeRoot').then(m => ({ default: m.CodeRoot })));
export const ToolsView = lazy(() => import('./code/ToolsView').then(m => ({ default: m.ToolsView })));
export const RunReplayView = lazy(() => import('./code/RunReplayView').then(m => ({ default: m.RunReplayView })));
export const PromotionDashboardView = lazy(() => import('./code/PromotionDashboardView').then(m => ({ default: m.PromotionDashboardView })));
export const SkillsRegistryView = lazy(() => import('./code/SkillsRegistryView').then(m => ({ default: m.SkillsRegistryView })));

// Terminal - Heavy component with xterm
export const TerminalView = lazy(() => import('./TerminalView').then(m => ({ default: m.TerminalView })));

// Agent views
export const AgentView = lazy(() => import('./AgentView').then(m => ({ default: m.AgentView })));
export const AgentHub = lazy(() => import('./AgentHub').then(m => ({ default: m.AgentHub })));
export const AgentSystemView = lazy(() => import('./AgentSystemView').then(m => ({ default: m.AgentSystemView })));
export const NativeAgentView = lazy(() => import('./NativeAgentView').then(m => ({ default: m.NativeAgentView })));

// OpenClaw - Heavy control UI
export const OpenClawControlUI = lazy(() => import('./openclaw/OpenClawControlUI').then(m => ({ default: m.OpenClawControlUI })));

// DAG & Infrastructure views
export const DagIntegrationPage = lazy(() => import('./DagIntegrationPage').then(m => ({ default: m.DagIntegrationPage })));

// DAG Views - Individual lazy chunks
export const SwarmMonitor = lazy(() => import('./dag/SwarmMonitor').then(m => ({ default: m.SwarmMonitor })));
export const PolicyManager = lazy(() => import('./dag/PolicyManager').then(m => ({ default: m.PolicyManager })));
export const TaskExecutor = lazy(() => import('./dag/TaskExecutor').then(m => ({ default: m.TaskExecutor })));
export const OntologyViewer = lazy(() => import('./dag/OntologyViewer').then(m => ({ default: m.OntologyViewer })));
export const DirectiveCompiler = lazy(() => import('./dag/DirectiveCompiler').then(m => ({ default: m.DirectiveCompiler })));
export const EvaluationHarness = lazy(() => import('./dag/EvaluationHarness').then(m => ({ default: m.EvaluationHarness })));
export const GCAgents = lazy(() => import('./dag/GCAgents').then(m => ({ default: m.GCAgents })));
export const ReceiptsViewer = lazy(() => import('./dag/ReceiptsViewer').then(m => ({ default: m.ReceiptsViewer })));
export const PolicyGating = lazy(() => import('./dag/PolicyGating').then(m => ({ default: m.PolicyGating })));
export const SecurityDashboard = lazy(() => import('./dag/SecurityDashboard').then(m => ({ default: m.SecurityDashboard })));
export const PurposeBinding = lazy(() => import('./dag/PurposeBinding').then(m => ({ default: m.PurposeBinding })));
export const BrowserView = lazy(() => import('./dag/BrowserView').then(m => ({ default: m.BrowserView })));
export const DAGWIH = lazy(() => import('./dag/DAGWIH').then(m => ({ default: m.DAGWIH })));
export const Checkpointing = lazy(() => import('./dag/Checkpointing').then(m => ({ default: m.Checkpointing })));
export const ObservabilityDashboard = lazy(() => import('./dag/ObservabilityDashboard').then(m => ({ default: m.ObservabilityDashboard })));

// Dashboard views from dag
export const SwarmDashboard = lazy(() => import('./SwarmDashboard/SwarmDashboard').then(m => ({ default: m.SwarmDashboard })));
export const IVKGEPanel = lazy(() => import('./IVKGEPanel/IVKGEPanel').then(m => ({ default: m.IVKGEPanel })));
export const MultimodalInput = lazy(() => import('./MultimodalInput/MultimodalInput').then(m => ({ default: m.MultimodalInput })));
export const UIForge = lazy(() => import('./UIForge/UIForge').then(m => ({ default: m.UIForge })));

// Cloud & Infrastructure
export const CloudDeployView = lazy(() => import('./cloud-deploy/CloudDeployView').then(m => ({ default: m.CloudDeployView })));
export const NodesView = lazy(() => import('./nodes/NodesView').then(m => ({ default: m.NodesView })));
export const CapsuleManagerView = lazy(() => import('./CapsuleManagerView').then(m => ({ default: m.CapsuleManagerView })));
export const OperatorBrowserView = lazy(() => import('./OperatorBrowserView').then(m => ({ default: m.OperatorBrowserView })));

// P3 UI Views
export const BlueprintCanvas = lazy(() => import('./BlueprintCanvas').then(m => ({ default: m.BlueprintCanvas })));
export const DesignRegistryView = lazy(() => import('./design/DesignRegistryView').then(m => ({ default: m.DesignRegistryView })));
export const FormSurfacesView = lazy(() => import('./FormSurfacesView').then(m => ({ default: m.FormSurfacesView })));
export const CanvasProtocolView = lazy(() => import('./CanvasProtocolView').then(m => ({ default: m.CanvasProtocolView })));
export const HooksSystemView = lazy(() => import('./HooksSystemView').then(m => ({ default: m.HooksSystemView })));

// P4 UI Views
export const EvolutionLayerView = lazy(() => import('./EvolutionLayerView').then(m => ({ default: m.EvolutionLayerView })));
export const ContextControlPlaneView = lazy(() => import('./ContextControlPlaneView').then(m => ({ default: m.ContextControlPlaneView })));
export const MemoryKernelView = lazy(() => import('./MemoryKernelView').then(m => ({ default: m.MemoryKernelView })));
export const AutonomousCodeFactoryView = lazy(() => import('./AutonomousCodeFactoryView').then(m => ({ default: m.AutonomousCodeFactoryView })));

// Runtime Management
export const RuntimeOperationsView = lazy(() => import('./runtime/RuntimeOperationsView').then(m => ({ default: m.RuntimeOperationsView })));
export const BudgetDashboardView = lazy(() => import('./runtime/BudgetDashboardView').then(m => ({ default: m.BudgetDashboardView })));
export const ReplayManagerView = lazy(() => import('./runtime/ReplayManagerView').then(m => ({ default: m.ReplayManagerView })));
export const PrewarmManagerView = lazy(() => import('./runtime/PrewarmManagerView').then(m => ({ default: m.PrewarmManagerView })));

// Other views
export const RunnerView = lazy(() => import('./RunnerView').then(m => ({ default: m.RunnerView })));
export const RailsView = lazy(() => import('./RailsView').then(m => ({ default: m.RailsView })));
export const ProjectView = lazy(() => import('./ProjectView').then(m => ({ default: m.ProjectView })));

// ============================================================================
// View Loading Skeletons by Category
// ============================================================================

const viewSkeletons: Record<string, React.ReactNode> = {
  // Default skeleton
  default: React.createElement(ViewSkeleton),
  
  // Dashboard-style views
  dag: React.createElement(DashboardSkeleton),
  swarm: React.createElement(DashboardSkeleton),
  observability: React.createElement(DashboardSkeleton),
  security: React.createElement(DashboardSkeleton),
  budget: React.createElement(DashboardSkeleton),
  
  // Code/editor views
  code: React.createElement(CodeEditorSkeleton),
  terminal: React.createElement(CodeEditorSkeleton),
  'run-replay': React.createElement(CodeEditorSkeleton),
};

/**
 * Get the appropriate skeleton for a view type
 */
export function getViewSkeleton(viewType: ViewType): React.ReactNode {
  // Check for exact match
  if (viewSkeletons[viewType]) {
    return viewSkeletons[viewType];
  }
  
  // Check for partial matches
  for (const [key, skeleton] of Object.entries(viewSkeletons)) {
    if (viewType.includes(key)) {
      return skeleton;
    }
  }
  
  return viewSkeletons.default;
}

// ============================================================================
// Lazy View Wrapper with Suspense
// ============================================================================

interface LazyViewWrapperProps {
  children: React.ReactNode;
  viewType: ViewType;
}

/**
 * Wrapper component that provides Suspense fallback for lazy views
 */
export function LazyViewWrapper({ children, viewType }: LazyViewWrapperProps) {
  return React.createElement(
    Suspense,
    { fallback: getViewSkeleton(viewType) },
    children
  );
}

// ============================================================================
// Preload Utilities
// ============================================================================

const preloadCache = new Set<string>();

/**
 * Preload a view component before it's needed
 */
export function preloadView(viewType: ViewType): void {
  if (preloadCache.has(viewType)) return;
  
  // Map view types to their dynamic imports
  const preloaders: Partial<Record<ViewType, () => Promise<unknown>>> = {
    code: () => import('./code/CodeRoot'),
    terminal: () => import('./TerminalView'),
    workspace: () => import('./cowork/CoworkRoot'),
    dag: () => import('./DagIntegrationPage'),
    deploy: () => import('./cloud-deploy/CloudDeployView'),
  };
  
  const preloader = preloaders[viewType];
  if (preloader) {
    preloadCache.add(viewType);
    // Use requestIdleCallback if available
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        preloader().catch(() => {
          // Silent fail for preloading
          preloadCache.delete(viewType);
        });
      }, { timeout: 2000 });
    } else {
      setTimeout(() => {
        preloader().catch(() => {
          preloadCache.delete(viewType);
        });
      }, 100);
    }
  }
}

/**
 * Preload multiple views
 */
export function preloadViews(viewTypes: ViewType[]): void {
  viewTypes.forEach(preloadView);
}

// ============================================================================
// Export type helpers
// ============================================================================

export type LazyViewComponent = React.LazyExoticComponent<ComponentType<{ context: ViewContext }>>;
