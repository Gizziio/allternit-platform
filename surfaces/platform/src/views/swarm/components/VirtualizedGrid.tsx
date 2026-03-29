/**
 * VirtualizedGrid - High-performance grid for 100+ agents
 * 
 * Uses CSS Grid with windowing to only render visible items.
 * Falls back to regular GridView for smaller datasets (< 50 agents).
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { TEXT } from '@/design/a2r.tokens';
import type { SwarmAgent } from '../types';
import { AgentCard } from './AgentCard';
import { useBatchSelection } from '../SwarmMonitor.store';

interface VirtualizedGridProps {
  agents: SwarmAgent[];
  modeColors: { accent: string };
  onAgentSelect: (agentId: string) => void;
  overscan?: number;
}

// Threshold to enable virtualization
const VIRTUALIZATION_THRESHOLD = 50;

// Item dimensions (must match CSS)
const ITEM_HEIGHT = 180;
const ITEM_GAP = 16;
const TOTAL_ITEM_HEIGHT = ITEM_HEIGHT + ITEM_GAP;

export function VirtualizedGrid({ 
  agents, 
  modeColors, 
  onAgentSelect,
  overscan = 3 
}: VirtualizedGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [columns, setColumns] = useState(4);
  
  const { isBatchMode, selectedIds, toggleAgent } = useBatchSelection();

  // Measure container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
        
        // Calculate columns based on width
        const width = entry.contentRect.width;
        if (width < 600) setColumns(1);
        else if (width < 900) setColumns(2);
        else if (width < 1200) setColumns(3);
        else if (width < 1500) setColumns(4);
        else setColumns(5);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Handle scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Calculate visible range
  const { visibleStart, visibleEnd, totalHeight } = useMemo(() => {
    const totalRows = Math.ceil(agents.length / columns);
    const startRow = Math.floor(scrollTop / TOTAL_ITEM_HEIGHT);
    const visibleRows = Math.ceil(containerHeight / TOTAL_ITEM_HEIGHT);
    
    const visibleStart = Math.max(0, (startRow - overscan) * columns);
    const visibleEnd = Math.min(
      agents.length,
      (startRow + visibleRows + overscan) * columns
    );
    
    const totalHeight = totalRows * TOTAL_ITEM_HEIGHT;
    
    return { visibleStart, visibleEnd, totalHeight };
  }, [agents.length, columns, containerHeight, scrollTop, overscan]);

  // Get visible agents
  const visibleAgents = useMemo(() => {
    return agents.slice(visibleStart, visibleEnd);
  }, [agents, visibleStart, visibleEnd]);

  // Calculate offset for visible items
  const topOffset = Math.floor(visibleStart / columns) * TOTAL_ITEM_HEIGHT;

  // Render placeholder for small datasets
  if (agents.length < VIRTUALIZATION_THRESHOLD) {
    return (
      <div className="h-full p-6 overflow-auto">
        <div 
          className="grid gap-4"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gridAutoRows: `${ITEM_HEIGHT}px`,
          }}
        >
          {agents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              modeColors={modeColors}
              onClick={() => onAgentSelect(agent.id)}
              className={agent.role === 'orchestrator' ? 'col-span-2 row-span-2' : ''}
              isSelected={selectedIds.has(agent.id)}
              isBatchMode={isBatchMode}
              onToggleSelect={() => toggleAgent(agent.id)}
            />
          ))}
        </div>
        {agents.length === 0 && (
          <div className="h-full flex items-center justify-center" style={{ color: TEXT.secondary }}>
            No agents to display
          </div>
        )}
      </div>
    );
  }

  // Render virtualized grid
  return (
    <div 
      ref={containerRef}
      className="h-full p-6 overflow-auto"
      style={{ scrollBehavior: 'smooth' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div 
          className="grid gap-4 absolute inset-x-0"
          style={{
            top: topOffset,
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gridAutoRows: `${ITEM_HEIGHT}px`,
          }}
        >
          {visibleAgents.map((agent, index) => {
            const actualIndex = visibleStart + index;
            const isOrchestrator = agent.role === 'orchestrator';
            const isSelected = selectedIds.has(agent.id);
            
            // Calculate grid positioning for orchestrators
            const row = Math.floor(actualIndex / columns);
            const col = actualIndex % columns;
            const isLastCol = col === columns - 1;
            
            // Don't render orchestrator if it would overflow
            if (isOrchestrator && (isLastCol || actualIndex + columns >= agents.length)) {
              return (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  modeColors={modeColors}
                  onClick={() => onAgentSelect(agent.id)}
                  isSelected={isSelected}
                  isBatchMode={isBatchMode}
                  onToggleSelect={() => toggleAgent(agent.id)}
                />
              );
            }
            
            return (
              <AgentCard
                key={agent.id}
                agent={agent}
                modeColors={modeColors}
                onClick={() => onAgentSelect(agent.id)}
                className={isOrchestrator ? 'col-span-2 row-span-2' : ''}
                isSelected={isSelected}
                isBatchMode={isBatchMode}
                onToggleSelect={() => toggleAgent(agent.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
