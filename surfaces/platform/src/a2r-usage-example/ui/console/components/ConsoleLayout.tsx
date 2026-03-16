/**
 * Console Layout
 * 
 * The main layout for the Console control plane.
 * Includes:
 * - ConsoleHeader (title, live signals, env switch, CTA)
 * - ConsoleSubNav (internal navigation)
 * - ConsoleStatusSpine (persistent status strip)
 * - Viewport (page content)
 */

import React from 'react';
import { ConsoleHeader } from './ConsoleHeader';
import { ConsoleSubNav } from './ConsoleSubNav';
import { ConsoleStatusSpine } from './ConsoleStatusSpine';
import type { ConsoleRoute } from '../index';

export interface LiveSignals {
  connectedProviders: number;
  healthyInstances: number;
  totalInstances: number;
  activeSwarms: number;
  eventBusConnected: boolean;
}

interface ConsoleLayoutProps {
  currentRoute: ConsoleRoute;
  onRouteChange: (route: ConsoleRoute) => void;
  liveSignals: LiveSignals;
  children: React.ReactNode;
}

export const ConsoleLayout: React.FC<ConsoleLayoutProps> = ({
  currentRoute,
  onRouteChange,
  liveSignals,
  children,
}) => {
  return (
    <div className="console-layout">
      {/* Header - Always visible */}
      <ConsoleHeader 
        liveSignals={liveSignals}
        environment="production"
        onDeployClick={() => onRouteChange('deploy')}
      />

      {/* Sub-nav - Internal Console navigation */}
      <ConsoleSubNav 
        currentRoute={currentRoute}
        onRouteChange={onRouteChange}
      />

      {/* Main content area */}
      <main className="console-viewport">
        {children}
      </main>

      {/* Status Spine - Persistent status strip at bottom */}
      <ConsoleStatusSpine />
    </div>
  );
};

export default ConsoleLayout;
