/**
 * Memory Editor Component
 * 
 * Markdown editor for memory files (MEMORY.md, session logs, lessons learned).
 */

import { useState, useEffect, useCallback } from 'react';
import { WorkspaceAPI } from '../../agent-workspace';
import { MemoryEntry } from './types';

interface MemoryEditorProps {
  api: WorkspaceAPI;
}

export function MemoryEditor({ api }: MemoryEditorProps) {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<MemoryEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [filter, setFilter] = useState<'all' | 'session' | 'lesson' | 'decision' | 'checkpoint'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Load memory entries
    const loadEntries = async () => {
      // Mock data - replace with actual API call
      const mockEntries: MemoryEntry[] = [
        {
          id: 'mem-1',
          timestamp: new Date().toISOString(),
          type: 'session',
          title: 'Initial Workspace Setup',
          content: `# Session: Initial Workspace Setup

## Summary
Successfully initialized the agent workspace with all 5 layers.

## Actions Taken
1. Created workspace directory structure
2. Initialized BRAIN.md with initial task graph
3. Set up MEMORY.md index
4. Configured IDENTITY.md and SOUL.md

## Outcomes
- Workspace is ready for agent operations
- All core files are in place
- Policy engine is configured with default rules

## Next Steps
- Install required skills
- Configure business topology (if needed)
- Run first task`,
          tags: ['setup', 'initialization'],
          relatedTasks: ['task-1'],
        },
        {
          id: 'mem-2',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          type: 'lesson',
          title: 'Workspace Organization Best Practices',
          content: `# Lesson: Workspace Organization

## What Worked
- Keeping MEMORY.md as an index rather than storing everything
- Using dated session files in memory/ directory
- Tagging entries for easy retrieval

## What to Improve
- Need better linking between related entries
- Should automate timestamp generation
- Consider adding search index

## Recommendations
1. Use consistent naming conventions
2. Link related entries explicitly
3. Summarize long sessions`,
          tags: ['best-practices', 'organization'],
          relatedTasks: [],
        },
        {
          id: 'mem-3',
          timestamp: new Date(Date.now() - 172800000).toISOString(),
          type: 'decision',
          title: 'Policy: Tool Approval Requirements',
          content: `# Decision: Tool Approval Policy

## Context
Need to balance agent autonomy with safety.

## Decision
- filesystem.write: Requires approval if outside workspace
- network.http: Always requires approval
- system.exec: Denied by default

## Rationale
File system operations outside the workspace could be dangerous. Network access could leak data. System execution is too risky.

## Implementation
Updated POLICY.md with these rules. Policy engine enforces them automatically.`,
          tags: ['policy', 'safety', 'decision'],
          relatedTasks: ['task-4'],
        },
      ];
      setEntries(mockEntries);
    };

    loadEntries();
  }, [api]);

  const filteredEntries = entries.filter(entry => {
    const matchesFilter = filter === 'all' || entry.type === filter;
    const matchesSearch = !searchQuery || 
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const handleSave = useCallback(() => {
    if (selectedEntry) {
      const updated = { ...selectedEntry, content: editContent };
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
      setSelectedEntry(updated);
      setIsEditing(false);
      // TODO: Persist to backend
    }
  }, [selectedEntry, editContent]);

  const handleCreateNew = () => {
    const newEntry: MemoryEntry = {
      id: `mem-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'session',
      title: 'New Entry',
      content: '# New Memory Entry\n\n',
      tags: [],
      relatedTasks: [],
    };
    setEntries(prev => [newEntry, ...prev]);
    setSelectedEntry(newEntry);
    setEditContent(newEntry.content);
    setIsEditing(true);
  };

  const getTypeIcon = (type: MemoryEntry['type']) => {
    const icons = {
      session: '📝',
      lesson: '💡',
      decision: '⚖️',
      checkpoint: '📍',
    };
    return icons[type];
  };

  const getTypeLabel = (type: MemoryEntry['type']) => {
    const labels = {
      session: 'Session Log',
      lesson: 'Lesson Learned',
      decision: 'Decision Record',
      checkpoint: 'Checkpoint',
    };
    return labels[type];
  };

  return (
    <div className="memory-editor">
      {/* Sidebar */}
      <aside className="memory-editor__sidebar">
        <div className="memory-editor__toolbar">
          <button 
            className="memory-editor__new-btn"
            onClick={handleCreateNew}
          >
            + New Entry
          </button>
        </div>

        <div className="memory-editor__search">
          <input
            type="text"
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="memory-editor__filters">
          {(['all', 'session', 'lesson', 'decision', 'checkpoint'] as const).map(type => (
            <button
              key={type}
              className={`memory-editor__filter ${filter === type ? 'memory-editor__filter--active' : ''}`}
              onClick={() => setFilter(type)}
            >
              {type === 'all' ? '📁' : getTypeIcon(type)} {type === 'all' ? 'All' : getTypeLabel(type)}
            </button>
          ))}
        </div>

        <div className="memory-editor__list">
          {filteredEntries.map(entry => (
            <div
              key={entry.id}
              className={`memory-editor__item ${selectedEntry?.id === entry.id ? 'memory-editor__item--active' : ''}`}
              onClick={() => {
                setSelectedEntry(entry);
                setEditContent(entry.content);
                setIsEditing(false);
              }}
            >
              <span className="memory-editor__item-icon">{getTypeIcon(entry.type)}</span>
              <div className="memory-editor__item-content">
                <span className="memory-editor__item-title">{entry.title}</span>
                <span className="memory-editor__item-date">
                  {new Date(entry.timestamp).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Editor */}
      <main className="memory-editor__main">
        {selectedEntry ? (
          <>
            <header className="memory-editor__header">
              <div className="memory-editor__header-info">
                <span className="memory-editor__header-type">
                  {getTypeIcon(selectedEntry.type)} {getTypeLabel(selectedEntry.type)}
                </span>
                <h2>{selectedEntry.title}</h2>
                <span className="memory-editor__header-date">
                  {new Date(selectedEntry.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="memory-editor__header-actions">
                {isEditing ? (
                  <>
                    <button onClick={handleSave} className="btn btn--primary">
                      Save
                    </button>
                    <button 
                      onClick={() => {
                        setIsEditing(false);
                        setEditContent(selectedEntry.content);
                      }}
                      className="btn btn--secondary"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="btn btn--secondary"
                  >
                    Edit
                  </button>
                )}
              </div>
            </header>

            <div className="memory-editor__tags">
              {selectedEntry.tags.map(tag => (
                <span key={tag} className="memory-tag">#{tag}</span>
              ))}
            </div>

            {isEditing ? (
              <textarea
                className="memory-editor__textarea"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                spellCheck={false}
              />
            ) : (
              <div className="memory-editor__preview">
                <MarkdownPreview content={selectedEntry.content} />
              </div>
            )}
          </>
        ) : (
          <div className="memory-editor__empty">
            <p>Select a memory entry to view or edit</p>
          </div>
        )}
      </main>
    </div>
  );
}

// Simple markdown preview component
function MarkdownPreview({ content }: { content: string }) {
  // In production, use a proper markdown parser like react-markdown
  // This is a simplified version for demonstration
  const lines = content.split('\n');
  
  return (
    <div className="markdown-preview">
      {lines.map((line, i) => {
        const lineKey = `line-${i}-${line.slice(0, 30)}`;
        if (line.startsWith('# ')) {
          return <h1 key={lineKey}>{line.slice(2)}</h1>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={lineKey}>{line.slice(3)}</h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={lineKey}>{line.slice(4)}</h3>;
        }
        if (line.startsWith('- ')) {
          return <li key={lineKey}>{line.slice(2)}</li>;
        }
        if (line.startsWith('1. ') || line.startsWith('2. ') || line.startsWith('3. ')) {
          return <li key={lineKey}>{line.slice(3)}</li>;
        }
        if (line.trim() === '') {
          return <br key={`br-${i}`} />;
        }
        return <p key={lineKey}>{line}</p>;
      })}
    </div>
  );
}

// CSS Styles
export const memoryEditorStyles = `
.memory-editor {
  display: flex;
  height: 100%;
  gap: 1.5rem;
}

.memory-editor__sidebar {
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border-right: 1px solid #2a2a2a;
  padding-right: 1rem;
}

.memory-editor__toolbar {
  display: flex;
  gap: 0.5rem;
}

.memory-editor__new-btn {
  flex: 1;
  padding: 0.75rem;
  background: #3b82f6;
  border: none;
  border-radius: 6px;
  color: white;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.memory-editor__new-btn:hover {
  background: #2563eb;
}

.memory-editor__search input {
  width: 100%;
  padding: 0.625rem;
  background: #0f0f0f;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 0.875rem;
}

.memory-editor__search input:focus {
  outline: none;
  border-color: #3b82f6;
}

.memory-editor__filters {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.memory-editor__filter {
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #888;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.memory-editor__filter:hover {
  background: #2a2a2a;
  color: #e0e0e0;
}

.memory-editor__filter--active {
  background: #2a2a2a;
  color: #3b82f6;
  font-weight: 500;
}

.memory-editor__list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.memory-editor__item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #1a1a1a;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.memory-editor__item:hover {
  border-color: #3b82f6;
}

.memory-editor__item--active {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.memory-editor__item-icon {
  font-size: 1.25rem;
}

.memory-editor__item-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.memory-editor__item-title {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.memory-editor__item-date {
  font-size: 0.75rem;
  color: #666;
}

.memory-editor__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.memory-editor__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 1rem;
  border-bottom: 1px solid #2a2a2a;
  margin-bottom: 1rem;
}

.memory-editor__header-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.memory-editor__header-type {
  font-size: 0.75rem;
  color: #3b82f6;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.memory-editor__header h2 {
  margin: 0;
  font-size: 1.5rem;
}

.memory-editor__header-date {
  font-size: 0.875rem;
  color: #666;
}

.memory-editor__header-actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn--primary {
  background: #3b82f6;
  border: none;
  color: white;
}

.btn--primary:hover {
  background: #2563eb;
}

.btn--secondary {
  background: transparent;
  border: 1px solid #2a2a2a;
  color: #e0e0e0;
}

.btn--secondary:hover {
  background: #2a2a2a;
}

.memory-editor__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.memory-tag {
  background: #2a2a2a;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  color: #888;
}

.memory-editor__textarea {
  flex: 1;
  background: #0f0f0f;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  padding: 1rem;
  color: #e0e0e0;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  resize: none;
  white-space: pre-wrap;
}

.memory-editor__textarea:focus {
  outline: none;
  border-color: #3b82f6;
}

.memory-editor__preview {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background: #0f0f0f;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
}

.memory-editor__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
}

.markdown-preview {
  line-height: 1.8;
}

.markdown-preview h1 {
  font-size: 1.75rem;
  margin: 0 0 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #2a2a2a;
}

.markdown-preview h2 {
  font-size: 1.375rem;
  margin: 1.5rem 0 0.75rem;
  color: #3b82f6;
}

.markdown-preview h3 {
  font-size: 1.125rem;
  margin: 1.25rem 0 0.5rem;
}

.markdown-preview p {
  margin: 0.75rem 0;
}

.markdown-preview li {
  margin: 0.25rem 0;
  margin-left: 1.5rem;
}
`;
