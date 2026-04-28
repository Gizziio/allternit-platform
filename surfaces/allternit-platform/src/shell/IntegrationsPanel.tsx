import React from 'react';
import { PluginManager } from '../views/plugins/PluginManager';

interface IntegrationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

export function IntegrationsPanel({ isOpen, onClose, onOpenSettings }: IntegrationsPanelProps) {
  if (!isOpen) return null;

  return <PluginManager isOpen={isOpen} onClose={onClose} onOpenSettings={onOpenSettings} />;
}
