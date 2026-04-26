/**
 * Skill Manager Component
 * 
 * Browse, install, and manage skills in the workspace.
 */

import { useState, useEffect } from 'react';
import { WorkspaceAPI, Skill } from '../../agent-workspace';

interface SkillManagerProps {
  api: WorkspaceAPI;
}

export function SkillManager({ api }: SkillManagerProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [filter, setFilter] = useState<'all' | 'installed' | 'available'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    api.listSkills().then(setSkills).catch(() => {});
  }, [api]);

  const categories = Array.from(new Set(skills.map(s => s.category).filter((c): c is string => !!c)));

  const filteredSkills = skills.filter(skill => {
    const matchesFilter = filter === 'all' || 
      (filter === 'installed' && skill.installed) ||
      (filter === 'available' && !skill.installed);
    const matchesSearch = !searchQuery ||
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || skill.category === categoryFilter;
    return matchesFilter && matchesSearch && matchesCategory;
  });

  const handleInstall = (skillId: string) => {
    api.installSkill(skillId)
      .then(() => setSkills(prev => prev.map(s => s.id === skillId ? { ...s, installed: true } : s)))
      .catch(() => {});
  };

  const handleUninstall = (skillId: string) => {
    api.uninstallSkill(skillId)
      .then(() => setSkills(prev => prev.map(s => s.id === skillId ? { ...s, installed: false } : s)))
      .catch(() => {});
  };

  const stats = {
    total: skills.length,
    installed: skills.filter(s => s.installed).length,
    available: skills.filter(s => !s.installed).length,
  };

  return (
    <div className="skill-manager">
      {/* Header Stats */}
      <div className="skill-manager__stats">
        <StatCard label="Total Skills" value={stats.total} icon="🛠️" />
        <StatCard label="Installed" value={stats.installed} icon="✓" color="#10b981" />
        <StatCard label="Available" value={stats.available} icon="⬇" color="#3b82f6" />
      </div>

      <div className="skill-manager__content">
        {/* Sidebar */}
        <aside className="skill-manager__sidebar">
          <div className="skill-manager__search">
            <input
              type="text"
              placeholder="Search skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="skill-manager__filters">
            <h3>Filter</h3>
            {(['all', 'installed', 'available'] as const).map(f => (
              <button
                key={f}
                className={`skill-filter ${filter === f ? 'skill-filter--active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                <span className="skill-filter__count">
                  {f === 'all' ? stats.total : f === 'installed' ? stats.installed : stats.available}
                </span>
              </button>
            ))}
          </div>

          <div className="skill-manager__categories">
            <h3>Categories</h3>
            <button
              className={`category-filter ${categoryFilter === 'all' ? 'category-filter--active' : ''}`}
              onClick={() => setCategoryFilter('all')}
            >
              All Categories
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                className={`category-filter ${categoryFilter === cat ? 'category-filter--active' : ''}`}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </aside>

        {/* Skills Grid */}
        <main className="skill-manager__grid">
          {filteredSkills.map(skill => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onClick={() => setSelectedSkill(skill)}
              onInstall={() => handleInstall(skill.id)}
              onUninstall={() => handleUninstall(skill.id)}
            />
          ))}
        </main>
      </div>

      {/* Skill Detail Modal */}
      {selectedSkill && (
        <SkillDetailModal
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
          onInstall={() => handleInstall(selectedSkill.id)}
          onUninstall={() => handleUninstall(selectedSkill.id)}
        />
      )}
    </div>
  );
}

// Sub-components

function StatCard({ label, value, icon, color }: { 
  label: string; 
  value: number; 
  icon: string;
  color?: string;
}) {
  return (
    <div className="skill-stat-card">
      <span className="skill-stat-card__icon" style={{ color: color || '#888' }}>{icon}</span>
      <div className="skill-stat-card__content">
        <span className="skill-stat-card__value">{value}</span>
        <span className="skill-stat-card__label">{label}</span>
      </div>
    </div>
  );
}

function SkillCard({ 
  skill, 
  onClick, 
  onInstall, 
  onUninstall 
}: { 
  skill: Skill;
  onClick: () => void;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  return (
    <div className="skill-card" onClick={onClick}>
      <div className="skill-card__header">
        <h4 className="skill-card__name">{skill.name}</h4>
        {skill.installed ? (
          <span className="skill-card__badge skill-card__badge--installed">✓ Installed</span>
        ) : (
          <span className="skill-card__badge skill-card__badge--available">Available</span>
        )}
      </div>
      
      <p className="skill-card__description">{skill.description}</p>
      
      <div className="skill-card__meta">
        <span className="skill-card__category">{skill.category}</span>
        <span className="skill-card__version">v{skill.version}</span>
      </div>
      
      <div className="skill-card__tags">
        {(skill.tags ?? []).slice(0, 3).map(tag => (
          <span key={tag} className="skill-card__tag">{tag}</span>
        ))}
      </div>
      
      <div className="skill-card__actions" onClick={e => e.stopPropagation()}>
        {skill.installed ? (
          <button className="skill-card__btn skill-card__btn--uninstall" onClick={onUninstall}>
            Uninstall
          </button>
        ) : (
          <button className="skill-card__btn skill-card__btn--install" onClick={onInstall}>
            Install
          </button>
        )}
      </div>
    </div>
  );
}

function SkillDetailModal({ 
  skill, 
  onClose, 
  onInstall, 
  onUninstall 
}: { 
  skill: Skill;
  onClose: () => void;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  return (
    <div className="skill-modal-overlay" onClick={onClose}>
      <div className="skill-modal" onClick={e => e.stopPropagation()}>
        <header className="skill-modal__header">
          <div className="skill-modal__title">
            <h2>{skill.name}</h2>
            {skill.installed ? (
              <span className="skill-modal__status skill-modal__status--installed">✓ Installed</span>
            ) : (
              <span className="skill-modal__status skill-modal__status--available">Available</span>
            )}
          </div>
          <button className="skill-modal__close" onClick={onClose}>×</button>
        </header>

        <div className="skill-modal__content">
          <p className="skill-modal__description">{skill.description}</p>

          <div className="skill-modal__section">
            <h3>Details</h3>
            <div className="skill-modal__details">
              <div className="skill-detail-row">
                <span className="skill-detail-row__label">Version</span>
                <span className="skill-detail-row__value">{skill.version}</span>
              </div>
              <div className="skill-detail-row">
                <span className="skill-detail-row__label">Author</span>
                <span className="skill-detail-row__value">{skill.author}</span>
              </div>
              <div className="skill-detail-row">
                <span className="skill-detail-row__label">Category</span>
                <span className="skill-detail-row__value">{skill.category}</span>
              </div>
              <div className="skill-detail-row">
                <span className="skill-detail-row__label">Entry Point</span>
                <code className="skill-detail-row__value">{skill.entryPoint}</code>
              </div>
            </div>
          </div>

          {(skill.dependencies ?? []).length > 0 && (
            <div className="skill-modal__section">
              <h3>Dependencies</h3>
              <div className="skill-modal__dependencies">
                {skill.dependencies?.map(dep => (
                  <span key={dep} className="dependency-tag">{dep}</span>
                ))}
              </div>
            </div>
          )}

          <div className="skill-modal__section">
            <h3>Tags</h3>
            <div className="skill-modal__tags">
              {skill.tags?.map(tag => (
                <span key={tag} className="skill-tag">{tag}</span>
              ))}
            </div>
          </div>

          {skill.documentation && (
            <div className="skill-modal__section">
              <h3>Documentation</h3>
              <code className="skill-modal__doc-path">{skill.documentation}</code>
            </div>
          )}
        </div>

        <footer className="skill-modal__footer">
          {skill.installed ? (
            <button className="skill-modal__btn skill-modal__btn--uninstall" onClick={onUninstall}>
              Uninstall Skill
            </button>
          ) : (
            <button className="skill-modal__btn skill-modal__btn--install" onClick={onInstall}>
              Install Skill
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

// CSS Styles
export const skillManagerStyles = `
.skill-manager {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.skill-manager__stats {
  display: flex;
  gap: 1rem;
}

.skill-stat-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
}

.skill-stat-card__icon {
  font-size: 1.5rem;
}

.skill-stat-card__content {
  display: flex;
  flex-direction: column;
}

.skill-stat-card__value {
  font-size: 1.5rem;
  font-weight: 700;
}

.skill-stat-card__label {
  font-size: 0.75rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.skill-manager__content {
  display: flex;
  gap: 1.5rem;
}

.skill-manager__sidebar {
  width: 240px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.skill-manager__search input {
  width: 100%;
  padding: 0.625rem;
  background: #0f0f0f;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 0.875rem;
}

.skill-manager__search input:focus {
  outline: none;
  border-color: #3b82f6;
}

.skill-manager__filters h3,
.skill-manager__categories h3 {
  margin: 0 0 0.75rem;
  font-size: 0.75rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.skill-filter,
.category-filter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.625rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #888;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  font-size: 0.875rem;
}

.skill-filter:hover,
.category-filter:hover {
  background: #2a2a2a;
  color: #e0e0e0;
}

.skill-filter--active,
.category-filter--active {
  background: #2a2a2a;
  color: #3b82f6;
  font-weight: 500;
}

.skill-filter__count {
  font-size: 0.75rem;
  color: #666;
}

.skill-manager__grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  align-content: start;
}

.skill-card {
  display: flex;
  flex-direction: column;
  padding: 1.25rem;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.skill-card:hover {
  border-color: #3b82f6;
  transform: translateY(-2px);
}

.skill-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.skill-card__name {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.skill-card__badge {
  font-size: 0.7rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 500;
}

.skill-card__badge--installed {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.skill-card__badge--available {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.skill-card__description {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  color: #888;
  line-height: 1.5;
  flex: 1;
}

.skill-card__meta {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  font-size: 0.75rem;
  color: #666;
}

.skill-card__category {
  background: #2a2a2a;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.skill-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
}

.skill-card__tag {
  font-size: 0.7rem;
  color: #666;
}

.skill-card__tag::before {
  content: '#';
}

.skill-card__actions {
  margin-top: auto;
}

.skill-card__btn {
  width: 100%;
  padding: 0.5rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.skill-card__btn--install {
  background: #3b82f6;
  color: white;
}

.skill-card__btn--install:hover {
  background: #2563eb;
}

.skill-card__btn--uninstall {
  background: transparent;
  border: 1px solid #ef4444;
  color: #ef4444;
}

.skill-card__btn--uninstall:hover {
  background: rgba(239, 68, 68, 0.1);
}

.skill-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.skill-modal {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  width: 100%;
  max-width: 560px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.skill-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #2a2a2a;
}

.skill-modal__title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.skill-modal__title h2 {
  margin: 0;
  font-size: 1.25rem;
}

.skill-modal__status {
  font-size: 0.75rem;
  padding: 0.25rem 0.625rem;
  border-radius: 4px;
  font-weight: 500;
}

.skill-modal__status--installed {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.skill-modal__status--available {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.skill-modal__close {
  background: none;
  border: none;
  color: #888;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.25rem;
}

.skill-modal__close:hover {
  color: #e0e0e0;
}

.skill-modal__content {
  padding: 1.5rem;
  overflow-y: auto;
}

.skill-modal__description {
  margin: 0 0 1.5rem;
  line-height: 1.6;
  color: #aaa;
}

.skill-modal__section {
  margin-bottom: 1.5rem;
}

.skill-modal__section h3 {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.skill-modal__details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.skill-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.625rem;
  background: #0f0f0f;
  border-radius: 6px;
}

.skill-detail-row__label {
  font-size: 0.875rem;
  color: #888;
}

.skill-detail-row__value {
  font-size: 0.875rem;
  font-family: monospace;
}

.skill-modal__dependencies,
.skill-modal__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.dependency-tag,
.skill-tag {
  padding: 0.375rem 0.75rem;
  background: #2a2a2a;
  border-radius: 4px;
  font-size: 0.875rem;
}

.skill-modal__doc-path {
  display: block;
  padding: 0.75rem;
  background: #0f0f0f;
  border-radius: 6px;
  font-family: monospace;
  font-size: 0.875rem;
  color: #3b82f6;
}

.skill-modal__footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #2a2a2a;
  display: flex;
  justify-content: flex-end;
}

.skill-modal__btn {
  padding: 0.625rem 1.25rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.skill-modal__btn--install {
  background: #3b82f6;
  color: white;
}

.skill-modal__btn--install:hover {
  background: #2563eb;
}

.skill-modal__btn--uninstall {
  background: transparent;
  border: 1px solid #ef4444;
  color: #ef4444;
}

.skill-modal__btn--uninstall:hover {
  background: rgba(239, 68, 68, 0.1);
}
`;
