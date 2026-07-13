import React from 'react';
import { PluginManager } from '../views/plugins';
import type { TabId } from '../views/plugins/PluginManager/types';

interface IntegrationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
  initialTab?: TabId;
}

export function IntegrationsPanel({ isOpen, onClose, onOpenSettings, initialTab }: IntegrationsPanelProps) {
  if (!isOpen) return null;

  return <PluginManager isOpen={isOpen} onClose={onClose} onOpenSettings={onOpenSettings} initialTab={initialTab} />;
}
