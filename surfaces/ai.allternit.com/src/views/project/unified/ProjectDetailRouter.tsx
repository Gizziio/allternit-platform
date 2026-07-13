"use client";

import React from 'react';
import type { UnifiedProject } from './types';
import { ChatProjectDetail } from '@/views/project/chat/ChatProjectDetail';
import { CoworkProjectView } from '@/views/cowork/CoworkProjectView';
import { CodeProjectView } from '@/views/code/CodeProjectView';
import { DesignProjectView } from '@/views/project/design/DesignProjectView';

interface ProjectDetailRouterProps {
  project: UnifiedProject;
  onBack: () => void;
}

export function ProjectDetailRouter({ project, onBack }: ProjectDetailRouterProps) {
  switch (project.mode) {
    case 'chat':
      return <ChatProjectDetail projectId={project.nativeId} onBack={onBack} />;
    case 'cowork':
      return <CoworkProjectView projectId={project.nativeId} onBack={onBack} />;
    case 'code':
      return <CodeProjectView workspaceId={project.nativeId} onBack={onBack} />;
    case 'design':
      return <DesignProjectView projectId={project.nativeId} onBack={onBack} />;
    default:
      return null;
  }
}
