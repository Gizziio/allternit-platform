/**
 * ModeSelector - Chat Mode/Program Selector
 * 
 * Pattern: Native dropdown menu → Pill bars attach to input
 * Similar to: ChatGPT's DALL-E, Code Interpreter, Browse mode toggles
 * 
 * Usage:
 * 1. Click dropdown to see available modes/programs
 * 2. Select mode → pill appears attached to input bar
 * 3. Click X on pill to remove
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  X,
  Sparkles,
  FileText,
  Table,
  Presentation,
  Code,
  FolderOpen,
  Cpu,
  Workflow,
  Globe,
  Zap,
} from 'lucide-react';

// Mode definitions with icons and colors
const MODES = [
  { 
    id: 'research', 
    name: 'Research', 
    description: 'Create research document with citations',
    icon: FileText, 
    color: '#3b82f6',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-400',
  },
  { 
    id: 'data', 
    name: 'Data Grid', 
    description: 'Analyze data with spreadsheets',
    icon: Table, 
    color: '#10b981',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
    textColor: 'text-green-400',
  },
  { 
    id: 'slides', 
    name: 'Presentation', 
    description: 'Create slides with presenter notes',
    icon: Presentation, 
    color: '#f59e0b',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/30',
    textColor: 'text-amber-400',
  },
  { 
    id: 'code', 
    name: 'Code Preview', 
    description: 'Preview and run code',
    icon: Code, 
    color: '#8b5cf6',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/30',
    textColor: 'text-purple-400',
  },
  { 
    id: 'assets', 
    name: 'Assets', 
    description: 'Browse and manage files',
    icon: FolderOpen, 
    color: '#ec4899',
    bgColor: 'bg-pink-500/20',
    borderColor: 'border-pink-500/30',
    textColor: 'text-pink-400',
  },
  { 
    id: 'agents', 
    name: 'Agents', 
    description: 'Multi-agent orchestration',
    icon: Cpu, 
    color: '#ef4444',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-400',
  },
  { 
    id: 'flow', 
    name: 'Workflow', 
    description: 'Build automation workflows',
    icon: Workflow, 
    color: '#06b6d4',
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/30',
    textColor: 'text-cyan-400',
  },
  { 
    id: 'web', 
    name: 'Browser', 
    description: 'Browse web with screenshots',
    icon: Globe, 
    color: '#6366f1',
    bgColor: 'bg-indigo-500/20',
    borderColor: 'border-indigo-500/30',
    textColor: 'text-indigo-400',
  },
] as const;

export type ModeId = typeof MODES[number]['id'];

interface SelectedMode {
  id: ModeId;
  config?: Record<string, unknown>;
}

interface ModeSelectorProps {
  selectedModes: SelectedMode[];
  onSelectMode: (mode: ModeId) => void;
  onRemoveMode: (mode: ModeId) => void;
  disabled?: boolean;
}

// Pill component for selected modes
const ModePill: React.FC<{
  mode: typeof MODES[number];
  onRemove: () => void;
}> = ({ mode, onRemove }) => {
  const Icon = mode.icon;
  
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className={`
        flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        border ${mode.borderColor} ${mode.bgColor} ${mode.textColor}
        hover:brightness-110 transition-all cursor-default
      `}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{mode.name}</span>
      <button
        onClick={onRemove}
        className="ml-1 p-0.5 hover:bg-white/20 rounded-full transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </motion.div>
  );
};

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  selectedModes,
  onSelectMode,
  onRemoveMode,
  disabled,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get selected mode objects
  const selectedModeObjects = selectedModes
    .map(sm => MODES.find(m => m.id === sm.id))
    .filter(Boolean) as typeof MODES;

  // Available modes (not already selected)
  const availableModes = MODES.filter(
    m => !selectedModes.some(sm => sm.id === m.id)
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected Mode Pills */}
      <AnimatePresence>
        {selectedModeObjects.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-wrap gap-2 px-4 pt-2 pb-1"
          >
            {selectedModeObjects.map((mode) => (
              <ModePill
                key={mode.id}
                mode={mode}
                onRemove={() => onRemoveMode(mode.id)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mode Selector Dropdown Button */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
          transition-all duration-200
          ${disabled 
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:bg-white/10 cursor-pointer'
          }
          ${isOpen ? 'bg-white/10' : ''}
        `}
      >
        <Sparkles className="w-4 h-4 text-amber-400" />
        <span className="text-white/70">
          {selectedModes.length > 0 ? 'Add mode' : 'Select mode'}
        </span>
        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && availableModes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="
              absolute left-0 bottom-full mb-2 z-50
              w-64 py-2 rounded-xl
              bg-[#2a2520] border border-white/10
              shadow-xl shadow-black/40
            "
          >
            <div className="px-3 py-1.5 text-xs font-medium text-white/40 uppercase tracking-wider">
              Available Modes
            </div>
            
            {availableModes.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => {
                    onSelectMode(mode.id);
                    setIsOpen(false);
                  }}
                  className="
                    w-full flex items-center gap-3 px-3 py-2.5
                    hover:bg-white/5 transition-colors
                    text-left group
                  "
                >
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${mode.color}20` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: mode.color }} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white/90 group-hover:text-white">
                      {mode.name}
                    </div>
                    <div className="text-xs text-white/40 truncate">
                      {mode.description}
                    </div>
                  </div>
                  
                  <Zap className="w-4 h-4 text-white/20 group-hover:text-white/40" />
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ModeSelector;
