"use client";

import { cn } from "@/lib/utils";
import React, { useEffect, useMemo, useState } from "react";
import {
  FolderOpen,
  FileText,
  FileCode,
  ArrowsClockwise,
  FloppyDisk,
  Wrench,
  Clock,
  Package,
  Check,
  X, Record } from '@phosphor-icons/react';
import { agentWorkspaceService } from '@/lib/agents/agent-workspace.service';
import { agentWorkspaceFilesApi } from '@/lib/agents/agent-workspace-files-api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SkillBuilderWizard, HeartbeatScheduler, PackageManager } from '@/components/agent-workspace';
import { WorkspaceChatEditor } from '@/components/agent-workspace/WorkspaceChatEditor';
import type { Agent, AgentWorkspaceLayers } from '@/lib/agents/agent.types';

import { createModuleLogger } from '@/lib/logger';
const logger = createModuleLogger('WorkspaceTab');

interface WorkspaceTabProps {
  agent: Agent;
}

const DEFAULT_LAYERS: AgentWorkspaceLayers = {
  cognitive: true,
  identity: true,
  governance: true,
  skills: true,
  business: true,
};

// Map file paths to their layers
const getFileLayer = (path: string): keyof AgentWorkspaceLayers => {
  const normalized = path.toLowerCase();
  if (normalized.includes('cognitive') || normalized.includes('reasoning') || normalized.includes('memory')) return 'cognitive';
  if (normalized.includes('identity') || normalized.includes('character') || normalized.includes('persona')) return 'identity';
  if (normalized.includes('governance') || normalized.includes('heartbeat') || normalized.includes('constitution')) return 'governance';
  if (normalized.includes('skill') || normalized.includes('tool') || normalized.includes('capability')) return 'skills';
  if (normalized.includes('business') || normalized.includes('api') || normalized.includes('integration')) return 'business';
  return 'skills'; // default
};

