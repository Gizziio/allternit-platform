"use client";

import { useState, useCallback, useEffect } from 'react';
import { NodeTerminal } from './NodeTerminal';
import { nodeTerminalService, type TerminalSession, type SandboxConfig, type VolumeMount } from './terminal.service';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Plus, Terminal, Settings2, ChevronDown, ChevronUp, Container, Shield } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TerminalTabsProps {
  initialNodeId?: string;
  className?: string;
}

interface TerminalOptions {
  shell: string;
  cols: number;
  rows: number;
  workingDir: string;
  envVars: Array<{ key: string; value: string }>;
  sandbox: SandboxOptions;
}

interface SandboxOptions {
  enabled: boolean;
  image: string;
  cpus: number;
  memoryMb: number;
  volumes: VolumeMount[];
  readOnlyRoot: boolean;
  dropCapabilities: boolean;
  noHostNetwork: boolean;
}

const DEFAULT_SANDBOX_OPTIONS: SandboxOptions = {
  enabled: false,
  image: 'alpine:latest',
  cpus: 1.0,
  memoryMb: 512,
  volumes: [],
  readOnlyRoot: false,
  dropCapabilities: true,
  noHostNetwork: true,
};

const DEFAULT_OPTIONS: TerminalOptions = {
  shell: '/bin/bash',
  cols: 80,
  rows: 24,
  workingDir: '',
  envVars: [],
  sandbox: { ...DEFAULT_SANDBOX_OPTIONS },
};

const SHELL_OPTIONS = [
  { value: '/bin/bash', label: 'Bash (/bin/bash)' },
  { value: '/bin/zsh', label: 'Zsh (/bin/zsh)' },
  { value: '/bin/sh', label: 'Sh (/bin/sh)' },
  { value: '/usr/bin/fish', label: 'Fish (/usr/bin/fish)' },
];

