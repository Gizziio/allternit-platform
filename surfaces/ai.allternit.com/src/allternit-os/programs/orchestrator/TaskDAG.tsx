"use client";

import React, { useMemo } from 'react';
import type { OrchestratorState } from '../../types/programs';

interface TaskDAGProps {
  nodes: OrchestratorState['taskGraph']['nodes'];
  edges: OrchestratorState['taskGraph']['edges'];
  onNodeClick?: (nodeId: string) => void;
}

export const TaskDAG: React.FC<TaskDAGProps> = ({ nodes, onNodeClick }) => {
  const levels = useMemo(() => {
    const levelMap = new Map<string, number>();
    
    const getLevel = (nodeId: string): number => {
      if (levelMap.has(nodeId)) return levelMap.get(nodeId)!;
      
      const node = nodes.find(n => n.id === nodeId);
      if (!node || node.dependencies.length === 0) {
        levelMap.set(nodeId, 0);
        return 0;
      }
      
      const maxDepLevel = Math.max(...node.dependencies.map(getLevel));
      const level = maxDepLevel + 1;
      levelMap.set(nodeId, level);
      return level;
    };
    
    nodes.forEach(n => getLevel(n.id));
    
    const levels: string[][] = [];
    levelMap.forEach((level, nodeId) => {
      if (!levels[level]) levels[level] = [];
      levels[level].push(nodeId);
    });
    
    return levels;
  }, [nodes]);

  const statusColors = {
    pending: 'bg-zinc-200 dark:bg-zinc-700 border-zinc-300',
    running: 'bg-blue-100 dark:bg-blue-900/30 border-blue-400',
    completed: 'bg-green-100 dark:bg-green-900/30 border-green-400',
    error: 'bg-red-100 dark:bg-red-900/30 border-red-400',
  };

  const statusIcons = {
    pending: '⏳',
    running: '🔄',
    completed: '✅',
    error: '❌',
  };

  return (
    <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
      <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4">Task DAG</h4>
      
      <div className="space-y-4">
        {levels.map((levelNodes, levelIndex) => (
          <div key={`level-${levelIndex}`} className="flex items-center gap-4">
            <span className="text-xs text-zinc-400 w-8">L{levelIndex}</span>
            <div className="flex gap-3">
              {levelNodes.map(nodeId => {
                const node = nodes.find(n => n.id === nodeId);
                if (!node) return null;
                
                return (
                  <button type="button"
                    key={nodeId}
                    onClick={() => onNodeClick?.(nodeId)}
                    className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 transition-all hover:scale-105 ${
                      statusColors[node.status as keyof typeof statusColors] || statusColors.pending
                    }`}
                  >
                    <span>{statusIcons[node.status as keyof typeof statusIcons] || '⏳'}</span>
                    <span>{node.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex gap-4 text-xs">
        {Object.entries(statusColors).map(([status, colorClass]) => (
          <div key={status} className="flex items-center gap-1">
            <div className={`size-3  rounded ${colorClass.split(' ')[0]}`} />
            <span className="capitalize">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
