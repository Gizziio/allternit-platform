import React from 'react';
import { PluginManager } from '../views/plugins/PluginManager';

interface PluginManagerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

export function PluginManagerPanel({ isOpen, onClose, onOpenSettings }: PluginManagerPanelProps) {
  if (!isOpen) return null;
  
  return <PluginManager isOpen={isOpen} onClose={onClose} onOpenSettings={onOpenSettings} />;
}
