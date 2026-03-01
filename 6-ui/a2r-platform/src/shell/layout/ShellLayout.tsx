"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { LayoutProvider, type LayoutConfig } from './layout-context';
import { useLayout } from './useLayout';
import type { SidebarItem } from './Sidebar';
import type { BreadcrumbItem, TopBarAction } from './TopBar';
import type { BottomBarAction } from './BottomBar';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomBar } from './BottomBar';
import { PanelContainer, PanelToggleButton } from './PanelContainer';
import { PanelConfig } from './layout-context';

// =============================================================================
// Types
// =============================================================================

export interface ShellLayoutProps {
  children: React.ReactNode;
  
  // Layout configuration
  sidebar?: {
    enabled: boolean;
    defaultOpen?: boolean;
    width?: number;
    collapsible?: boolean;
    items?: SidebarItem[];
    header?: React.ReactNode;
    footer?: React.ReactNode;
  };
  
  topbar?: {
    enabled: boolean;
    height?: number;
    title?: string;
    breadcrumbs?: BreadcrumbItem[];
    actions?: TopBarAction[];
    showSearch?: boolean;
    showNotifications?: boolean;
    showProfile?: boolean;
    left?: React.ReactNode;
    center?: React.ReactNode;
    right?: React.ReactNode;
  };
  
  bottombar?: {
    enabled: boolean;
    height?: number;
    connectionStatus?: 'connected' | 'connecting' | 'disconnected';
    syncStatus?: 'synced' | 'syncing' | 'offline' | 'error';
    currentContext?: string;
    selectedItems?: number;
    actions?: BottomBarAction[];
    right?: React.ReactNode;
    showVersion?: boolean;
    version?: string;
  };
  
  panels?: {
    left?: PanelConfig;
    right?: PanelConfig;
    bottom?: PanelConfig;
  };
  
  // Responsive breakpoints
  breakpoints?: {
    sidebarHide?: number;
    panelStack?: number;
  };
  
  // Styling
  className?: string;
  contentClassName?: string;
}

// =============================================================================
// ShellLayout Component
// =============================================================================

export function ShellLayout({
  children,
  sidebar,
  topbar,
  bottombar,
  panels,
  breakpoints,
  className,
  contentClassName,
}: ShellLayoutProps) {
  // Build layout config
  const layoutConfig: LayoutConfig = {
    sidebar: sidebar?.enabled ? {
      enabled: true,
      defaultOpen: sidebar.defaultOpen,
      width: sidebar.width,
      collapsible: sidebar.collapsible,
    } : { enabled: false },
    topbar: topbar?.enabled ? {
      enabled: true,
      height: topbar.height,
    } : { enabled: false },
    bottombar: bottombar?.enabled ? {
      enabled: true,
      height: bottombar.height,
    } : { enabled: false },
    panels,
    breakpoints,
  };

  return (
    <LayoutProvider config={layoutConfig}>
      <ShellLayoutInner
        sidebar={sidebar}
        topbar={topbar}
        bottombar={bottombar}
        panels={panels}
        className={className}
        contentClassName={contentClassName}
      >
        {children}
      </ShellLayoutInner>
    </LayoutProvider>
  );
}

// =============================================================================
// ShellLayoutInner Component
// =============================================================================

interface ShellLayoutInnerProps {
  children: React.ReactNode;
  sidebar?: ShellLayoutProps['sidebar'];
  topbar?: ShellLayoutProps['topbar'];
  bottombar?: ShellLayoutProps['bottombar'];
  panels?: ShellLayoutProps['panels'];
  className?: string;
  contentClassName?: string;
}

