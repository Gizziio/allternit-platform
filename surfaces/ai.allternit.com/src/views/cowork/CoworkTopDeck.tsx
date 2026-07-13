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
          'flex items-center gap-1.5 h-7 pl-2 pr-1.5 rounded-full text-xs font-semibold border transition-all',
          isOpen
            ? 'bg-composer-hover border-composer-border text-primary'
            : 'bg-composer-soft border-composer-border text-secondary hover:text-primary hover:bg-composer-hover'
        )}
      >
        {icon}
        <span className="max-w-[120px] truncate">{value}</span>
        <CaretDown size={12} className={cn('transition-transform opacity-70', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-menu-bg rounded-xl border border-menu-border shadow-xl z-[200] overflow-hidden">
          <div className="px-3 py-2 border-b border-input-border">
            <div className="text-[10px] font-extrabold text-muted uppercase tracking-wider">{label}</div>
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
                  value === option.label ? 'bg-composer-hover' : 'hover:bg-hover'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-primary flex items-center gap-1.5">
                    {value === option.label && <Check size={12} className="text-accent" />}
                    {option.label}
                  </div>
                  {option.description ? (
                    <div className="text-xs text-muted mt-0.5 leading-snug">{option.description}</div>
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
    <div
      className="w-full bg-input-bg border border-input-border rounded-2xl px-4 py-2 flex items-center gap-3 animate-slide-up z-10 relative shadow-sm"
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
      <style>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
