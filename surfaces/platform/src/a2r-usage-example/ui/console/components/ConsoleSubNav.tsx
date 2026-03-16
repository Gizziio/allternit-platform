/**
 * Console Sub-Navigation
 * 
 * Internal navigation for Console app.
 * Clean, minimal, no fluff.
 */

import React from 'react';
import type { ConsoleRoute } from '../index';
import { cn } from '@/a2r-usage/ui/lib/utils';

interface ConsoleSubNavProps {
  currentRoute: ConsoleRoute;
  onRouteChange: (route: ConsoleRoute) => void;
}

const navItems: { id: ConsoleRoute; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'deploy', label: 'Deploy', icon: '🚀' },
  { id: 'instances', label: 'Instances', icon: '🖥️' },
  { id: 'swarms', label: 'Swarms', icon: '🕸️' },
  { id: 'providers', label: 'Providers', icon: '🏢' },
  { id: 'observability', label: 'Observability', icon: '📈' },
];

export const ConsoleSubNav: React.FC<ConsoleSubNavProps> = ({
  currentRoute,
  onRouteChange,
}) => {
  return (
    <nav className="console-subnav">
      {navItems.map((item) => (
        <button
          key={item.id}
          type="button"
          className={cn(
            'console-subnav-item',
            currentRoute === item.id && 'active'
          )}
          onClick={() => onRouteChange(item.id)}
        >
          <span className="subnav-icon">{item.icon}</span>
          <span className="subnav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default ConsoleSubNav;
