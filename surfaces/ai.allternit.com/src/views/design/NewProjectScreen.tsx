"use client";

import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Browsers,
  Check,
  FileText,
  FolderOpen,
  GridFour,
  List,
  MagnifyingGlass,
  Palette,
  Paperclip,
  Play,
  Plus,
  Robot,
  Slideshow,
  SquaresFour,
  X,
} from '@phosphor-icons/react';
import { DESIGN_DIRECTIONS, type DesignDirection } from '../../lib/design/directions';
import { DESIGN_SYSTEMS_LIBRARY, type DesignSystemEntry } from '../../lib/design/design-systems-library';
import type { SkillRecord } from '../../lib/design/skill-registry';
import { useDesignProjectStore, type DesignProject } from '@/views/project/design/design-project.store';
import { AProtocolWordmark } from '@/components/AProtocolWordmark';
import './new-project-screen.css';

const CREATION_TYPES = [
  { id: 'prototype', label: 'Prototype', hint: 'Interactive product flow', icon: Browsers },
  { id: 'slides', label: 'Slides', hint: 'Deck or presentation', icon: Slideshow },
  { id: 'dashboard', label: 'Document', hint: 'Structured visual document', icon: FileText },
  { id: 'brand', label: 'Wireframe', hint: 'Interface structure', icon: GridFour },
  { id: 'content-engine', label: 'Animation', hint: 'Motion concept or sequence', icon: Play },
] as const;

type LibraryTab = 'projects' | 'systems' | 'templates';

interface NewProjectScreenProps {
  onStart: (config: {
    name: string;
    prompt: string;
    type: string;
    direction: DesignDirection;
    skill?: SkillRecord;
    skillValues?: Record<string, unknown>;
  }) => void;
  onOpenProject?: (project: DesignProject) => void;
  onSelectDesignSystem?: (system: DesignSystemEntry) => void;
  selectedSkill?: SkillRecord | null;
  onSelectSkill?: (skill: SkillRecord | null) => void;
  skillValues?: Record<string, unknown>;
  onChangeSkillValues?: (values: Record<string, unknown>) => void;
}

