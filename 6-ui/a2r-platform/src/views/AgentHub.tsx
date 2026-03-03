/**
 * Agent Hub - Consolidated Agent Management View
 * 
 * Combines Studio, Registry, Sessions, and Memory into one view
 * with a minimal toggle for switching between them.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Paintbrush,
  Globe,
  MessageSquareText,
  Brain,
  Plus,
  Search,
  MoreHorizontal,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { AgentView } from './AgentView';
import { SkillsRegistryView } from './code/SkillsRegistryView';
import { useNativeAgentStore } from '../lib/agents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type AgentTab = 'studio' | 'registry' | 'sessions' | 'memory';

const TABS = [
  { id: 'studio' as AgentTab, label: 'Agent Studio', icon: Paintbrush },
  { id: 'registry' as AgentTab, label: 'Browse Registry', icon: Globe },
  { id: 'sessions' as AgentTab, label: 'Sessions', icon: MessageSquareText },
  { id: 'memory' as AgentTab, label: 'Memory', icon: Brain },
] as const;

export function AgentHub() {
  const [activeTab, setActiveTab] = useState<AgentTab>('studio');
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const sessions = useNativeAgentStore((state) => state.sessions);

  const activeTabInfo = TABS.find(t => t.id === activeTab) || TABS[0];
  const ActiveIcon = activeTabInfo.icon;

  const renderContent = () => {
    switch (activeTab) {
      case 'studio':
        return <AgentView context={{ viewType: 'agent', viewId: 'agent' }} />;
      case 'registry':
        return (
          <div className="p-8 h-full overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Agent Registry</h2>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search agents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Install
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-6 rounded-lg border border-border bg-card">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Brain className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">Code Assistant</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Specialized in code generation and review
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  Install
                </Button>
              </div>
              <div className="p-6 rounded-lg border border-border bg-card">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Globe className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">Web Researcher</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Browses and synthesizes web information
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  Install
                </Button>
              </div>
              <div className="p-6 rounded-lg border border-border bg-card">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <MessageSquareText className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">Chat Companion</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  General purpose conversational agent
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  Install
                </Button>
              </div>
            </div>
          </div>
        );
      case 'sessions':
        return (
          <div className="p-8 h-full overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Agent Sessions</h2>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Session
              </Button>
            </div>
            {sessions.length > 0 ? (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <MessageSquareText className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">{session.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {session.agentName || 'No agent'} • {session.originSurface}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquareText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No sessions yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first agent session to get started
                </p>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Session
                </Button>
              </div>
            )}
          </div>
        );
      case 'memory':
        return <SkillsRegistryView />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-background relative">
      {/* Floating Toggle Button - Top Right */}
      <div className="absolute top-3 right-4 z-50">
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-card border border-border hover:bg-accent/50 transition-colors text-sm"
          >
            <ActiveIcon className="w-4 h-4" />
            <span className="font-medium">{activeTabInfo.label}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          <AnimatePresence>
            {showDropdown && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40"
                  onClick={() => setShowDropdown(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full right-0 mt-1 w-48 bg-card border border-border rounded-md shadow-lg z-50 overflow-hidden"
                >
                  {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          setShowDropdown(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                          isActive 
                            ? 'bg-primary/10 text-primary' 
                            : 'hover:bg-accent text-foreground'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Content Area - Full Height */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full w-full"
          >
            {renderContent()}
        </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default AgentHub;