export function TerminalTabs({ initialNodeId, className = '' }: TerminalTabsProps) {
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [availableNodes, setAvailableNodes] = useState<Array<{ id: string; hostname: string }>>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [options, setOptions] = useState<TerminalOptions>(DEFAULT_OPTIONS);

  // Load available nodes
  useEffect(() => {
    fetch('/api/v1/nodes')
      .then((res) => res.json())
      .then((data) => {
        const nodes = data.all_nodes
          ?.filter((n: any) => data.connected?.includes(n.id))
          .map((n: any) => ({ id: n.id, hostname: n.hostname })) || [];
        setAvailableNodes(nodes);
      })
      .catch(console.error);
  }, []);

  // Create initial session if initialNodeId provided
  useEffect(() => {
    if (initialNodeId && sessions.length === 0) {
      createSession(initialNodeId);
    }
  }, [initialNodeId]);

  const createSession = useCallback(async (nodeId: string, opts?: Partial<TerminalOptions>) => {
    const sessionOpts: Parameters<typeof nodeTerminalService.createSession>[1] = {
      shell: opts?.shell || options.shell,
      cols: opts?.cols || options.cols,
      rows: opts?.rows || options.rows,
      workingDir: opts?.workingDir || options.workingDir || undefined,
      env: opts?.envVars || options.envVars
        ? Object.fromEntries((opts?.envVars || options.envVars).filter(e => e.key).map(e => [e.key, e.value]))
        : undefined,
    };

    // Add sandbox configuration if enabled
    const sandbox = opts?.sandbox || options.sandbox;
    if (sandbox?.enabled) {
      sessionOpts.sandbox = {
        image: sandbox.image,
        cpus: sandbox.cpus,
        memory_mb: sandbox.memoryMb,
        volumes: sandbox.volumes,
        read_only_root: sandbox.readOnlyRoot,
        drop_capabilities: sandbox.dropCapabilities,
        no_host_network: sandbox.noHostNetwork,
      };
    }

    const session = await nodeTerminalService.createSession(nodeId, sessionOpts);
    if (session) {
      setSessions((prev) => [...prev, session]);
      setActiveSessionId(session.id);
    }
    return session;
  }, [options]);

  const closeSession = useCallback((sessionId: string) => {
    nodeTerminalService.closeSession(sessionId);
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      // Switch to another session if this was active
      if (activeSessionId === sessionId && filtered.length > 0) {
        setActiveSessionId(filtered[filtered.length - 1].id);
      } else if (filtered.length === 0) {
        setActiveSessionId(null);
      }
      return filtered;
    });
  }, [activeSessionId]);

  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  const handleCreateTerminal = useCallback(async () => {
    if (!selectedNodeId) return;
    
    await createSession(selectedNodeId, options);
    setShowNewDialog(false);
    setSelectedNodeId(null);
    setOptions(DEFAULT_OPTIONS);
    setShowAdvanced(false);
  }, [selectedNodeId, options, createSession]);

  const addEnvVar = useCallback(() => {
    setOptions((prev) => ({
      ...prev,
      envVars: [...prev.envVars, { key: '', value: '' }],
    }));
  }, []);

  const updateEnvVar = useCallback((index: number, field: 'key' | 'value', value: string) => {
    setOptions((prev) => ({
      ...prev,
      envVars: prev.envVars.map((v, i) => (i === index ? { ...v, [field]: value } : v)),
    }));
  }, []);

  const removeEnvVar = useCallback((index: number) => {
    setOptions((prev) => ({
      ...prev,
      envVars: prev.envVars.filter((_, i) => i !== index),
    }));
  }, []);

  // Sandbox volume mount handlers
  const addVolumeMount = useCallback(() => {
    setOptions((prev) => ({
      ...prev,
      sandbox: {
        ...prev.sandbox,
        volumes: [...prev.sandbox.volumes, { source: '', target: '', readOnly: false }],
      },
    }));
  }, []);

  const updateVolumeMount = useCallback((index: number, field: keyof VolumeMount, value: string | boolean) => {
    setOptions((prev) => ({
      ...prev,
      sandbox: {
        ...prev.sandbox,
        volumes: prev.sandbox.volumes.map((v, i) => (i === index ? { ...v, [field]: value } : v)),
      },
    }));
  }, []);

  const removeVolumeMount = useCallback((index: number) => {
    setOptions((prev) => ({
      ...prev,
      sandbox: {
        ...prev.sandbox,
        volumes: prev.sandbox.volumes.filter((_, i) => i !== index),
      },
    }));
  }, []);

  // Close all sessions on unmount
  useEffect(() => {
    return () => {
      sessions.forEach((session) => {
        nodeTerminalService.closeSession(session.id);
      });
    };
  }, []);

  if (sessions.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-full ${className}`}>
        <Terminal className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Active Terminals</h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
          Open a terminal to connect to a node's shell.
        </p>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Terminal
        </Button>

        <NewTerminalDialog
          open={showNewDialog}
          onClose={() => {
            setShowNewDialog(false);
            setSelectedNodeId(null);
            setOptions(DEFAULT_OPTIONS);
            setShowAdvanced(false);
          }}
          nodes={availableNodes}
          selectedNodeId={selectedNodeId}
          onSelect={handleNodeSelect}
          options={options}
          setOptions={setOptions}
          showAdvanced={showAdvanced}
          setShowAdvanced={setShowAdvanced}
          addEnvVar={addEnvVar}
          updateEnvVar={updateEnvVar}
          removeEnvVar={removeEnvVar}
          onCreate={handleCreateTerminal}
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Tab bar */}
      <div className="flex items-center gap-2 px-2 py-1 bg-muted border-b">
        <div className="flex-1 flex gap-1 overflow-x-auto">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => setActiveSessionId(session.id)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors ${
                activeSessionId === session.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  nodeTerminalService.isConnected(session.id)
                    ? 'bg-green-500'
                    : 'bg-red-500'
                }`}
              />
              <span className="max-w-[120px] truncate">
                {session.nodeId.slice(0, 8)}...
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeSession(session.id);
                }}
                className="ml-1 p-0.5 hover:bg-muted-foreground/20 rounded"
              >
                <X className="h-3 w-3" />
              </button>
            </button>
          ))}
        </div>

        <button
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
          onClick={() => setShowNewDialog(true)}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Terminal panels */}
      <div className="flex-1 relative">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`absolute inset-0 ${
              activeSessionId === session.id ? 'visible' : 'invisible'
            }`}
          >
            <NodeTerminal
              session={session}
              onClose={() => closeSession(session.id)}
            />
          </div>
        ))}
      </div>

      <NewTerminalDialog
        open={showNewDialog}
        onClose={() => {
          setShowNewDialog(false);
          setSelectedNodeId(null);
          setOptions(DEFAULT_OPTIONS);
          setShowAdvanced(false);
        }}
        nodes={availableNodes}
        selectedNodeId={selectedNodeId}
        onSelect={handleNodeSelect}
        options={options}
        setOptions={setOptions}
        showAdvanced={showAdvanced}
        setShowAdvanced={setShowAdvanced}
        addEnvVar={addEnvVar}
        updateEnvVar={updateEnvVar}
        removeEnvVar={removeEnvVar}
        onCreate={handleCreateTerminal}
        addVolumeMount={addVolumeMount}
        updateVolumeMount={updateVolumeMount}
        removeVolumeMount={removeVolumeMount}
      />
    </div>
  );
}

