/**
 * Environment Selector Component
 * 
 * Provides UI for selecting and resolving N5 Environment Specifications:
 * - Dev Container support (devcontainer.json)
 * - Nix Flakes (flake.nix)
 * - Dockerfiles
 * - OCI Images (direct)
 */

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Database, 
  FileCode, 
  GitBranch,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ChevronDown
} from 'lucide-react';
import * as envService from '../services/runtimeService';
import { useEnvironmentStore } from '../stores/environmentStore';

const SOURCE_OPTIONS: { value: envService.EnvironmentSource; label: string; icon: React.ReactNode; placeholder: string }[] = [
  { 
    value: 'devcontainer', 
    label: 'Dev Container', 
    icon: <Container size={16} /> as any,
    placeholder: 'mcr.microsoft.com/devcontainers/typescript-node:18'
  },
  { 
    value: 'nix', 
    label: 'Nix Flake', 
    icon: <GitBranch size={16} /> as any,
    placeholder: 'github:user/repo#devShell'
  },
  { 
    value: 'dockerfile', 
    label: 'Dockerfile', 
    icon: <FileCode size={16} /> as any,
    placeholder: './Dockerfile'
  },
  { 
    value: 'image', 
    label: 'OCI Image', 
    icon: <Box size={16} /> as any,
    placeholder: 'docker.io/library/ubuntu:22.04'
  },
];

