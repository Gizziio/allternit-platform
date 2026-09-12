"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Brain,
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
import { useModelSelection } from '@/providers/model-selection-provider';
import type { ModelSelection } from '@/components/model-picker';
import type { ModelOption } from '@/components/prompt-kit/prompt-model-selector';
import { DESIGN_DIRECTIONS, type DesignDirection } from '../../lib/design/directions';
import { DESIGN_SYSTEMS_LIBRARY, type DesignSystemEntry } from '../../lib/design/design-systems-library';
import type { SkillRecord } from '../../lib/design/skill-registry';
import { listGalleryEntries, type GalleryEntry } from '../../lib/design/gallery-store';
import { useDesignProjectStore, type DesignProject } from '@/views/project/design/design-project.store';
import { AProtocolWordmark } from '@/components/AProtocolWordmark';
import { isElectronShell } from '@/lib/platform';
import './new-project-screen.css';

const CREATION_TYPES = [
  { id: 'prototype', label: 'Prototype', hint: 'Interactive product flow', icon: Browsers },
  { id: 'slides', label: 'Slides', hint: 'Deck or presentation', icon: Slideshow },
  { id: 'dashboard', label: 'Dashboard', hint: 'Data-dense tool UI', icon: FileText },
  { id: 'brand', label: 'Brand', hint: 'Identity and brand system', icon: GridFour },
  { id: 'content-engine', label: 'Content engine', hint: 'Content pipeline and campaigns', icon: Play },
] as const;

/** §6 P2 — Kimi "Adaptive"-equivalent output-shape pills. */
const ASPECT_OPTIONS = ['Adaptive', '1:1', '16:9', '9:16', '4:3', '3:4'] as const;

type LibraryTab = 'projects' | 'systems' | 'templates' | 'gallery';
type ComposerMenu = 'system' | 'type' | 'attach' | 'model' | null;

/**
 * §6 P1 — model chip (kimi.com/design "K3 · High" equivalent).
 *
 * `useModelSelection` throws outside a `ModelSelectionProvider` by design;
 * when no provider is above us (tests, Storybook) this renders nothing
 * instead of crashing the screen.
 */