interface NewTerminalDialogProps {
  open: boolean;
  onClose: () => void;
  nodes: Array<{ id: string; hostname: string }>;
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
  options: TerminalOptions;
  setOptions: (opts: TerminalOptions | ((prev: TerminalOptions) => TerminalOptions)) => void;
  showAdvanced: boolean;
  setShowAdvanced: (show: boolean) => void;
  addEnvVar: () => void;
  updateEnvVar: (index: number, field: 'key' | 'value', value: string) => void;
  removeEnvVar: (index: number) => void;
  onCreate: () => void;
  addVolumeMount?: () => void;
  updateVolumeMount?: (index: number, field: keyof VolumeMount, value: string | boolean) => void;
  removeVolumeMount?: (index: number) => void;
}

function NewTerminalDialog({
  open,
  onClose,
  nodes,
  selectedNodeId,
  onSelect,
  options,
  setOptions,
  showAdvanced,
  setShowAdvanced,
  addEnvVar,
  updateEnvVar,
  removeEnvVar,
  onCreate,
  addVolumeMount,
  updateVolumeMount,
  removeVolumeMount,
}: NewTerminalDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Terminal Session</DialogTitle>
          <DialogDescription>
            Select a node and configure terminal options.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Node Selection */}
          <div className="space-y-2">
            <Label>Node</Label>
            {nodes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No online nodes available. Connect a node first.
              </p>
            ) : (
              <div className="grid gap-2">
                {nodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => onSelect(node.id)}
                    className={`flex items-center justify-between p-3 rounded-md border transition-colors text-left ${
                      selectedNodeId === node.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-sm">{node.hostname}</p>
                      <p className="text-xs text-muted-foreground">{node.id}</p>
                    </div>
                    {selectedNodeId === node.id && (
                      <div className="w-4 h-4 rounded-full bg-primary" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Basic Options */}
          <div className="space-y-2">
            <Label htmlFor="shell">Shell</Label>
            <Select
              value={options.shell}
              onValueChange={(value) =>
                setOptions((prev) => ({ ...prev, shell: value }))
              }
            >
              <SelectTrigger id="shell">
                <SelectValue placeholder="Select shell" />
              </SelectTrigger>
              <SelectContent>
                {SHELL_OPTIONS.map((shell) => (
                  <SelectItem key={shell.value} value={shell.value}>
                    {shell.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Advanced Options Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings2 className="h-4 w-4" />
            Advanced Options
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-4 pt-2 border-t">
              {/* Working Directory */}
              <div className="space-y-2">
                <Label htmlFor="workingDir">Working Directory</Label>
                <Input
                  id="workingDir"
                  placeholder="/home/user (optional)"
                  value={options.workingDir}
                  onChange={(e) =>
                    setOptions((prev) => ({ ...prev, workingDir: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Directory where the shell will start. Leave empty for default.
                </p>
              </div>

              {/* Environment Variables */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Environment Variables</Label>
                  <button
                    onClick={addEnvVar}
                    className="text-xs text-primary hover:underline"
                  >
                    + Add Variable
                  </button>
                </div>
                <div className="space-y-2">
                  {options.envVars.map((envVar, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="KEY"
                        value={envVar.key}
                        onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="value"
                        value={envVar.value}
                        onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                        className="flex-1"
                      />
                      <button
                        onClick={() => removeEnvVar(index)}
                        className="p-2 hover:bg-muted rounded"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {options.envVars.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No environment variables set.
                    </p>
                  )}
                </div>
              </div>

              {/* Terminal Size */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cols">Columns</Label>
                  <Input
                    id="cols"
                    type="number"
                    min={40}
                    max={300}
                    value={options.cols}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        cols: parseInt(e.target.value) || 80,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rows">Rows</Label>
                  <Input
                    id="rows"
                    type="number"
                    min={10}
                    max={100}
                    value={options.rows}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        rows: parseInt(e.target.value) || 24,
                      }))
                    }
                  />
                </div>
              </div>

              {/* Sandbox Mode */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Container className="h-4 w-4 text-primary" />
                  <Label className="font-medium">Sandbox Mode</Label>
                </div>
                
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="sandbox-enabled"
                    checked={options.sandbox.enabled}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({
                        ...prev,
                        sandbox: { ...prev.sandbox, enabled: checked === true },
                      }))
                    }
                  />
                  <Label htmlFor="sandbox-enabled" className="text-sm cursor-pointer">
                    Run terminal in Docker container (sandboxed)
                  </Label>
                </div>

                {options.sandbox.enabled && (
                  <div className="space-y-4 pl-6 border-l-2 border-primary/20">
                    {/* Docker Image */}
                    <div className="space-y-2">
                      <Label htmlFor="sandbox-image">Docker Image</Label>
                      <Input
                        id="sandbox-image"
                        placeholder="alpine:latest"
                        value={options.sandbox.image}
                        onChange={(e) =>
                          setOptions((prev) => ({
                            ...prev,
                            sandbox: { ...prev.sandbox, image: e.target.value },
                          }))
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Container image to use for the terminal session
                      </p>
                    </div>

                    {/* Resource Limits */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="sandbox-cpus">CPU Limit (cores)</Label>
                        <Input
                          id="sandbox-cpus"
                          type="number"
                          min={0.1}
                          max={16}
                          step={0.1}
                          value={options.sandbox.cpus}
                          onChange={(e) =>
                            setOptions((prev) => ({
                              ...prev,
                              sandbox: { ...prev.sandbox, cpus: parseFloat(e.target.value) || 1 },
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sandbox-memory">Memory Limit (MB)</Label>
                        <Input
                          id="sandbox-memory"
                          type="number"
                          min={64}
                          max={32768}
                          step={64}
                          value={options.sandbox.memoryMb}
                          onChange={(e) =>
                            setOptions((prev) => ({
                              ...prev,
                              sandbox: { ...prev.sandbox, memoryMb: parseInt(e.target.value) || 512 },
                            }))
                          }
                        />
                      </div>
                    </div>

                    {/* Volume Mounts */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Volume Mounts</Label>
                        <button
                          onClick={addVolumeMount}
                          className="text-xs text-primary hover:underline"
                        >
                          + Add Volume
                        </button>
                      </div>
                      <div className="space-y-2">
                        {options.sandbox.volumes.map((vol, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <Input
                              placeholder="Host path"
                              value={vol.source}
                              onChange={(e) => updateVolumeMount?.(index, 'source', e.target.value)}
                              className="flex-1"
                            />
                            <span className="text-muted-foreground">:</span>
                            <Input
                              placeholder="Container path"
                              value={vol.target}
                              onChange={(e) => updateVolumeMount?.(index, 'target', e.target.value)}
                              className="flex-1"
                            />
                            <div className="flex items-center gap-2 px-2">
                              <Checkbox
                                id={`vol-readonly-${index}`}
                                checked={vol.readOnly}
                                onCheckedChange={(checked) =>
                                  updateVolumeMount?.(index, 'readOnly', checked === true)
                                }
                              />
                              <Label htmlFor={`vol-readonly-${index}`} className="text-xs cursor-pointer whitespace-nowrap">
                                RO
                              </Label>
                            </div>
                            <button
                              onClick={() => removeVolumeMount?.(index)}
                              className="p-2 hover:bg-muted rounded"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        {options.sandbox.volumes.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            No volume mounts configured.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Security Options */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <Label className="text-sm font-medium">Security Options</Label>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id="sandbox-readonly"
                            checked={options.sandbox.readOnlyRoot}
                            onCheckedChange={(checked) =>
                              setOptions((prev) => ({
                                ...prev,
                                sandbox: { ...prev.sandbox, readOnlyRoot: checked === true },
                              }))
                            }
                          />
                          <Label htmlFor="sandbox-readonly" className="text-sm cursor-pointer">
                            Read-only root filesystem
                          </Label>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id="sandbox-drop-caps"
                            checked={options.sandbox.dropCapabilities}
                            onCheckedChange={(checked) =>
                              setOptions((prev) => ({
                                ...prev,
                                sandbox: { ...prev.sandbox, dropCapabilities: checked === true },
                              }))
                            }
                          />
                          <Label htmlFor="sandbox-drop-caps" className="text-sm cursor-pointer">
                            Drop all Linux capabilities
                          </Label>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id="sandbox-no-network"
                            checked={options.sandbox.noHostNetwork}
                            onCheckedChange={(checked) =>
                              setOptions((prev) => ({
                                ...prev,
                                sandbox: { ...prev.sandbox, noHostNetwork: checked === true },
                              }))
                            }
                          />
                          <Label htmlFor="sandbox-no-network" className="text-sm cursor-pointer">
                            Disable host network access
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onCreate} disabled={!selectedNodeId}>
            <Terminal className="h-4 w-4 mr-2" />
            Create Terminal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
