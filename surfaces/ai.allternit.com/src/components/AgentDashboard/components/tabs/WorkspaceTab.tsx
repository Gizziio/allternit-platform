
"use client"
import React from 'react';
import type { Agent } from '@/lib/agents/agent.types';
import { WorkspaceTab as OriginalWorkspaceTab } from '../../WorkspaceTab';

export const WorkspaceTab = ({ agent }: { agent: Agent }) => (
  <OriginalWorkspaceTab agent={agent} />
);
