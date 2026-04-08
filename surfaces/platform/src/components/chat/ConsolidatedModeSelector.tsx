/**
 * ConsolidatedModeSelector
 * 
 * Groups 10 modes into 4 categories with sub-mode toggle.
 * Text-only version with color-graded groups.
 * 
 * Pattern: 4 main pills → select → sub-mode toggle appears
 * Agent tab shows: "Agent | Group-SubMode" with group color
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Sub-mode definitions with color grades
interface SubMode {
  id: string;
  name: string;
  description: string;
  shade: number; // 300, 400, 500, 600 for different shades
}

// Color grade definitions for each group
interface ColorGrade {
  base: string;      // Main color (e.g., violet)
  bg: string[];      // Background shades [light, medium, dark]
  text: string[];    // Text shades [light, medium, dark]
  border: string[];  // Border shades
}

// Consolidated group definitions
interface ModeGroup {
  id: string;
  name: string;
  color: ColorGrade;
  subModes: SubMode[];
}

const COLOR_GRADES: Record<string, ColorGrade> = {
  violet: {
    base: 'violet',
    bg: ['bg-violet-400/20', 'bg-violet-500/20', 'bg-violet-600/20', 'bg-violet-700/20'],
    text: ['text-violet-300', 'text-violet-400', 'text-violet-500', 'text-violet-600'],
    border: ['border-violet-400/30', 'border-violet-500/30', 'border-violet-600/30', 'border-violet-700/30'],
  },
  blue: {
    base: 'blue',
    bg: ['bg-blue-400/20', 'bg-blue-500/20', 'bg-blue-600/20', 'bg-blue-700/20'],
    text: ['text-blue-300', 'text-blue-400', 'text-blue-500', 'text-blue-600'],
    border: ['border-blue-400/30', 'border-blue-500/30', 'border-blue-600/30', 'border-blue-700/30'],
  },
  emerald: {
    base: 'emerald',
    bg: ['bg-emerald-400/20', 'bg-emerald-500/20', 'bg-emerald-600/20', 'bg-emerald-700/20'],
    text: ['text-emerald-300', 'text-emerald-400', 'text-emerald-500', 'text-emerald-600'],
    border: ['border-emerald-400/30', 'border-emerald-500/30', 'border-emerald-600/30', 'border-emerald-700/30'],
  },
  amber: {
    base: 'amber',
    bg: ['bg-amber-400/20', 'bg-amber-500/20', 'bg-amber-600/20', 'bg-amber-700/20'],
    text: ['text-amber-300', 'text-amber-400', 'text-amber-500', 'text-amber-600'],
    border: ['border-amber-400/30', 'border-amber-500/30', 'border-amber-600/30', 'border-amber-700/30'],
  },
};

const MODE_GROUPS: ModeGroup[] = [
  {
    id: 'create',
    name: 'Create',
    color: COLOR_GRADES.violet,
    subModes: [
      { id: 'image', name: 'Image', description: 'Generate images (FREE)', shade: 0 },
      { id: 'video', name: 'Video', description: 'Generate videos (BYOK)', shade: 1 },
      { id: 'slides', name: 'Slides', description: 'Presentations', shade: 2 },
      { id: 'website', name: 'Website', description: 'Build websites', shade: 3 },
    ],
  },
  {
    id: 'analyze',
    name: 'Analyze',
    color: COLOR_GRADES.blue,
    subModes: [
      { id: 'research', name: 'Research', description: 'Multi-source research', shade: 0 },
      { id: 'data', name: 'Data', description: 'Data analysis & charts', shade: 2 },
    ],
  },
  {
    id: 'build',
    name: 'Build',
    color: COLOR_GRADES.emerald,
    subModes: [
      { id: 'code', name: 'Code', description: 'Generate & run code', shade: 0 },
      { id: 'assets', name: 'Assets', description: 'File management', shade: 2 },
    ],
  },
  {
    id: 'automate',
    name: 'Automate',
    color: COLOR_GRADES.amber,
    subModes: [
      { id: 'agents', name: 'Swarms', description: 'Multi-agent orchestration', shade: 0 },
      { id: 'flow', name: 'Flow', description: 'Workflow automation', shade: 2 },
    ],
  },
];

export type SubModeId = typeof MODE_GROUPS[number]['subModes'][number]['id'];
export type GroupId = typeof MODE_GROUPS[number]['id'];

export interface SelectedMode {
  groupId: GroupId;
  subModeId: SubModeId;
}

interface ConsolidatedModeSelectorProps {
  selectedMode: SelectedMode | null;
  onSelectMode: (mode: SelectedMode | null) => void;
  disabled?: boolean;
}

// Main group pill component (text only)
const GroupPill: React.FC<{
  group: ModeGroup;
  isSelected: boolean;
  onClick: () => void;
  onRemove: () => void;
}> = ({ group, isSelected, onClick, onRemove }) => {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer select-none",
        isSelected
          ? `${group.color.bg[1]} ${group.color.border[1]} ${group.color.text[1]} border`
          : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
      )}
      onClick={onClick}
    >
      <span>{group.name}</span>
      {isSelected && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 p-0.5 hover:bg-white/20 rounded-full transition-colors"
        >
          <X size={12} />
        </button>
      )}
    </motion.div>
  );
};

// Sub-mode toggle (appears in input bar)
export const SubModeToggle: React.FC<{
  group: ModeGroup;
  selectedSubMode: SubModeId;
  onSelectSubMode: (subModeId: SubModeId) => void;
}> = ({ group, selectedSubMode, onSelectSubMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const selectedSub = group.subModes.find(m => m.id === selectedSubMode);
  const selectedShade = selectedSub?.shade || 0;
  
  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
          group.color.bg[selectedShade],
          group.color.text[selectedShade],
          "border",
          group.color.border[selectedShade]
        )}
      >
        <span>{selectedSub?.name || 'Select'}</span>
        <ChevronDown size={12} className={cn("transition-transform", isOpen && "rotate-180")} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            className="absolute bottom-full left-0 mb-2 w-48 py-2 rounded-xl bg-[#2a2520] border border-white/10 shadow-xl z-50"
          >
            <div className="px-3 py-1.5 text-xs font-medium text-white/40 uppercase">
              {group.name} Options
            </div>
            {group.subModes.map((subMode) => {
              const isSelected = subMode.id === selectedSubMode;
              
              return (
                <button
                  key={subMode.id}
                  onClick={() => {
                    onSelectSubMode(subMode.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                    isSelected 
                      ? `${group.color.bg[subMode.shade]} ${group.color.text[subMode.shade]}` 
                      : "hover:bg-white/5 text-white/80"
                  )}
                >
                  <div 
                    className={cn(
                      "w-2 h-2 rounded-full",
                      isSelected ? `bg-current` : "bg-white/20"
                    )}
                    style={{ 
                      backgroundColor: isSelected ? undefined : `${subMode.shade * 20}%` 
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "text-sm font-medium",
                      isSelected ? group.color.text[subMode.shade] : "text-white/80"
                    )}>
                      {subMode.name}
                    </div>
                    <div className="text-xs text-white/40 truncate">
                      {subMode.description}
                    </div>
                  </div>
                  {isSelected && (
                    <div className={cn("w-1.5 h-1.5 rounded-full", group.color.text[subMode.shade])} />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Agent tab display component
export const AgentModeDisplay: React.FC<{
  selectedMode: SelectedMode | null;
}> = ({ selectedMode }) => {
  if (!selectedMode) {
    return <span className="text-white/60">Agent</span>;
  }
  
  const group = MODE_GROUPS.find(g => g.id === selectedMode.groupId);
  const subMode = group?.subModes.find(m => m.id === selectedMode.subModeId);
  
  if (!group || !subMode) {
    return <span className="text-white/60">Agent</span>;
  }
  
  return (
    <div className="flex items-center gap-2">
      <span className={cn("font-medium", group.color.text[1])}>
        Agent
      </span>
      <span className="text-white/40">|</span>
      <span className={cn("font-medium", group.color.text[subMode.shade])}>
        {group.name}-{subMode.name}
      </span>
    </div>
  );
};

// Main selector component
export const ConsolidatedModeSelector: React.FC<ConsolidatedModeSelectorProps> = ({
  selectedMode,
  onSelectMode,
  disabled,
}) => {
  const handleGroupClick = (groupId: GroupId) => {
    if (disabled) return;
    
    // If already selected this group, do nothing (keep current sub-mode)
    if (selectedMode?.groupId === groupId) return;
    
    // Select new group with first sub-mode as default
    const group = MODE_GROUPS.find(g => g.id === groupId);
    if (group) {
      onSelectMode({
        groupId,
        subModeId: group.subModes[0].id,
      });
    }
  };
  
  const handleRemove = () => {
    onSelectMode(null);
  };
  
  const handleSubModeChange = (subModeId: SubModeId) => {
    if (!selectedMode) return;
    onSelectMode({
      groupId: selectedMode.groupId,
      subModeId,
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Group Pills - Text Only */}
      <div className="flex items-center gap-2 flex-wrap">
        {MODE_GROUPS.map((group) => (
          <GroupPill
            key={group.id}
            group={group}
            isSelected={selectedMode?.groupId === group.id}
            onClick={() => handleGroupClick(group.id)}
            onRemove={handleRemove}
          />
        ))}
      </div>
      
      {/* Sub-Mode Toggle (shown when group selected) */}
      <AnimatePresence>
        {selectedMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 pl-1"
          >
            <span className="text-xs text-white/40">Using:</span>
            <SubModeToggle
              group={MODE_GROUPS.find(g => g.id === selectedMode.groupId)!}
              selectedSubMode={selectedMode.subModeId}
              onSelectSubMode={handleSubModeChange}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Helper to get the effective mode ID for plugin execution
export function getEffectiveModeId(selectedMode: SelectedMode | null): string | null {
  return selectedMode?.subModeId || null;
}

// Helper to check if a specific sub-mode is selected
export function isSubModeSelected(
  selectedMode: SelectedMode | null,
  subModeId: SubModeId
): boolean {
  return selectedMode?.subModeId === subModeId;
}

// Helper to get group color for theming
export function getGroupColor(groupId: GroupId): ColorGrade {
  return MODE_GROUPS.find(g => g.id === groupId)?.color || COLOR_GRADES.violet;
}

// Helper to get full display string for agent tab
export function getAgentDisplayString(selectedMode: SelectedMode | null): string {
  if (!selectedMode) return 'Agent';
  
  const group = MODE_GROUPS.find(g => g.id === selectedMode.groupId);
  const subMode = group?.subModes.find(m => m.id === selectedMode.subModeId);
  
  if (!group || !subMode) return 'Agent';
  
  return `Agent | ${group.name}-${subMode.name}`;
}

export default ConsolidatedModeSelector;