// The workspace files endpoint returns workspace-relative paths (`SOUL.md`,
// `.allternit/…`). Older sources could carry workspace-rooted paths
// (`agents/<id>/…` or absolute) — strip up to `agents/<id>/` if present so
// labels always show workspace-relative paths.
const workspaceRelativePath = (p: string) => p.replace(/^.*?agents\/[^/]+\//, '');

export function WorkspaceTab({ agent }: WorkspaceTabProps) {
  const [files, setFiles] = useState<Array<{ name: string; path: string; type: 'file' | 'directory' }>>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSkillBuilder, setShowSkillBuilder] = useState(false);
  const [showHeartbeatScheduler, setShowHeartbeatScheduler] = useState(false);
  const [showPackageManager, setShowPackageManager] = useState(false);
  const [layers, setLayers] = useState<AgentWorkspaceLayers>(DEFAULT_LAYERS);
  const [isLoadingLayers, setIsLoadingLayers] = useState(false);

  useEffect(() => {
    loadWorkspaceFiles();
    loadLayerConfig();
  }, [agent.id]);

  const loadWorkspaceFiles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Real workspace files from the Rust API (workspace-relative paths).
      const list = await agentWorkspaceFilesApi.list(agent.id);
      setFiles(list.map(f => ({
        name: f.path.split('/').pop() ?? f.path,
        path: f.path,
        type: 'file' as const,
      })));
    } catch (e) {
      setError('Failed to load workspace files');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFile = async (path: string) => {
    setIsLoading(true);
    try {
      const content = await agentWorkspaceFilesApi.read(agent.id, path);
      setFileContent(content);
      setSelectedFile(path);
    } catch (e) {
      setError('Failed to load file');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    setIsSaving(true);
    try {
      await agentWorkspaceFilesApi.write(agent.id, selectedFile, fileContent);
    } catch (e) {
      setError('Failed to save file');
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const loadLayerConfig = async () => {
    setIsLoadingLayers(true);
    try {
      const manifest = await agentWorkspaceService.getManifest(agent.id);
      if (manifest?.layers) {
        setLayers(manifest.layers);
      }
    } catch {
      // manifest may not exist yet — use defaults
    } finally {
      setIsLoadingLayers(false);
    }
  };

  const toggleLayer = async (layer: keyof AgentWorkspaceLayers) => {
    const newLayers = { ...layers, [layer]: !layers[layer] };
    setLayers(newLayers);
    
    // Save to workspace manifest
    try {
      await agentWorkspaceService.updateManifest(agent.id, { layers: newLayers });
    } catch (e) {
      logger.error({ err: e }, 'Failed to save layer config:');
    }
  };

  // Filter files based on enabled layers
  const filteredFiles = useMemo(() => {
    return files.filter(file => {
      if (file.type === 'directory') return true;
      const layer = getFileLayer(file.path);
      return layers[layer];
    });
  }, [files, layers]);

  const groupedFiles = useMemo(() => {
    const groups: Record<string, typeof filteredFiles> = {};
    filteredFiles.forEach(file => {
      const rel = workspaceRelativePath(file.path);
      const dir = rel.split('/').slice(0, -1).join('/') || 'Root';
      if (!groups[dir]) groups[dir] = [];
      groups[dir].push(file);
    });
    return groups;
  }, [filteredFiles]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Sidebar - File Tree */}
      <div className="w-80 min-w-[320px] border-r border-solid border-studio-border-subtle bg-studio-card flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-solid border-studio-border-subtle">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[15px] font-semibold text-studio-text-primary">
              Files
            </span>
            <button type="button"
              onClick={loadWorkspaceFiles}
              disabled={isLoading}
              className="p-1.5 rounded-md bg-transparent border-none text-studio-text-secondary cursor-pointer transition-colors hover:bg-studio-bg"
            >
              <ArrowsClockwise className={cn("size-4", isLoading && "animate-spin")} />
            </button>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-1.5 flex-wrap">
            <button type="button"
              onClick={() => setShowSkillBuilder(true)}
              className="px-2.5 py-1.5 rounded-md bg-[var(--accent-primary)]/10 border border-solid border-[var(--accent-primary)]/30 text-[var(--accent-primary)] cursor-pointer text-[12px] flex items-center gap-1 font-medium transition-all hover:bg-[var(--accent-primary)]/20"
            >
              <Wrench size={12} />
              New Skill
            </button>
            <button type="button"
              onClick={() => setShowHeartbeatScheduler(true)}
              className="px-2.5 py-1.5 rounded-md bg-studio-bg border border-solid border-studio-border-subtle text-studio-text-secondary cursor-pointer text-[12px] flex items-center gap-1 transition-all hover:bg-studio-card"
            >
              <Clock size={12} />
              Heartbeat
            </button>
            <button type="button"
              onClick={() => setShowPackageManager(true)}
              className="px-2.5 py-1.5 rounded-md bg-studio-bg border border-solid border-studio-border-subtle text-studio-text-secondary cursor-pointer text-[12px] flex items-center gap-1 transition-all hover:bg-studio-card"
            >
              <Package size={12} />
              Package
            </button>
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-auto p-2">
          {error && (
            <div className="p-3 bg-red-500/10 rounded-lg mb-3">
              <span className="text-[12px] text-red-500">{error}</span>
            </div>
          )}

          {filteredFiles.length > 0 ? (
            Object.entries(groupedFiles).map(([dir, dirFiles]) => (
              <div key={dir} className="mb-4">
                <div className="text-[12px] font-semibold text-studio-text-muted tracking-wider mb-2 pl-2 font-mono">
                  {dir}
                </div>
                {dirFiles.map(file => (
                  <button type="button"
                    key={file.path}
                    onClick={() => file.type === 'file' && loadFile(file.path)}
                    className={cn(
                      "flex items-center gap-2 w-full p-1.5 px-3 rounded border-none cursor-pointer text-[12px] text-left transition-colors",
                      selectedFile === file.path 
                        ? "bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]" 
                        : "bg-transparent text-studio-text-secondary hover:bg-studio-bg",
                      file.type !== 'file' && "cursor-default"
                    )}
                  >
                    {file.type === 'directory' ? (
                      <FolderOpen size={14} className="shrink-0" />
                    ) : (
                      <FileText size={14} className="shrink-0" />
                    )}
                    <span className="truncate">
                      {workspaceRelativePath(file.path).split('/').pop()}
                    </span>
                  </button>
                ))}
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-studio-text-muted">
              <FolderOpen size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-[13px] mb-1">No files in workspace</p>
              <p className="text-[12px] opacity-70">
                Create skills or use the Package Manager to import
              </p>
            </div>
          )}
        </div>

        {/* Layer indicators footer */}
        <div className="p-3 px-4 border-t border-solid border-studio-border-subtle bg-studio-bg">
          <div className="text-[12px] text-studio-text-muted mb-2 uppercase tracking-wider">
            Workspace Layers
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(layers) as Array<keyof AgentWorkspaceLayers>).map(layer => {
              const isEnabled = layers[layer];
              return (
                <button type="button"
                  key={layer}
                  onClick={() => toggleLayer(layer)}
                  disabled={isLoadingLayers}
                  className={cn(
                    "text-[12px] px-2 py-1 rounded border border-solid capitalize cursor-pointer flex items-center gap-1 transition-all duration-150",
                    isEnabled 
                      ? "bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)]/40 hover:bg-[var(--accent-primary)]/30" 
                      : "bg-studio-card text-studio-text-muted border-studio-border-subtle hover:bg-studio-border-subtle"
                  )}
                  title={`${isEnabled ? 'Hide' : 'Show'} ${layer} layer files`}
                >
                  {isEnabled ? (
                    <Check size={10} />
                  ) : (
                    <X size={10} />
                  )}
                  {layer}
                </button>
              );
            })}
          </div>
          <div className="text-[12px] text-studio-text-muted mt-2 opacity-70">
            Click to show/hide layer files
          </div>
        </div>
      </div>

      {/* Right Side - File Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedFile ? (
          <>
            {/* Editor Header */}
            <div className="p-3 px-4 border-b border-solid border-studio-border-subtle flex items-center justify-between bg-studio-card">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <FileText size={16} className="text-[var(--accent-primary)] shrink-0" />
                <span className="text-[13px] font-mono text-studio-text-primary truncate">
                  {workspaceRelativePath(selectedFile)}
                </span>
              </div>
              <Button
                size="sm"
                onClick={saveFile}
                disabled={isSaving}
                className="bg-[var(--accent-primary)] shrink-0"
              >
                {isSaving ? (
                  <ArrowsClockwise size={14} className="animate-spin" />
                ) : (
                  <>
                    <FloppyDisk size={14} className="mr-1.5" />
                    Save
                  </>
                )}
              </Button>
            </div>
            
            {/* Editor Content */}
            <Textarea
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              className="flex-1 border-none rounded-none bg-studio-bg text-studio-text-primary font-mono text-[13px] leading-relaxed resize-none p-4 focus:ring-0"
              spellCheck={false}
            />

            {/* Chat-to-edit: proposes revised content; Apply loads it above,
                Save persists — the chat never writes to disk itself. */}
            <WorkspaceChatEditor
              agentId={agent.id}
              agentName={agent.name}
              filePath={workspaceRelativePath(selectedFile)}
              content={fileContent}
              onApply={setFileContent}
            />
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center text-studio-text-muted p-8">
            <FileCode size={64} className="mb-5 opacity-20" />
            <p className="text-[16px] mb-2 text-studio-text-secondary">
              Select a file to edit
            </p>
            <p className="text-[13px] text-center max-w-[300px]">
              Browse the workspace files in the sidebar to view and edit your agent's configuration
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showSkillBuilder && (
        <SkillBuilderWizard
          agentId={agent.id}
          onClose={() => setShowSkillBuilder(false)}
          onSkillCreated={() => {
            setShowSkillBuilder(false);
            loadWorkspaceFiles();
          }}
        />
      )}
      {showHeartbeatScheduler && (
        <HeartbeatScheduler agentId={agent.id} onClose={() => setShowHeartbeatScheduler(false)} />
      )}
      {showPackageManager && (
        <PackageManager
          agentId={agent.id}
          onClose={() => setShowPackageManager(false)}
          onImport={() => loadWorkspaceFiles()}
        />
      )}
    </div>
  );
}