function ShellLayoutInner({
  children,
  sidebar,
  topbar,
  bottombar,
  panels,
  className,
  contentClassName,
}: ShellLayoutInnerProps) {
  const { isMobile, leftPanelOpen, rightPanelOpen, bottomPanelOpen } = useLayout();

  return (
    <div 
      className={cn(
        'shell-layout h-screen w-screen flex flex-col overflow-hidden',
        'bg-background text-foreground',
        className
      )}
    >
      {/* TopBar */}
      {topbar?.enabled && (
        <TopBar
          height={topbar.height}
          title={topbar.title}
          breadcrumbs={topbar.breadcrumbs}
          actions={topbar.actions}
          showSearch={topbar.showSearch}
          showNotifications={topbar.showNotifications}
          showProfile={topbar.showProfile}
          left={topbar.left}
          center={topbar.center}
          right={(
            <>
              {/* Panel toggle buttons */}
              <div className="flex items-center gap-1 mr-2">
                <PanelToggleButton position="left" />
                <PanelToggleButton position="right" />
                <PanelToggleButton position="bottom" />
              </div>
              {topbar.right}
            </>
          )}
        />
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebar?.enabled && sidebar.items && (
          <Sidebar
            items={sidebar.items}
            header={sidebar.header}
            footer={sidebar.footer}
            collapsible={sidebar.collapsible}
            defaultOpen={sidebar.defaultOpen}
            width={sidebar.width}
          />
        )}

        {/* Center Content */}
        <main className="flex-1 flex overflow-hidden">
          {/* Left Panel */}
          {panels?.left && (
            <PanelContainer 
              position="left" 
              panels={panels.left ? [panels.left] : undefined}
            />
          )}
          {!panels?.left && leftPanelOpen && (
            <PanelContainer position="left" />
          )}

          {/* Main Content */}
          <div 
            className={cn(
              'flex-1 flex flex-col overflow-hidden',
              contentClassName
            )}
          >
            <div className="flex-1 overflow-auto">
              {children}
            </div>

            {/* Bottom Panel (inside main) */}
            {panels?.bottom && (
              <PanelContainer 
                position="bottom" 
                panels={panels.bottom ? [panels.bottom] : undefined}
              />
            )}
            {!panels?.bottom && bottomPanelOpen && (
              <PanelContainer position="bottom" />
            )}
          </div>

          {/* Right Panel */}
          {panels?.right && (
            <PanelContainer 
              position="right" 
              panels={panels.right ? [panels.right] : undefined}
            />
          )}
          {!panels?.right && rightPanelOpen && (
            <PanelContainer position="right" />
          )}
        </main>
      </div>

      {/* BottomBar */}
      {bottombar?.enabled && (
        <BottomBar
          height={bottombar.height}
          connectionStatus={bottombar.connectionStatus}
          syncStatus={bottombar.syncStatus}
          currentContext={bottombar.currentContext}
          selectedItems={bottombar.selectedItems}
          actions={bottombar.actions}
          right={bottombar.right}
          showVersion={bottombar.showVersion}
          version={bottombar.version}
        />
      )}
    </div>
  );
}

// =============================================================================
// Layout Presets
// =============================================================================

export const layoutPresets = {
  // Default: Sidebar + main content
  default: {
    sidebar: { enabled: true, defaultOpen: true, width: 256 },
    topbar: { enabled: true },
    bottombar: { enabled: true },
    panels: undefined,
  },
  
  // Focus: Minimal chrome
  focus: {
    sidebar: { enabled: true, defaultOpen: false },
    topbar: { enabled: true },
    bottombar: { enabled: false },
    panels: {
      left: { id: 'left', title: 'Explorer', enabled: false },
      right: { id: 'right', title: 'Inspector', enabled: false },
      bottom: { id: 'bottom', title: 'Terminal', enabled: false },
    },
  },
  
  // Fullscreen: No chrome
  fullscreen: {
    sidebar: { enabled: false },
    topbar: { enabled: false },
    bottombar: { enabled: false },
    panels: undefined,
  },
  
  // IDE: Panels on all sides
  ide: {
    sidebar: { enabled: true, defaultOpen: true },
    topbar: { enabled: true },
    bottombar: { enabled: true },
    panels: {
      left: { id: 'left', title: 'Explorer', enabled: true, defaultSize: 20 },
      right: { id: 'right', title: 'Inspector', enabled: true, defaultSize: 20 },
      bottom: { id: 'bottom', title: 'Terminal', enabled: true, defaultSize: 25 },
    },
  },
} as const;

export type LayoutPresetKey = keyof typeof layoutPresets;

// =============================================================================
// Helper Components
// =============================================================================

export function ShellLayoutWithPreset({
  preset,
  children,
  ...props
}: {
  preset: LayoutPresetKey;
  children: React.ReactNode;
} & Omit<ShellLayoutProps, 'sidebar' | 'topbar' | 'bottombar' | 'panels'>) {
  const presetConfig = layoutPresets[preset];
  
  return (
    <ShellLayout
      {...presetConfig}
      {...props}
    >
      {children}
    </ShellLayout>
  );
}

// Re-export everything
export { Sidebar, type SidebarItem } from './Sidebar';
export { TopBar, type BreadcrumbItem, type TopBarAction } from './TopBar';
export { BottomBar, type ConnectionStatus, type SyncStatus, type BottomBarAction } from './BottomBar';
export { PanelContainer } from './PanelContainer';
export { type PanelConfig } from './layout-context';
export { useLayout, useSidebar, usePanels, useResponsiveLayout, useLayoutPresets } from './useLayout';
