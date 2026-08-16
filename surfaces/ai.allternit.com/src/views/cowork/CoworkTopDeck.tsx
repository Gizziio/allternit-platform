'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Folder, ShieldCheck, CaretDown, Check } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useCoworkStore } from './CoworkStore';

const PERMISSION_OPTIONS = [
  { id: 'auto-approve', label: 'Auto-approve', description: 'Agent can run tools and edits freely' },
  { id: 'ask', label: 'Ask before actions', description: 'Agent asks before running commands or edits' },
  { id: 'read-only', label: 'Read-only', description: 'Agent can only read and research' },
] as const;

type PermissionId = (typeof PERMISSION_OPTIONS)[number]['id'];

interface DropdownProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  options: { id: string; label: string; description?: string }[];
  onSelect: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

function TopDeckDropdown({ label, value, icon, options, onSelect, isOpen, onToggle, onClose }: DropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex items-center gap-1.5 h-7 pl-2 pr-1.5 rounded-full text-xs font-semibold border backdrop-blur-md transition-all',
          isOpen
            ? 'bg-[var(--glass-bg)]/80 border-[var(--border-subtle)]/60 text-[var(--text-primary)] shadow-sm'
            : 'bg-[var(--glass-bg)]/60 border-[var(--border-subtle)]/50 text-[var(--text-primary)] hover:bg-[var(--glass-bg)]/80'
        )}
      >
        {icon}
        <span className="max-w-[120px] truncate">{value}</span>
        <CaretDown size={12} className={cn('transition-transform opacity-70', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-[var(--glass-bg-thick)] backdrop-blur-[20px] rounded-xl border border-[var(--border-subtle)] shadow-xl z-[200] overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
            <div className="text-[10px] font-extrabold text-[var(--text-tertiary)] uppercase tracking-wider">{label}</div>
          </div>
          <div className="p-1.5 max-h-64 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onSelect(option.id);
                  onClose();
                }}
                className={cn(
                  'w-full text-left p-2 rounded-lg transition-colors flex items-start gap-2',
                  value === option.label ? 'bg-[var(--surface-hover)]' : 'hover:bg-[var(--surface-hover)]'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                    {value === option.label && <Check size={12} className="text-[var(--accent-chat)]" />}
                    {option.label}
                  </div>
                  {option.description ? (
                    <div className="text-xs text-[var(--text-tertiary)] mt-0.5 leading-snug">{option.description}</div>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function CoworkTopDeck(): React.ReactNode {
  const projects = useCoworkStore((s) => s.projects);
  const activeProjectId = useCoworkStore((s) => s.activeProjectId);
  const setActiveProject = useCoworkStore((s) => s.setActiveProject);

  const [permission, setPermission] = useState<PermissionId>('ask');
  const [openDropdown, setOpenDropdown] = useState<'project' | 'permission' | null>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const projectOptions = [
    { id: '__none__', label: 'No project', description: 'Cowork without a specific project' },
    ...projects.map((p) => ({ id: p.id, label: p.title, description: undefined })),
  ];

  const handleProjectSelect = (id: string) => {
    setActiveProject(id === '__none__' ? null : id);
  };

  const selectedPermission = PERMISSION_OPTIONS.find((p) => p.id === permission) ?? PERMISSION_OPTIONS[1];

  return (
    // Tray tucked behind the composer card: inset, bottom 12px hidden under
    // the box (negative margin + z-0 vs the box's z-10), sliding up from
    // behind on mount. Visible height stays LAUNCH_TOP_ACTIONS_HEIGHT (44px)
    // so the composer box never moves.
    <div
      className="relative z-0 w-full h-[56px] -mb-3 box-border bg-[var(--chat-composer-bg)]/60 border-t border-r border-l border-[var(--chat-composer-border)]/60 rounded-t-2xl px-4 pb-3 flex items-center gap-3 animate-deck-rise backdrop-blur-md"
    >
      <TopDeckDropdown
        label="Project"
        value={activeProject?.title ?? 'Select project'}
        icon={<Folder size={14} className="text-accent" />}
        options={projectOptions}
        onSelect={handleProjectSelect}
        isOpen={openDropdown === 'project'}
        onToggle={() => setOpenDropdown((prev) => (prev === 'project' ? null : 'project'))}
        onClose={() => setOpenDropdown(null)}
      />
      <TopDeckDropdown
        label="Permissions"
        value={selectedPermission.label}
        icon={<ShieldCheck size={14} className="text-status-warning" />}
        options={PERMISSION_OPTIONS.map((p) => ({ id: p.id, label: p.label, description: p.description }))}
        onSelect={(id) => setPermission(id as PermissionId)}
        isOpen={openDropdown === 'permission'}
        onToggle={() => setOpenDropdown((prev) => (prev === 'permission' ? null : 'permission'))}
        onClose={() => setOpenDropdown(null)}
      />
    </div>
  );
}
