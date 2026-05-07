"use client";

import React, { useState } from 'react';
import {
  GitBranch,
  Square,
  ArrowCounterClockwise,
  Clock,
  CheckCircle,
  XCircle,
  CircleNotch,
  CaretRight,
} from '@phosphor-icons/react';
import { StatusBadge } from '../components/StatusBadge';
import { ProgressBar } from '../components/ProgressBar';

interface ExecutionNode {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  start_time?: string;
  end_time?: string;
  logs: string[];
}

interface Execution {
  id: string;
  workflow_id: string;
  workflow_name: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  start_time: string;
  end_time?: string;
  progress: number;
  nodes: ExecutionNode[];
}

export function WorkflowMonitorView() {
  const [execution] = useState<Execution>({
    id: 'exec-2024-001',
    workflow_id: 'wf-1',
    workflow_name: 'CI/CD Pipeline',
    status: 'running',
    start_time: new Date(Date.now() - 300000).toISOString(),
    progress: 60,
    nodes: [
      { id: 'n1', name: 'Checkout Code', status: 'completed', start_time: new Date(Date.now() - 300000).toISOString(), end_time: new Date(Date.now() - 290000).toISOString(), logs: ['Cloning repository...', 'Checked out main branch'] },
      { id: 'n2', name: 'Install Dependencies', status: 'completed', start_time: new Date(Date.now() - 290000).toISOString(), end_time: new Date(Date.now() - 260000).toISOString(), logs: ['Installing npm packages...', 'Installed 245 packages'] },
      { id: 'n3', name: 'Run Tests', status: 'running', start_time: new Date(Date.now() - 260000).toISOString(), logs: ['Running jest...', 'Test suite started', '✓ 45 tests passing'] },
      { id: 'n4', name: 'Build Application', status: 'pending', logs: [] },
      { id: 'n5', name: 'Deploy', status: 'pending', logs: [] },
    ],
  });
  const [selectedNode, setSelectedNode] = useState<string>('n3');
  const [activeTab, setActiveTab] = useState<'overview' | 'logs'>('overview');

  const selectedNodeData = execution.nodes.find(n => n.id === selectedNode);

  const elapsedTime = () => {
    const start = new Date(execution.start_time).getTime();
    const end = execution.end_time ? new Date(execution.end_time).getTime() : Date.now();
    const diff = Math.floor((end - start) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-16 border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="font-medium flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-accent" />
                {execution.workflow_name}
              </h2>
              <p className="text-xs text-muted-foreground">
                Execution {execution.id} • Started {new Date(execution.start_time).toLocaleString()}
              </p>
            </div>
            <StatusBadge 
              status={execution.status === 'running' ? 'running' : execution.status === 'completed' ? 'completed' : 'failed'} 
            />
          </div>
          <div className="flex items-center gap-2">
            {execution.status === 'running' ? (
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
                <Square size={16} />
                Stop
              </button>
            ) : (
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-accent/20 text-accent hover:bg-accent/30 transition-colors">
                <ArrowCounterClockwise size={16} />
                Restart
              </button>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Execution Progress</span>
            <span className="text-sm text-muted-foreground">{execution.progress}%</span>
          </div>
          <ProgressBar value={execution.progress} size="sm" showPercentage={false} />
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              Elapsed: {elapsedTime()}
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-500" />
              {execution.nodes.filter(n => n.status === 'completed').length} completed
            </span>
            <span className="flex items-center gap-1">
              <CircleNotch className="w-3 h-3 text-blue-500" />
              {execution.nodes.filter(n => n.status === 'running').length} running
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {execution.nodes.filter(n => n.status === 'pending').length} pending
            </span>
          </div>
        </div>

        {/* DAG Visualization */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="flex items-center gap-4">
            {execution.nodes.map((node, idx) => (
              <React.Fragment key={node.id}>
                <button
                  onClick={() => setSelectedNode(node.id)}
                  className={`relative p-4 rounded-lg border min-w-[140px] transition-all ${
                    selectedNode === node.id
                      ? 'border-accent bg-accent/10'
                      : node.status === 'completed'
                      ? 'border-green-500/30 bg-green-500/5'
                      : node.status === 'failed'
                      ? 'border-red-500/30 bg-red-500/5'
                      : node.status === 'running'
                      ? 'border-blue-500/30 bg-blue-500/5'
                      : 'border-border bg-primary'
                  }`}
                >
                  <div className="flex items-center justify-center mb-2">
                    {node.status === 'completed' && <CheckCircle className="w-6 h-6 text-green-500" />}
                    {node.status === 'failed' && <XCircle className="w-6 h-6 text-red-500" />}
                    {node.status === 'running' && <CircleNotch className="w-6 h-6 text-blue-500 animate-spin" />}
                    {node.status === 'pending' && <Clock className="w-6 h-6 text-muted-foreground" />}
                  </div>
                  <p className="text-sm font-medium text-center">{node.name}</p>
                  <p className="text-xs text-muted-foreground text-center mt-1 capitalize">{node.status}</p>
                </button>
                {idx < execution.nodes.length - 1 && (
                  <CaretRight className="w-5 h-5 text-muted-foreground" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 border-l border-border bg-secondary/20 flex flex-col">
        <div className="flex border-b border-border">
          {(['overview', 'logs'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          {activeTab === 'overview' && selectedNodeData && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">{selectedNodeData.name}</h4>
                <StatusBadge status={selectedNodeData.status} />
              </div>
              
              {selectedNodeData.start_time && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Start Time</p>
                  <p className="text-sm">{new Date(selectedNodeData.start_time).toLocaleString()}</p>
                </div>
              )}
              
              {selectedNodeData.end_time && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">End Time</p>
                  <p className="text-sm">{new Date(selectedNodeData.end_time).toLocaleString()}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground mb-1">Node ID</p>
                <code className="text-xs bg-secondary px-2 py-1 rounded">{selectedNodeData.id}</code>
              </div>
            </div>
          )}

          {activeTab === 'logs' && selectedNodeData && (
            <div className="space-y-2">
              {selectedNodeData.logs.length > 0 ? (
                selectedNodeData.logs.map((log, idx) => (
                  <div key={idx} className="text-xs font-mono p-2 rounded bg-primary border border-border">
                    <span className="text-muted-foreground">[{new Date().toLocaleTimeString()}]</span>{' '}
                    <span>{log}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No logs available</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