export function EnvironmentSelector({ disabled = false }: { disabled?: boolean }) {
  // Use global store
  const environment = useEnvironmentStore((state: any) => state.environment);
  const isResolving = useEnvironmentStore((state: any) => state.isResolving);
  const error = useEnvironmentStore((state: any) => state.error);
  const { 
    setEnvironmentUri, 
    setEnvironmentSource, 
    setResolved, 
    setResolving, 
    setError 
  } = useEnvironmentStore();

  // Templates
  const [templates, setTemplates] = useState<envService.EnvironmentTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  // Load templates on mount
  useEffect(() => {
    envService.listEnvironmentTemplates()
      .then(setTemplates)
      .catch(console.error);
  }, []);

  const handleSourceChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setEnvironmentSource(e.target.value as envService.EnvironmentSource);
  }, [setEnvironmentSource]);

  const handleUriChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEnvironmentUri(e.target.value);
  }, [setEnvironmentUri]);

  const handleResolve = useCallback(async () => {
    if (!environment.uri) {
      setError('Please enter a source URI');
      return;
    }

    setResolving(true);
    setError(null);

    try {
      const spec = await envService.resolveEnvironment(environment.uri);
      setResolved(spec);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve environment');
    }
  }, [environment.uri, setResolved, setResolving, setError]);

  const selectTemplate = useCallback((template: envService.EnvironmentTemplate) => {
    setEnvironmentSource(template.source as envService.EnvironmentSource);
    setEnvironmentUri(template.source);
    setShowTemplates(false);
    // Auto-resolve after selecting template
    setTimeout(() => handleResolve(), 100);
  }, [setEnvironmentSource, setEnvironmentUri, handleResolve]);

  const selectedSource = SOURCE_OPTIONS.find(opt => opt.value === environment.source);

  return (
    <div className="environment-selector">
      <div className="environment-selector-header">
        {<Database size={16} /> as any}
        <span>Environment</span>
        {environment.resolved && (
          <span className="environment-badge">
            {<CheckCircle2 size={12} /> as any}
            Ready
          </span>
        )}
      </div>

      <div className="environment-selector-controls">
        <div className="environment-source-select">
          <select 
            value={environment.source} 
            onChange={handleSourceChange}
            disabled={disabled || isResolving}
            className="environment-select"
          >
            {SOURCE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="environment-source-icon">{selectedSource?.icon}</span>
        </div>

        <input
          type="text"
          value={environment.uri}
          onChange={handleUriChange}
          placeholder={selectedSource?.placeholder}
          disabled={disabled || isResolving}
          className="environment-uri-input"
        />

        <button
          onClick={handleResolve}
          disabled={disabled || isResolving || !environment.uri}
          className={`environment-resolve-button ${isResolving ? 'resolving' : ''}`}
        >
          {isResolving ? (
            <>
              {<Loader2 size={14} className="spin" /> as any}
              <span>Resolving...</span>
            </>
          ) : environment.resolved ? (
            <>
              {<RefreshCw size={14} /> as any}
              <span>Refresh</span>
            </>
          ) : (
            <>
              {<CheckCircle2 size={14} /> as any}
              <span>Resolve</span>
            </>
          )}
        </button>

        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className="environment-templates-toggle"
          title="Show templates"
        >
          {<ChevronDown size={16} className={showTemplates ? 'open' : ''} /> as any}
        </button>
      </div>

      {/* Templates Dropdown */}
      {showTemplates && templates.length > 0 && (
        <div className="environment-templates">
          <div className="environment-templates-header">Quick Select</div>
          {templates.map((template: envService.EnvironmentTemplate) => (
            <button
              key={template.id}
              onClick={() => selectTemplate(template)}
              className="environment-template-item"
            >
              <div className="environment-template-name">{template.name}</div>
              <div className="environment-template-desc">{template.description}</div>
              <div className="environment-template-tags">
                {template.tags.slice(0, 3).map((tag: string) => (
                  <span key={tag} className="environment-template-tag">{tag}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="environment-error">
          {<AlertCircle size={14} /> as any}
          <span>{error}</span>
        </div>
      )}

      {environment.resolved && (
        <div className="environment-resolved-info">
          <div className="environment-info-row">
            <span className="environment-info-label">Image:</span>
            <span className="environment-info-value" title={environment.resolved.image}>
              {environment.resolved.image.length > 40 ? environment.resolved.image.substring(0, 40) + '...' : environment.resolved.image}
            </span>
          </div>
          {environment.resolved.packages.length > 0 && (
            <div className="environment-info-row">
              <span className="environment-info-label">Packages:</span>
              <span className="environment-info-value">{environment.resolved.packages.length} configured</span>
            </div>
          )}
          {environment.resolved.features.length > 0 && (
            <div className="environment-info-row">
              <span className="environment-info-label">Features:</span>
              <span className="environment-info-value">{environment.resolved.features.length} installed</span>
            </div>
          )}
          {environment.resolved.mounts.length > 0 && (
            <div className="environment-info-row">
              <span className="environment-info-label">Mounts:</span>
              <span className="environment-info-value">{environment.resolved.mounts.length} configured</span>
            </div>
          )}
          <div className="environment-info-row">
            <span className="environment-info-label">Workspace:</span>
            <span className="environment-info-value">{environment.resolved.workspace_folder}</span>
          </div>
        </div>
      )}

      <style>{`
        .environment-selector {
          background: var(--invoke-panel-bg, rgba(30, 30, 30, 0.8));
          border: 1px solid var(--invoke-border, rgba(255, 255, 255, 0.1));
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 12px;
        }

        .environment-selector-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 500;
          color: var(--invoke-text-secondary, #888);
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .environment-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-left: auto;
          padding: 2px 8px;
          background: rgba(34, 197, 94, 0.2);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 12px;
          font-size: 11px;
          color: #22c55e;
          text-transform: none;
        }

        .environment-selector-controls {
          display: flex;
          gap: 8px;
          align-items: stretch;
        }

        .environment-source-select {
          position: relative;
          display: flex;
          align-items: center;
        }

        .environment-select {
          appearance: none;
          background: var(--invoke-input-bg, rgba(0, 0, 0, 0.3));
          border: 1px solid var(--invoke-border, rgba(255, 255, 255, 0.1));
          border-radius: 6px;
          padding: 8px 28px 8px 32px;
          font-size: 13px;
          color: var(--invoke-text, #fff);
          cursor: pointer;
          min-width: 140px;
        }

        .environment-select:focus {
          outline: none;
          border-color: var(--invoke-accent, #3b82f6);
        }

        .environment-select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .environment-source-icon {
          position: absolute;
          left: 10px;
          color: var(--invoke-text-secondary, #888);
          pointer-events: none;
        }

        .environment-uri-input {
          flex: 1;
          background: var(--invoke-input-bg, rgba(0, 0, 0, 0.3));
          border: 1px solid var(--invoke-border, rgba(255, 255, 255, 0.1));
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 13px;
          color: var(--invoke-text, #fff);
          font-family: 'Monaco', 'Menlo', monospace;
        }

        .environment-uri-input:focus {
          outline: none;
          border-color: var(--invoke-accent, #3b82f6);
        }

        .environment-uri-input::placeholder {
          color: var(--invoke-text-muted, #666);
        }

        .environment-uri-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .environment-resolve-button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: var(--invoke-accent, #3b82f6);
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          color: white;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .environment-resolve-button:hover:not(:disabled) {
          background: var(--invoke-accent-hover, #2563eb);
          transform: translateY(-1px);
        }

        .environment-resolve-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .environment-resolve-button.resolving {
          background: var(--invoke-warning, #f59e0b);
        }

        .environment-templates-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          padding: 8px;
          background: var(--invoke-input-bg, rgba(0, 0, 0, 0.3));
          border: 1px solid var(--invoke-border, rgba(255, 255, 255, 0.1));
          border-radius: 6px;
          color: var(--invoke-text-secondary, #888);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .environment-templates-toggle:hover {
          background: var(--invoke-input-bg-hover, rgba(255, 255, 255, 0.1));
          border-color: var(--invoke-border-hover, rgba(255, 255, 255, 0.2));
        }

        .environment-templates-toggle svg.open {
          transform: rotate(180deg);
        }

        .environment-templates {
          margin-top: 10px;
          padding: 10px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--invoke-border, rgba(255, 255, 255, 0.1));
          border-radius: 6px;
          max-height: 300px;
          overflow-y: auto;
        }

        .environment-templates-header {
          font-size: 11px;
          font-weight: 600;
          color: var(--invoke-text-secondary, #888);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
          padding-bottom: 6px;
          border-bottom: 1px solid var(--invoke-border, rgba(255, 255, 255, 0.1));
        }

        .environment-template-item {
          width: 100%;
          padding: 10px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 6px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-bottom: 6px;
        }

        .environment-template-item:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: var(--invoke-border, rgba(255, 255, 255, 0.1));
        }

        .environment-template-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--invoke-text, #fff);
          margin-bottom: 2px;
        }

        .environment-template-desc {
          font-size: 11px;
          color: var(--invoke-text-secondary, #888);
          margin-bottom: 6px;
        }

        .environment-template-tags {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }

        .environment-template-tag {
          padding: 2px 6px;
          background: rgba(59, 130, 246, 0.2);
          border-radius: 4px;
          font-size: 10px;
          color: #3b82f6;
        }

        .environment-error {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 10px;
          padding: 8px 12px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 6px;
          font-size: 12px;
          color: #ef4444;
        }

        .environment-resolved-info {
          margin-top: 12px;
          padding: 10px 12px;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 6px;
        }

        .environment-info-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          padding: 3px 0;
        }

        .environment-info-label {
          color: var(--invoke-text-secondary, #888);
        }

        .environment-info-value {
          color: var(--invoke-text, #fff);
          font-family: 'Monaco', 'Menlo', monospace;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}

export default EnvironmentSelector;
