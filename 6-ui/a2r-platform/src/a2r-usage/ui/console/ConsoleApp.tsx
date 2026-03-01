/**
 * Console App Root
 * 
 * Main entry point for the A2R Console control plane.
 * This is a first-class ShellUI app, not a sub-view.
 */

import React, { useState, useEffect } from 'react';
import { ConsoleLayout } from './components/ConsoleLayout';
import { DashboardPage } from './pages/DashboardPage';
import { DeployPage } from './pages/DeployPage';
import { InstancesPage } from './pages/InstancesPage';
import { SwarmsPage } from './pages/SwarmsPage';
import { ProvidersPage } from './pages/ProvidersPage';
import { ObservabilityPage } from './pages/ObservabilityPage';
import type { ConsoleRoute } from './index';
import './ConsoleApp.css';

export const ConsoleApp: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState<ConsoleRoute>('dashboard');
  const [liveSignals, setLiveSignals] = useState({
    connectedProviders: 0,
    healthyInstances: 0,
    totalInstances: 0,
    activeSwarms: 0,
    eventBusConnected: true,
  });

  // In production, subscribe to real-time updates via WebSocket/event bus
  useEffect(() => {
    // Simulated live signals - replace with actual event bus subscription
    const interval = setInterval(() => {
      setLiveSignals(prev => ({
        ...prev,
        // In production, fetch from backend
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const renderPage = () => {
    switch (currentRoute) {
      case 'dashboard':
        return <DashboardPage />;
      case 'deploy':
        return <DeployPage />;
      case 'instances':
        return <InstancesPage />;
      case 'swarms':
        return <SwarmsPage />;
      case 'providers':
        return <ProvidersPage />;
      case 'observability':
        return <ObservabilityPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <ConsoleLayout
      currentRoute={currentRoute}
      onRouteChange={setCurrentRoute}
      liveSignals={liveSignals}
    >
      {renderPage()}
    </ConsoleLayout>
  );
};

export default ConsoleApp;
