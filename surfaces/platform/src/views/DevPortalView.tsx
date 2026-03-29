'use client';

import React from 'react';
import DevPortalApp from '../dev-portal/src/App';
import '../dev-portal/src/styles/index.css';
import type { ViewContext } from '@/nav/nav.types';

interface DevPortalViewProps {
  context: ViewContext;
}

export function DevPortalView({ context }: DevPortalViewProps) {
  return (
    <div className="h-full w-full overflow-auto">
      <DevPortalApp />
    </div>
  );
}

export default DevPortalView;
