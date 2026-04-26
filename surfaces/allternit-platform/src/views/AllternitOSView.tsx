/**
 * AllternitOS View
 * 
 * Main view for the allternit Super-Agent OS.
 * Integrated into the Shell UI as a first-class view.
 * 
 * Features:
 * - Program Launcher with all 8 program types
 * - Allternit Console with real multi-session terminal
 * - Chat-to-Program integration
 * - Real-time agent status and task management
 */

'use client';

import React, { useState, useCallback } from 'react';
import { AllternitOSProvider } from '../allternit-os';
import { AllternitConsole, AllternitConsoleToggle } from '../allternit-os/components/AllternitConsole';
import {
  Cpu,
  FileText,
  Table,
  Presentation,
  Code,
  FolderOpen,
  Graph,
  Globe,
  Terminal,
  SquaresFour,
  Chat,
  X,
  Play,
  GearSix,
  Pulse as Activity,
  GraduationCap,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ViewContext } from '@/nav/nav.types';

// Program definitions
const programsList = [
  { id: 'researchdoc', name: 'ResearchDoc', desc: 'Rich documents with citations', icon: FileText, color: 'bg-blue-500' },
  { id: 'datagrid', name: 'DataGrid', desc: 'Spreadsheet with formulas', icon: Table, color: 'bg-green-500' },
  { id: 'presentation', name: 'Presentation', desc: 'Slides with presenter notes', icon: Presentation, color: 'bg-orange-500' },
  { id: 'codepreview', name: 'CodePreview', desc: 'Multi-file code browser', icon: Code, color: 'bg-purple-500' },
  { id: 'assetmanager', name: 'AssetManager', desc: 'Image & file management', icon: FolderOpen, color: 'bg-pink-500' },
  { id: 'orchestrator', name: 'Orchestrator', desc: 'MoA execution dashboard', icon: Cpu, color: 'bg-red-500' },
  { id: 'workflowbuilder', name: 'WorkflowBuilder', desc: 'Visual DAG builder', icon: Graph, color: 'bg-cyan-500' },
  { id: 'browser', name: 'Browser', desc: 'Web citations with screenshots', icon: Globe, color: 'bg-indigo-500' },
  { id: 'labs', name: 'A://Labs', desc: '7 live AI learning tracks', icon: GraduationCap, color: 'bg-violet-500' },
];

interface AllternitOSViewProps {
  context: ViewContext;
}