export function NewProjectScreen({
  onStart,
  onOpenProject,
  onSelectDesignSystem,
  selectedSkill,
  onSelectSkill,
  skillValues,
}: NewProjectScreenProps) {
  const projects = useDesignProjectStore((state) => state.projects);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState('');
  const [selectedType, setSelectedType] = useState('prototype');
  const [selectedDirection, setSelectedDirection] = useState('modern-minimal');
  const [selectedSystem, setSelectedSystem] = useState<DesignSystemEntry | null>(null);
  const [activeMenu, setActiveMenu] = useState<'system' | 'type' | 'attach' | null>(null);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('projects');
  const [query, setQuery] = useState('');
  const [gridView, setGridView] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);

  const direction = DESIGN_DIRECTIONS.find((item) => item.id === selectedDirection) ?? DESIGN_DIRECTIONS[0];
  const activeType = CREATION_TYPES.find((item) => item.id === selectedType) ?? CREATION_TYPES[0];
  const visibleSystems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return DESIGN_SYSTEMS_LIBRARY.filter((system) =>
      !normalized || system.title.toLowerCase().includes(normalized) || system.category.toLowerCase().includes(normalized)
    ).slice(0, libraryTab === 'systems' ? 24 : 8);
  }, [libraryTab, query]);
  const visibleProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return projects
      .filter((project) => !project.isArchived)
      .filter((project) => !normalized || project.name.toLowerCase().includes(normalized));
  }, [projects, query]);

  function submit() {
    const request = prompt.trim();
    if (!request) return;
    const name = request.length > 54 ? `${request.slice(0, 51).trimEnd()}…` : request;
    onStart({
      name,
      prompt: request,
      type: selectedType,
      direction,
      skill: selectedSkill ?? undefined,
      skillValues: selectedSkill ? (skillValues ?? {}) : undefined,
    });
  }

  function chooseSystem(system: DesignSystemEntry) {
    setSelectedSystem(system);
    onSelectDesignSystem?.(system);
    setActiveMenu(null);
  }

  return (
    <div className="ad-launch">
      <header className="ad-launch__header">
        <div className="ad-launch__brand">
          <AProtocolWordmark theme="adaptive" height={13} />
          <span>DESIGN</span>
          <span className="ad-launch__beta">BETA</span>
        </div>
        <button type="button" className="ad-launch__quiet">What’s new</button>
      </header>

      <main className="ad-launch__main">
        <h1>What should we create?</h1>

        <section className="ad-composer" aria-label="Create a design project">
          <textarea
            autoFocus
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Describe the design you want to create"
            rows={2}
          />

          {attachments.length > 0 && (
            <div className="ad-composer__attachments">
              {attachments.map((file, index) => (
                <span key={`${file.name}-${index}`}>
                  <Paperclip size={12} /> {file.name}
                  <button type="button" onClick={() => setAttachments((items) => items.filter((_, itemIndex) => itemIndex !== index))}><X size={11} /></button>
                </span>
              ))}
            </div>
          )}

          <div className="ad-composer__toolbar">
            <div className="ad-menu-anchor">
              <button type="button" className="ad-icon-button" aria-label="Add context" onClick={() => setActiveMenu(activeMenu === 'attach' ? null : 'attach')}>
                <Plus size={17} />
              </button>
              {activeMenu === 'attach' && (
                <div className="ad-popover ad-popover--attach">
                  <button type="button" onClick={() => fileInputRef.current?.click()}><Paperclip size={15} /><span><b>Attach files</b><small>Images, documents, and references</small></span></button>
                  <button type="button" onClick={() => onSelectSkill?.(null)}><Robot size={15} /><span><b>Allternit skill</b><small>Add a specialized design workflow</small></span></button>
                  <button type="button"><FolderOpen size={15} /><span><b>Project context</b><small>Use files already in Allternit</small></span></button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(event) => setAttachments(Array.from(event.target.files ?? []))}
              />
            </div>

            <div className="ad-menu-anchor">
              <button type="button" className="ad-toolbar-button" onClick={() => setActiveMenu(activeMenu === 'system' ? null : 'system')}>
                <Palette size={15} weight="duotone" />
                <span><small>Design system</small>{selectedSystem?.title.replace('Design System Inspired by ', '') ?? direction.label.split(' — ')[0]}</span>
              </button>
              {activeMenu === 'system' && (
                <div className="ad-popover ad-system-picker">
                  <div className="ad-popover__search"><MagnifyingGlass size={14} /><input autoFocus placeholder="Search design systems" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
                  <div className="ad-system-picker__grid">
                    {visibleSystems.map((system) => (
                      <button type="button" key={system.id} className={selectedSystem?.id === system.id ? 'is-selected' : ''} onClick={() => chooseSystem(system)}>
                        <span className="ad-swatches">{system.swatches.slice(0, 4).map((color) => <i key={color} style={{ background: color }} />)}</span>
                        <b>{system.title.replace('Design System Inspired by ', '')}</b>
                        <small>{system.category}</small>
                      </button>
                    ))}
                  </div>
                  <button type="button" className="ad-popover__footer" onClick={() => { setLibraryTab('systems'); setActiveMenu(null); }}>Browse all design systems</button>
                </div>
              )}
            </div>

            <div className="ad-menu-anchor">
              <button type="button" className="ad-toolbar-button" onClick={() => setActiveMenu(activeMenu === 'type' ? null : 'type')}>
                <activeType.icon size={15} />
                <span><small>Format</small>{activeType.label}</span>
              </button>
              {activeMenu === 'type' && (
                <div className="ad-popover ad-type-picker">
                  {CREATION_TYPES.map((type) => (
                    <button type="button" key={type.id} onClick={() => { setSelectedType(type.id); setActiveMenu(null); }}>
                      <type.icon size={16} /><span><b>{type.label}</b><small>{type.hint}</small></span>{selectedType === type.id && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedSkill && <span className="ad-composer__skill"><Robot size={12} />{selectedSkill.name}</span>}
            <span className="ad-composer__agent">Allternit Agent</span>
            <button type="button" className="ad-submit" disabled={!prompt.trim()} onClick={submit} aria-label="Create project"><ArrowUp size={17} weight="bold" /></button>
          </div>
        </section>

        <section className="ad-templates">
          <p>Use a template</p>
          <div>
            {CREATION_TYPES.map((type) => (
              <button type="button" key={type.id} className={selectedType === type.id ? 'is-selected' : ''} onClick={() => setSelectedType(type.id)}>
                <span><type.icon size={24} weight="light" /></span>
                <b>{type.label}</b>
                <small>{type.hint}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="ad-library">
          <div className="ad-library__bar">
            <nav>
              <button type="button" className={libraryTab === 'projects' ? 'is-active' : ''} onClick={() => setLibraryTab('projects')}>Projects</button>
              <button type="button" className={libraryTab === 'systems' ? 'is-active' : ''} onClick={() => setLibraryTab('systems')}>Design systems</button>
              <button type="button" className={libraryTab === 'templates' ? 'is-active' : ''} onClick={() => setLibraryTab('templates')}>Templates</button>
            </nav>
            <div className="ad-library__tools">
              <label><MagnifyingGlass size={13} /><input placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
              <button type="button" aria-label="List view" className={!gridView ? 'is-active' : ''} onClick={() => setGridView(false)}><List size={14} /></button>
              <button type="button" aria-label="Grid view" className={gridView ? 'is-active' : ''} onClick={() => setGridView(true)}><SquaresFour size={14} /></button>
            </div>
          </div>

          {libraryTab === 'projects' && (
            <div className={`ad-project-list ${gridView ? 'is-grid' : ''}`}>
              {visibleProjects.length === 0 ? (
                <div className="ad-library__empty"><Palette size={18} /><span>Your Allternit Design projects will appear here.</span></div>
              ) : visibleProjects.map((project) => (
                <button type="button" key={project.id} onClick={() => onOpenProject?.(project)}>
                  <span className="ad-project-list__icon"><Palette size={15} /></span>
                  <span><b>{project.name}</b><small>{project.type} · Updated {new Date(project.updatedAt).toLocaleDateString()}</small></span>
                </button>
              ))}
            </div>
          )}

          {libraryTab === 'systems' && (
            <div className="ad-library-systems">
              {visibleSystems.map((system) => (
                <button type="button" key={system.id} onClick={() => chooseSystem(system)}>
                  <span className="ad-swatches ad-swatches--large">{system.swatches.slice(0, 5).map((color) => <i key={color} style={{ background: color }} />)}</span>
                  <b>{system.title.replace('Design System Inspired by ', '')}</b>
                  <small>{system.category}</small>
                </button>
              ))}
            </div>
          )}

          {libraryTab === 'templates' && (
            <div className="ad-library-templates">
              {CREATION_TYPES.map((type) => (
                <button type="button" key={type.id} onClick={() => { setSelectedType(type.id); setPrompt(`Create a new ${type.label.toLowerCase()}`); }}>
                  <type.icon size={21} /><span><b>{type.label}</b><small>{type.hint}</small></span>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
