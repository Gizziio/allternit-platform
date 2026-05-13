
"use client";

import { useIsClient } from '@/lib/hooks/use-is-client';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// Stores
import { useAgentStore } from '@/lib/agents/agent.store';

// Types
import type { Agent } from '@/lib/agents/agent.types';

// UI Components
import { DashboardHeader } from './components/DashboardHeader';
import { SidebarNavigation } from './components/SidebarNavigation';
import { TabContent } from './components/TabContent';

type TabId = 'overview' | 'runs' | 'tasks' | 'checkpoints' | 'tools' | 'comms' | 'monitoring' | 'environment' | 'swarm' | 'character' | 'workspace' | 'settings';

interface AgentDashboardProps {
  agentId: string;
  onClose?: () => void;
}

export function AgentDashboard({ agentId, onClose }: AgentDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const { agents, characterStats } = useAgentStore();
  const agent = agents.find(a => a.id === agentId);
  const stats = characterStats[agentId];

  if (!agent) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ duration: 0.2 }}
      className="mx-auto mt-[5vh] flex h-[90vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-studio-border-subtle bg-studio-card shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <DashboardHeader agent={agent} stats={stats} onClose={onClose} activeTab={activeTab} />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNavigation activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex-1 overflow-auto bg-studio-bg">
          <TabContent tabId={activeTab} agent={agent} stats={stats} />
        </div>
      </div>
    </motion.div>
  );
}