export function AllternitOSView({ context }: AllternitOSViewProps) {
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'launcher' | 'active' | 'chat'>('launcher');
  const [activePrograms, setActivePrograms] = useState<Array<{ id: string; type: string; title: string }>>([]);

  const launchProgram = useCallback((programId: string) => {
    if (programId === 'labs') {
      window.dispatchEvent(new CustomEvent('allternit:open-labs'));
      return;
    }

    const programDef = programsList.find(p => p.id === programId);
    if (!programDef) return;
    
    const newProgram = {
      id: `${programId}-${Date.now()}`,
      type: programId,
      title: `${programDef.name} ${activePrograms.filter(p => p.type === programId).length + 1}`,
    };
    setActivePrograms(prev => [...prev, newProgram]);
    setActiveTab('active');
  }, [activePrograms]);

  return (
    <AllternitOSProvider config={{ kernelEndpoint: 'ws://localhost:3001/cable' }}>
      <div className="h-full flex flex-col bg-background">
        {/* Header */}
        <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <SquaresFour className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-sm">AllternitOS</h1>
              <p className="text-xs text-muted-foreground">Super-Agent OS</p>
            </div>
            <Badge variant="outline" className="text-xs ml-2">Production</Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant={activeTab === 'launcher' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setActiveTab('launcher')}
              className="gap-2"
            >
              <SquaresFour size={16} />
              Launcher
            </Button>
            <Button 
              variant={activeTab === 'active' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setActiveTab('active')}
              className="gap-2"
            >
              <Play size={16} />
              Active
              {activePrograms.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{activePrograms.length}</Badge>
              )}
            </Button>
            <Button 
              variant={activeTab === 'chat' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setActiveTab('chat')}
              className="gap-2"
            >
              <Chat size={16} />
              Chat
            </Button>
            <div className="w-px h-6 bg-border mx-2" />
            <Button
              variant={consoleOpen ? 'default' : 'outline'}
              size="sm"
              onClick={() => setConsoleOpen(!consoleOpen)}
              className="gap-2"
            >
              <Terminal size={16} />
              Console
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Program Dock Sidebar */}
          <aside className="w-16 border-r bg-card flex flex-col items-center py-4 gap-2 shrink-0">
            {programsList.map((program) => (
              <button
                key={program.id}
                onClick={() => launchProgram(program.id)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-white hover:scale-105 transition-transform ${program.color}`}
                title={program.name}
              >
                <program.icon size={16} />
              </button>
            ))}
          </aside>

          {/* Content Area */}
          <main className="flex-1 overflow-hidden">
            {activeTab === 'launcher' && (
              <ProgramLauncher onLaunch={launchProgram} />
            )}
            {activeTab === 'active' && (
              <ActivePrograms programs={activePrograms} />
            )}
            {activeTab === 'chat' && (
              <ChatIntegration />
            )}
          </main>

          {/* Console Panel */}
          {consoleOpen && (
            <aside className="w-[500px] border-l bg-card flex flex-col shrink-0">
              <AllternitConsole isOpen={consoleOpen} onClose={() => setConsoleOpen(false)} />
            </aside>
          )}
        </div>

        {/* Footer Status */}
        <footer className="h-8 border-t bg-muted/50 flex items-center px-4 gap-4 text-xs shrink-0">
          <span className="flex items-center gap-1 text-green-600">
            <Activity size={12} />
            Kernel Connected
          </span>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">Rails Bridge Active</span>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">{programsList.length} Programs Available</span>
          <div className="flex-1" />
          <code className="text-muted-foreground">allternit://launch/{'{program}'}</code>
        </footer>
      </div>
    </AllternitOSProvider>
  );
}

// Program Launcher Component
function ProgramLauncher({ onLaunch }: { onLaunch: (id: string) => void }) {
  return (
    <div className="h-full p-6 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-2">Program Launcher</h2>
          <p className="text-muted-foreground">
            Launch specialized programs via URI scheme or click icons in the sidebar
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {programsList.map((program) => (
            <button
              key={program.id}
              onClick={() => onLaunch(program.id)}
              className="flex items-start gap-4 p-4 rounded-xl border bg-card hover:border-primary hover:shadow-md transition-all text-left"
            >
              <div className={`w-12 h-12 rounded-xl ${program.color} flex items-center justify-center text-white shrink-0`}>
                <program.icon size={20} />
              </div>
              <div>
                <h3 className="font-medium">{program.name}</h3>
                <p className="text-sm text-muted-foreground">{program.desc}</p>
                <code className="text-xs text-muted-foreground mt-2 block">
                  allternit://launch/{program.id}
                </code>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-8 p-4 rounded-lg bg-muted">
          <h3 className="font-medium mb-2">Quick Launch Commands</h3>
          <div className="flex flex-wrap gap-2">
            <code className="text-xs bg-background px-2 py-1 rounded">@researchdoc Quarterly Report</code>
            <code className="text-xs bg-background px-2 py-1 rounded">@datagrid sales_2024.csv</code>
            <code className="text-xs bg-background px-2 py-1 rounded">@presentation Q4 Review</code>
            <code className="text-xs bg-background px-2 py-1 rounded">@orchestrator Build Pipeline</code>
          </div>
        </div>
      </div>
    </div>
  );
}

// Active Programs Component
function ActivePrograms({ programs }: { programs: Array<{ id: string; type: string; title: string }> }) {
  if (programs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
        <SquaresFour className="w-12 h-12 mb-4 opacity-50" />
        <h3 className="text-lg font-medium mb-2">No Active Programs</h3>
        <p className="text-sm">Launch a program from the Launcher tab</p>
      </div>
    );
  }

  return (
    <div className="h-full p-6 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold mb-6">Active Programs</h2>
        <div className="space-y-3">
          {programs.map((activeProgram) => {
            const programDef = programsList.find(p => p.id === activeProgram.type);
            const Icon = programDef?.icon || FileText;
            return (
              <div 
                key={activeProgram.id}
                className="flex items-center gap-4 p-4 rounded-xl border bg-card"
              >
                <div className={`w-10 h-10 rounded-lg ${programDef?.color || 'bg-blue-500'} flex items-center justify-center text-white`}>
                  <Icon size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">{activeProgram.title}</h3>
                  <p className="text-xs text-muted-foreground capitalize">{activeProgram.type}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">Minimize</Button>
                  <Button variant="destructive" size="sm">Close</Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Chat Integration Component
function ChatIntegration() {
  return (
    <div className="h-full flex">
      {/* Chat Area */}
      <div className="flex-1 flex flex-col border-r">
        <div className="h-14 border-b flex items-center px-4">
          <h2 className="font-semibold">Agent Chat</h2>
        </div>
        <div className="flex-1 p-4 overflow-auto">
          <div className="space-y-4">
            <ChatMessage 
              sender="User" 
              content="Create a research document about AI agents" 
              isUser 
            />
            <ChatMessage 
              sender="Builder" 
              content="I'll create a research document for you. @researchdoc AI Agent Survey"
            />
            <ProgramPreviewCard 
              type="researchdoc" 
              title="AI Agent Survey" 
              status="Creating document..." 
            />
          </div>
        </div>
        <div className="h-16 border-t p-2">
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Type @ to launch a program..."
              className="flex-1 px-4 py-2 rounded-lg border bg-background"
            />
            <Button>Send</Button>
          </div>
        </div>
      </div>

      {/* Program Preview Sidebar */}
      <aside className="w-80 bg-muted/50 p-4">
        <h3 className="font-medium mb-4">Program Preview</h3>
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-card border">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-blue-500" />
              <span className="font-medium text-sm">ResearchDoc</span>
            </div>
            <p className="text-xs text-muted-foreground">AI Agent Survey</p>
            <div className="mt-2 h-20 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
              Document Preview
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

// Chat Message Component
function ChatMessage({ sender, content, isUser }: { sender: string; content: string; isUser?: boolean }) {
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
        isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
      }`}>
        {sender[0]}
      </div>
      <div className={`max-w-[70%] p-3 rounded-xl ${
        isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
      }`}>
        <div className="text-xs font-medium mb-1 opacity-70">{sender}</div>
        <div className="text-sm">{content}</div>
      </div>
    </div>
  );
}

// Program Preview Card Component
function ProgramPreviewCard({ type, title, status }: { type: string; title: string; status: string }) {
  return (
    <div className="ml-11 p-4 rounded-xl border bg-card max-w-md">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white">
          <FileText size={20} />
        </div>
        <div>
          <h4 className="font-medium">{title}</h4>
          <p className="text-xs text-muted-foreground capitalize">{type}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        {status}
      </div>
    </div>
  );
}

export default AllternitOSView;
