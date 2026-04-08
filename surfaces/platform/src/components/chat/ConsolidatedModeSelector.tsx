/**
 * ConsolidatedModeSelector
 * 
 * Groups modes into 4 categories with sub-mode toggle.
 * Includes built-in modes AND vendor plugins (Claude Desktop, etc.).
 * Text-only version with color-graded groups.
 * 
 * Pattern: 4 main pills → select → sub-mode toggle appears
 * Agent tab shows: "Agent | Group-SubMode" with group color
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  getClaudeDesktopPlugins, 
  getAllModeSelectorEntries,
  VendorPlugin 
} from '@/lib/plugins/vendor-integration';

// Sub-mode definitions with color grades
interface SubMode {
  id: string;
  name: string;
  description: string;
  shade: number; // 0-3 for different shades
  vendor?: 'built-in' | 'claude-desktop' | 'copilot' | 'cursor';
  commandCount?: number;
  skillCount?: number;
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

// Built-in sub-modes
const BUILT_IN_SUBMODES: Record<string, SubMode[]> = {
  create: [
    { id: 'image', name: 'Image', description: 'Generate images (FREE)', shade: 0, vendor: 'built-in' },
    { id: 'video', name: 'Video', description: 'Generate videos (BYOK)', shade: 1, vendor: 'built-in' },
    { id: 'slides', name: 'Slides', description: 'Presentations', shade: 2, vendor: 'built-in' },
    { id: 'website', name: 'Website', description: 'Build websites', shade: 3, vendor: 'built-in' },
  ],
  analyze: [
    { id: 'research', name: 'Research', description: 'Multi-source research', shade: 0, vendor: 'built-in' },
    { id: 'data', name: 'Data', description: 'Data analysis & charts', shade: 1, vendor: 'built-in' },
  ],
  build: [
    { id: 'code', name: 'Code', description: 'Generate & run code', shade: 0, vendor: 'built-in' },
    { id: 'assets', name: 'Assets', description: 'File management', shade: 1, vendor: 'built-in' },
  ],
  automate: [
    { id: 'swarms', name: 'Swarms', description: 'Multi-agent orchestration', shade: 0, vendor: 'built-in' },
    { id: 'flow', name: 'Flow', description: 'Workflow automation', shade: 1, vendor: 'built-in' },
  ],
};

// Additional Claude Desktop plugins by category
const VENDOR_PLUGINS_BY_CATEGORY: Record<string, Array<{ id: string; name: string; description: string; commands: number; skills: number }>> = {
  create: [
    { id: 'design', name: 'Design', description: 'Design systems & UX', commands: 6, skills: 6 },
    { id: 'marketing', name: 'Marketing', description: 'Content & campaigns', commands: 7, skills: 5 },
    { id: 'product-management', name: 'Product', description: 'PM workflows', commands: 7, skills: 6 },
  ],
  analyze: [
    { id: 'legal', name: 'Legal', description: 'Contracts & NDAs', commands: 7, skills: 6 },
    { id: 'sales', name: 'Sales', description: 'Pipeline & calls', commands: 3, skills: 6 },
    { id: 'finance', name: 'Finance', description: 'Accounting & SOX', commands: 5, skills: 6 },
    { id: 'customer-support', name: 'Support', description: 'Ticketing & KB', commands: 5, skills: 5 },
    { id: 'enterprise-search', name: 'Search', description: 'Enterprise search', commands: 2, skills: 3 },
    { id: 'bio-research', name: 'Bio', description: 'Research synthesis', commands: 1, skills: 5 },
    { id: 'human-resources', name: 'HR', description: 'People ops', commands: 6, skills: 6 },
  ],
  build: [
    // engineering is in build - already have code
  ],
  automate: [
    { id: 'operations', name: 'Operations', description: 'Process & runbooks', commands: 6, skills: 6 },
    { id: 'productivity', name: 'Productivity', description: 'Daily tasks', commands: 2, skills: 2 },
  ],
};

export type SubModeId = string;
export type GroupId = 'create' | 'analyze' | 'build' | 'automate';

export interface SelectedMode {
  groupId: GroupId;
  subModeId: SubModeId;
}

interface ConsolidatedModeSelectorProps {
  selectedMode: SelectedMode | null;
  onSelectMode: (mode: SelectedMode | null) => void;
  disabled?: boolean;
  showVendorPlugins?: boolean;
}

// Build complete mode groups with vendor plugins
function buildModeGroups(includeVendors: boolean): ModeGroup[] {
  const groups: ModeGroup[] = [
    {
      id: 'create',
      name: 'Create',
      color: COLOR_GRADES.violet,
      subModes: [...BUILT_IN_SUBMODES.create],
    },
    {
      id: 'analyze',
      name: 'Analyze',
      color: COLOR_GRADES.blue,
      subModes: [...BUILT_IN_SUBMODES.analyze],
    },
    {
      id: 'build',
      name: 'Build',
      color: COLOR_GRADES.emerald,
      subModes: [...BUILT_IN_SUBMODES.build],
    },
    {
      id: 'automate',
      name: 'Automate',
      color: COLOR_GRADES.amber,
      subModes: [...BUILT_IN_SUBMODES.automate],
    },
  ];

  if (includeVendors) {
    // Add vendor plugins to each group
    groups.forEach(group => {
      const vendorPlugins = VENDOR_PLUGINS_BY_CATEGORY[group.id] || [];
      let shadeOffset = group.subModes.length;
      
      vendorPlugins.forEach((plugin, index) => {
        // Wrap around shades 2-3 for vendor plugins to distinguish from built-in
        const shade = (shadeOffset + index) % 4;
        group.subModes.push({
          id: plugin.id,
          name: plugin.name,
          description: plugin.description,
          shade: Math.max(2, shade), // Vendor plugins get darker shades
          vendor: 'claude-desktop',
          commandCount: plugin.commands,
          skillCount: plugin.skills,
        });
      });
    });
  }

  return groups;
}

// Main group pill component (text only)
const GroupPill: React.FC<{
  group: ModeGroup;
  isSelected: boolean;
  onClick: () => void;
  onRemove: () => void;
  showVendorBadge?: boolean;
}> = ({ group, isSelected, onClick, onRemove, showVendorBadge }) => {
  const vendorCount = group.subModes.filter(m => m.vendor === 'claude-desktop').length;
  
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
      {showVendorBadge && vendorCount > 0 && (
        <span className={cn(
          "text-[10px] px-1 rounded-full",
          "bg-white/10 text-white/50"
        )}>
          +{vendorCount}
        </span>
      )}
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
            className="absolute bottom-full left-0 mb-2 w-56 py-2 rounded-xl bg-[#2a2520] border border-white/10 shadow-xl z-50 max-h-80 overflow-y-auto"
          >
            <div className="px-3 py-1.5 text-xs font-medium text-white/40 uppercase">
              {group.name} Options
            </div>
            
            {/* Built-in section */}
            {group.subModes.some(m => m.vendor === 'built-in' || !m.vendor) && (
              <>
                <div className="px-3 py-1 text-[10px] text-white/30 uppercase tracking-wider">
                  Built-in
                </div>
                {group.subModes
                  .filter(m => m.vendor === 'built-in' || !m.vendor)
                  .map((subMode) => renderSubModeOption(subMode, group, selectedSubMode, onSelectSubMode, setIsOpen))}
              </>
            )}
            
            {/* Vendor plugins section */}
            {group.subModes.some(m => m.vendor === 'claude-desktop') && (
              <>
                <div className="mt-2 px-3 py-1 text-[10px] text-white/30 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={10} />
                  Claude Desktop
                </div>
                {group.subModes
                  .filter(m => m.vendor === 'claude-desktop')
                  .map((subMode) => renderSubModeOption(subMode, group, selectedSubMode, onSelectSubMode, setIsOpen))}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

function renderSubModeOption(
  subMode: SubMode,
  group: ModeGroup,
  selectedSubMode: string,
  onSelectSubMode: (id: string) => void,
  setIsOpen: (open: boolean) => void
) {
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
          {subMode.vendor === 'claude-desktop' && subMode.commandCount && (
            <span className="ml-1 text-white/30">
              • {subMode.commandCount} cmds, {subMode.skillCount} skills
            </span>
          )}
        </div>
      </div>
      {isSelected && (
        <div className={cn("w-1.5 h-1.5 rounded-full", group.color.text[subMode.shade])} />
      )}
    </button>
  );
}

// Agent tab display component
export const AgentModeDisplay: React.FC<{
  selectedMode: SelectedMode | null;
  groups: ModeGroup[];
}> = ({ selectedMode, groups }) => {
  if (!selectedMode) {
    return <span className="text-white/60">Agent</span>;
  }
  
  const group = groups.find(g => g.id === selectedMode.groupId);
  const subMode = group?.subModes.find(m => m.id === selectedMode.subModeId);
  
  if (!group || !subMode) {
    return <span className="text-white/60">Agent</span>;
  }
  
  const isVendor = subMode.vendor === 'claude-desktop';
  
  return (
    <div className="flex items-center gap-2">
      <span className={cn("font-medium", group.color.text[1])}>
        Agent
      </span>
      <span className="text-white/40">|</span>
      <span className={cn("font-medium", group.color.text[subMode.shade])}>
        {group.name}-{subMode.name}
      </span>
      {isVendor && (
        <Sparkles size={12} className={group.color.text[subMode.shade]} />
      )}
    </div>
  );
};

// Main selector component
export const ConsolidatedModeSelector: React.FC<ConsolidatedModeSelectorProps> = ({
  selectedMode,
  onSelectMode,
  disabled,
  showVendorPlugins = true,
}) => {
  const groups = useMemo(() => buildModeGroups(showVendorPlugins), [showVendorPlugins]);
  
  const handleGroupClick = (groupId: GroupId) => {
    if (disabled) return;
    
    // If already selected this group, do nothing (keep current sub-mode)
    if (selectedMode?.groupId === groupId) return;
    
    // Select new group with first sub-mode as default
    const group = groups.find(g => g.id === groupId);
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

  const currentGroup = selectedMode ? groups.find(g => g.id === selectedMode.groupId) : null;

  return (
    <div className="flex flex-col gap-2">
      {/* Group Pills - Text Only */}
      <div className="flex items-center gap-2 flex-wrap">
        {groups.map((group) => (
          <GroupPill
            key={group.id}
            group={group}
            isSelected={selectedMode?.groupId === group.id}
            onClick={() => handleGroupClick(group.id as GroupId)}
            onRemove={handleRemove}
            showVendorBadge={showVendorPlugins}
          />
        ))}
      </div>
      
      {/* Sub-Mode Toggle (shown when group selected) */}
      <AnimatePresence>
        {selectedMode && currentGroup && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 pl-1"
          >
            <span className="text-xs text-white/40">Using:</span>
            <SubModeToggle
              group={currentGroup}
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
export function getGroupColor(groupId: GroupId, showVendors = true): ColorGrade {
  const groups = buildModeGroups(showVendors);
  return groups.find(g => g.id === groupId)?.color || COLOR_GRADES.violet;
}

// Helper to get full display string for agent tab
export function getAgentDisplayString(selectedMode: SelectedMode | null, showVendors = true): string {
  if (!selectedMode) return 'Agent';
  
  const groups = buildModeGroups(showVendors);
  const group = groups.find(g => g.id === selectedMode.groupId);
  const subMode = group?.subModes.find(m => m.id === selectedMode.subModeId);
  
  if (!group || !subMode) return 'Agent';
  
  return `Agent | ${group.name}-${subMode.name}`;
}

// Get vendor plugin info for a mode
export function getModeVendorInfo(modeId: string, showVendors = true): { vendor?: string; commands?: number; skills?: number } {
  const groups = buildModeGroups(showVendors);
  for (const group of groups) {
    const subMode = group.subModes.find(m => m.id === modeId);
    if (subMode) {
      return {
        vendor: subMode.vendor,
        commands: subMode.commandCount,
        skills: subMode.skillCount,
      };
    }
  }
  return {};
}

export default ConsolidatedModeSelector;
