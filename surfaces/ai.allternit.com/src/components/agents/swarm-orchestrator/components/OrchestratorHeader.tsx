import React, { useState } from 'react';
import { 
  Network, 
  GearSix, 
  Pulse as Activity, 
  CaretRight, 
  FloppyDisk, 
  DownloadSimple, 
  Play, 
  Pause, 
  Square, 
  Warning, 
  Check, 
  X 
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import type { 
  ExecutionStatus, 
  ValidationError 
} from '../types/SwarmOrchestrator.types';
import { MODE_COLORS, TEXT } from '@/design/allternit.tokens';

interface OrchestratorHeaderProps {
  swarmName: string;
  setSwarmName: (name: string) => void;
  activeTab: 'design' | 'configure' | 'monitor';
  setActiveTab: (tab: 'design' | 'configure' | 'monitor') => void;
  isExecuting: boolean;
  executionStatus?: ExecutionStatus;
  onExecute: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onSave: () => void;
  onExport: () => void;
  isSaving: boolean;
  validationErrors: ValidationError[];
  onShowValidation: () => void;
  canEdit: boolean;
  canExecute: boolean;
  modeColors: (typeof MODE_COLORS)['chat'];
}

export function OrchestratorHeader({
  swarmName,
  setSwarmName,
  activeTab,
  setActiveTab,
  isExecuting,
  executionStatus,
  onExecute,
  onStop,
  onPause,
  onResume,
  onSave,
  onExport,
  isSaving,
  validationErrors,
  onShowValidation,
  canEdit,
  canExecute,
  modeColors,
}: OrchestratorHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const errorCount = validationErrors.filter((e) => e.severity === 'error').length;
  const warningCount = validationErrors.filter((e) => e.severity === 'warning').length;

  const tabs = [
    { id: 'design' as const, label: 'Design', icon: Network },
    { id: 'configure' as const, label: 'Configure', icon: GearSix },
    { id: 'monitor' as const, label: 'Monitor', icon: Activity },
  ];

  return (
    <header
      className="px-6 py-4 flex items-center justify-between border-b border-solid"
      style={{ background: 'var(--surface-panel)', borderColor: modeColors.border }}
    >
      <div className="flex items-center gap-6">
        {/* Name Area */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            {isEditingName && canEdit ? (
              <input aria-label="Input" type="text"
                autoFocus
                className="bg-transparent border-none text-xl font-bold p-0 focus:ring-0"
                style={{ color: TEXT.primary }}
                value={swarmName}
                onChange={(e) => setSwarmName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
              />
            ) : (
              <h1
                className={`text-xl font-bold ${canEdit ? 'cursor-pointer' : ''}`}
                style={{ color: TEXT.primary }}
                onClick={() => canEdit && setIsEditingName(true)}
              >
                {swarmName}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: TEXT.tertiary }}>
            <span>Swarm v2.0</span>
            <span className="opacity-30">•</span>
            {errorCount > 0 ? (
              <button type="button"
                onClick={onShowValidation}
                className="flex items-center gap-1 text-red-400 hover:underline"
              >
                <Warning size={12} /> {errorCount} errors
              </button>
            ) : (
              <span className="flex items-center gap-1 text-green-400">
                <Check size={12} /> Validated
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-1 p-1 bg-[var(--surface-sunken)] rounded-xl border border-solid border-[var(--ui-border-default)]">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                  ${isActive ? 'shadow-sm' : 'hover:bg-white/5'}
                `}
                style={{
                  background: isActive ? modeColors.accent : 'transparent',
                  color: isActive ? '#000' : TEXT.secondary,
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <button type="button"
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-solid transition-all hover:bg-white/5"
          style={{ borderColor: modeColors.border, color: TEXT.secondary }}
        >
          <DownloadSimple size={18} />
          Export
        </button>

        <button type="button"
          onClick={onSave}
          disabled={!canEdit || isSaving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-solid transition-all hover:bg-white/5 disabled:opacity-50"
          style={{ borderColor: modeColors.border, color: TEXT.secondary }}
        >
          <FloppyDisk size={18} />
          {isSaving ? 'Saving...' : 'Save Swarm'}
        </button>

        <div className="w-px h-8 mx-2" style={{ background: modeColors.border }} />

        {!isExecuting ? (
          <button type="button"
            onClick={onExecute}
            disabled={!canExecute || errorCount > 0}
            className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${modeColors.accent}, #fff)`,
              color: '#000',
              boxShadow: `0 4px 15px ${modeColors.accent}40`,
            }}
          >
            <Play size={20} weight="fill" />
            Execute Swarm
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {executionStatus === 'paused' ? (
              <button type="button"
                onClick={onResume}
                className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all"
              >
                <Play size={20} weight="fill" />
              </button>
            ) : (
              <button type="button"
                onClick={onPause}
                className="p-2 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-all"
              >
                <Pause size={20} weight="fill" />
              </button>
            )}
            <button type="button"
              onClick={onStop}
              className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
            >
              <Square size={20} weight="fill" />
              Stop
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