function ModelPickerControl({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  let selection: ModelSelection | null = null;
  let availableModels: ModelOption[] = [];
  let isLoading = false;
  let selectModel: ((next: ModelSelection) => void) | null = null;
  try {
    const context = useModelSelection();
    selection = context.selection;
    availableModels = context.availableModels;
    isLoading = context.isLoading;
    selectModel = context.selectModel;
  } catch {
    return null;
  }

  /** Stable `provider/model` key — matches what readComposerRuntimeModelId rehydrates. */
  function modelKey(model: ModelOption): string {
    const providerId = model.providerId || model.provider
      || (model.id.includes('/') ? model.id.split('/')[0] : 'allternit');
    const modelId = model.id.includes('/') ? model.id.split('/').slice(1).join('/') : model.id;
    return `${providerId}/${modelId}`;
  }

  const selectedKey = selection ? `${selection.providerId}/${selection.modelId}` : null;

  return (
    <div className="ad-menu-anchor">
      <button type="button" className="ad-toolbar-button" onClick={onToggle}>
        <Brain size={15} weight="duotone" />
        <span><small>Model</small>{selection?.modelName ?? 'Model'}</span>
      </button>
      {isOpen && (
        <div className="ad-popover ad-model-picker" role="menu" aria-label="Choose model">
          {isLoading && availableModels.length === 0 && (
            <p className="ad-model-picker__status">Loading models…</p>
          )}
          {!isLoading && availableModels.length === 0 && (
            <p className="ad-model-picker__status">No models connected yet — pick a brain in Settings.</p>
          )}
          {availableModels.map((model) => (
            <button
              type="button"
              key={modelKey(model)}
              role="menuitem"
              className={selectedKey === modelKey(model) ? 'is-selected' : ''}
              onClick={() => {
                if (!selectModel) return;
                const providerId = model.providerId || model.provider
                  || (model.id.includes('/') ? model.id.split('/')[0] : 'allternit');
                const modelId = model.id.includes('/') ? model.id.split('/').slice(1).join('/') : model.id;
                selectModel({ providerId, profileId: providerId, modelId, modelName: model.name, modelAuto: false });
                onToggle();
              }}
            >
              <Brain size={16} /><span><b>{model.name}</b><small>{model.providerName ?? model.providerId ?? model.provider ?? ''}</small></span>
              {selectedKey === modelKey(model) && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Gallery pill labels keyed by creation type — kimi.com/design category-tab pattern. */
const GALLERY_TYPE_LABELS: Record<string, string> = {
  prototype: 'Landing pages',
  slides: 'Decks',
  dashboard: 'Dashboards',
  brand: 'Brand systems',
  mobile: 'Mobile apps',
  'content-engine': 'Content engines',
  template: 'Templates',
  other: 'Other',
};
const GALLERY_TYPE_ORDER = ['prototype', 'slides', 'dashboard', 'mobile', 'brand', 'content-engine', 'template', 'other'];

interface NewProjectScreenProps {
  onStart: (config: {
    name: string;
    prompt: string;
    type: string;
    direction: DesignDirection;
    system?: DesignSystemEntry;
    skill?: SkillRecord;
    skillValues?: Record<string, unknown>;
    aspect?: string;
  }) => void;
  onOpenProject?: (project: DesignProject) => void;
  onSelectDesignSystem?: (system: DesignSystemEntry) => void;
  onRemix?: (entry: GalleryEntry) => void;
  selectedSkill?: SkillRecord | null;
  onSelectSkill?: (skill: SkillRecord | null) => void;
  skillValues?: Record<string, unknown>;
  onChangeSkillValues?: (values: Record<string, unknown>) => void;
}

export function NewProjectScreen({
  onStart,
  onOpenProject,
  onSelectDesignSystem,
  onRemix,
  selectedSkill,
  onSelectSkill,
  skillValues,
  onChangeSkillValues,
}: NewProjectScreenProps) {
  const projects = useDesignProjectStore((state) => state.projects);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState('');
  const [selectedType, setSelectedType] = useState('prototype');
  const [selectedAspect, setSelectedAspect] = useState<string>('Adaptive');
  const [selectedDirection, setSelectedDirection] = useState('allternit-brand');
  const [selectedSystem, setSelectedSystem] = useState<DesignSystemEntry | null>(null);
  const [activeMenu, setActiveMenu] = useState<ComposerMenu>(null);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('projects');
  const [query, setQuery] = useState('');
  const [gridView, setGridView] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [galleryEntries, setGalleryEntries] = useState<GalleryEntry[]>([]);
  const [galleryCategory, setGalleryCategory] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    listGalleryEntries().then((entries) => {
      if (!cancelled) setGalleryEntries(entries);
    });
    return () => {
      cancelled = true;
    };
  }, [libraryTab]);

  const galleryTypes = GALLERY_TYPE_ORDER.filter((type) => galleryEntries.some((entry) => entry.type === type));
  const visibleGalleryEntries = galleryCategory === 'all'
    ? galleryEntries
    : galleryEntries.filter((entry) => entry.type === galleryCategory);

  const direction = DESIGN_DIRECTIONS.find((item) => item.id === selectedDirection) ?? DESIGN_DIRECTIONS[0];
  const activeType = CREATION_TYPES.find((item) => item.id === selectedType) ?? CREATION_TYPES[0];
  const skillInputs = selectedSkill?.inputs ?? [];

  /** Effective value for a skill input: user-set value wins, then declared default. */
  function skillInputValue(input: (typeof skillInputs)[number]): unknown {
    if (skillValues && input.name in skillValues) return skillValues[input.name];
    return input.default;
  }

  const missingRequiredInputs = skillInputs.filter((input) => {
    if (!input.required || input.type === 'boolean') return false;
    const value = skillInputValue(input);
    return value === undefined || value === null || String(value).trim() === '';
  });

  function setSkillInput(name: string, value: unknown) {
    onChangeSkillValues?.({ ...(skillValues ?? {}), [name]: value });
  }
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
    if (missingRequiredInputs.length > 0) return;
    const name = request.length > 54 ? `${request.slice(0, 51).trimEnd()}…` : request;
    onStart({
      name,
      prompt: request,
      type: selectedType,
      direction,
      system: selectedSystem ?? undefined,
      skill: selectedSkill ?? undefined,
      skillValues: selectedSkill ? (skillValues ?? {}) : undefined,
      aspect: selectedAspect === 'Adaptive' ? undefined : selectedAspect,
    });
  }

  function chooseSystem(system: DesignSystemEntry) {
    setSelectedSystem(system);
    onSelectDesignSystem?.(system);
    setActiveMenu(null);
  }

  return (
    <div className="ad-launch">
      {/* Frameless Electron design window: keep the brand clear of the macOS
          traffic lights (72px), matching OfficePageChrome's clearance. */}
      <header className="ad-launch__header" style={{ paddingLeft: isElectronShell() ? 72 : undefined }}>
        <div className="ad-launch__brand">
          <AProtocolWordmark theme="adaptive" height={12} suffix="DESIGN" />
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

          {skillInputs.length > 0 && (
            <div className="ad-skill-inputs" aria-label={`${selectedSkill!.name} inputs`}>
              {skillInputs.map((input) => {
                const label = input.label ?? input.name;
                const value = skillInputValue(input);
                return (
                  <label key={input.name} className="ad-skill-inputs__field">
                    <span className="ad-skill-inputs__label">
                      {label}
                      {input.required && <i className="ad-skill-inputs__required" aria-hidden>*</i>}
                    </span>
                    {input.type === 'boolean' ? (
                      <input
                        aria-label={label}
                        type="checkbox"
                        checked={value === true}
                        onChange={(event) => setSkillInput(input.name, event.target.checked)}
                      />
                    ) : input.type === 'enum' ? (
                      <select
                        aria-label={label}
                        value={typeof value === 'string' ? value : ''}
                        onChange={(event) => setSkillInput(input.name, event.target.value)}
                      >
                        {!input.required && <option value="">—</option>}
                        {(input.values ?? []).map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : input.type === 'text' ? (
                      <textarea
                        aria-label={label}
                        rows={2}
                        value={typeof value === 'string' ? value : ''}
                        placeholder={input.placeholder}
                        onChange={(event) => setSkillInput(input.name, event.target.value)}
                      />
                    ) : (
                      <input
                        aria-label={label}
                        type={input.type === 'integer' ? 'number' : 'text'}
                        value={typeof value === 'string' || typeof value === 'number' ? value : ''}
                        placeholder={input.placeholder ?? (input.default != null && input.default !== '' ? String(input.default) : undefined)}
                        min={input.min}
                        max={input.max}
                        onChange={(event) =>
                          setSkillInput(
                            input.name,
                            input.type === 'integer' && event.target.value !== ''
                              ? Number(event.target.value)
                              : event.target.value,
                          )
                        }
                      />
                    )}
                  </label>
                );
              })}
            </div>
          )}

          <div className="ad-composer__aspects" role="radiogroup" aria-label="Output shape">
            {ASPECT_OPTIONS.map((aspect) => (
              <button
                key={aspect}
                type="button"
                role="radio"
                aria-checked={selectedAspect === aspect}
                className={selectedAspect === aspect ? 'is-active' : ''}
                onClick={() => setSelectedAspect(aspect)}
              >
                {aspect}
              </button>
            ))}
          </div>

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

            <ModelPickerControl
              isOpen={activeMenu === 'model'}
              onToggle={() => setActiveMenu(activeMenu === 'model' ? null : 'model')}
            />

            {selectedSkill && <span className="ad-composer__skill"><Robot size={12} />{selectedSkill.name}</span>}
            <span className="ad-composer__agent">Allternit</span>
            <button type="button" className="ad-submit" disabled={!prompt.trim() || missingRequiredInputs.length > 0} onClick={submit} aria-label="Create project"><ArrowUp size={17} weight="bold" /></button>
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
              <button type="button" className={libraryTab === 'gallery' ? 'is-active' : ''} onClick={() => setLibraryTab('gallery')}>Gallery</button>
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

          {libraryTab === 'gallery' && (
            <div className="ad-gallery">
              {galleryEntries.length === 0 ? (
                <div className="ad-library__empty"><GridFour size={18} /><span>Artifacts you create will appear here — every design that passes the brand gate gets featured.</span></div>
              ) : (
                <>
                  <div className="ad-gallery__pills">
                    <button type="button" className={galleryCategory === 'all' ? 'is-active' : ''} onClick={() => setGalleryCategory('all')}>All</button>
                    {galleryTypes.map((type) => (
                      <button key={type} type="button" className={galleryCategory === type ? 'is-active' : ''} onClick={() => setGalleryCategory(type)}>
                        {GALLERY_TYPE_LABELS[type] ?? type}
                      </button>
                    ))}
                  </div>
                  <div className="ad-gallery__masonry">
                    {visibleGalleryEntries.map((entry) => (
                      <button type="button" key={entry.projectId} className="ad-gallery-card" onClick={() => onRemix?.(entry)} title={`Remix: ${entry.projectName}`}>
                        {entry.thumbnail ? (
                          <img src={entry.thumbnail} alt="" loading="lazy" />
                        ) : (
                          <span className="ad-gallery-card__placeholder" aria-hidden>{entry.projectName.slice(0, 1).toUpperCase()}</span>
                        )}
                        <span className="ad-gallery-card__meta">
                          <b>{entry.projectName}</b>
                          <small>
                            {GALLERY_TYPE_LABELS[entry.type] ?? 'Other'}
                            {entry.skillName ? ` · ${entry.skillName}` : ''}
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        <footer className="ad-launch__footer">Artifacts are AI-generated. For reference only — review before use.</footer>
      </main>
    </div>
  );
}
