import React from "react";
import { Handle, Position, NodeProps } from 'reactflow';
import { Warning, Cpu, Icon } from '@phosphor-icons/react';
import type { AgentNodeData } from '../types/SwarmOrchestrator.types';
import { ROLE_CONFIG } from '../SwarmOrchestrator.constants';
import { TEXT } from '@/design/allternit.tokens';
export const AgentNode: React.FC<NodeProps<AgentNodeData>> = ({
  data,
  selected,
}) => {
  const roleConfig = ROLE_CONFIG[data.role] || ROLE_CONFIG.worker;
  const Icon = roleConfig.icon || Cpu;
  const isDisabled = data.enabled === false;

  return (
    <div
      className={`
        rounded-xl p-4 min-w-[180px] max-w-[240px] transition-all duration-200
        ${selected ? 'ring-2 ring-offset-2 ring-offset-[#0D0B09]' : ''}
        ${isDisabled ? 'opacity-50' : ''}
        ${data.isExecuting ? 'animate-pulse' : ''}
      `}
      style={{
        background: roleConfig.bgColor,
        border: `2px solid ${selected ? roleConfig.color : roleConfig.borderColor}`,
        boxShadow: selected ? `0 0 20px ${roleConfig.color}40` : 'none',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: roleConfig.color,
          width: 12,
          height: 12,
          border: `2px solid #0D0B09`,
        }}
        isConnectable={!isDisabled}
      />

      <div className="flex items-center gap-3 mb-3">
        <div
          className="size-10  rounded-lg flex items-center justify-center"
          style={{ background: `${roleConfig.color}30` }}
        >
          <Icon size={20} style={{ color: roleConfig.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="font-semibold text-sm truncate"
            style={{ color: TEXT.primary }}
          >
            {data.name}
          </div>
          <div
            className="text-xs capitalize flex items-center gap-1"
            style={{ color: roleConfig.color }}
          >
            {data.role}
            {data.executionStatus === 'active' && (
              <span className="size-2  rounded-full bg-green-400 animate-pulse" />
            )}
            {data.executionStatus === 'error' && (
              <Warning size={10} className="text-red-400" />
            )}
          </div>
        </div>
      </div>

      {data.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {data.capabilities.slice(0, 3).map((cap) => (
            <span
              key={cap}
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: 'var(--bg-tertiary)',
                color: TEXT.secondary,
                border: `1px solid ${roleConfig.borderColor}`,
              }}
            >
              {cap}
            </span>
          ))}
          {data.capabilities.length > 3 && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: 'var(--bg-tertiary)',
                color: TEXT.tertiary,
              }}
            >
              +{data.capabilities.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-xs" style={{ color: TEXT.tertiary }}>
        <span>{data.connections?.length || 0} connections</span>
        {data.priority !== undefined && data.priority > 0 && (
          <span style={{ color: roleConfig.color }}>P{data.priority}</span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: roleConfig.color,
          width: 12,
          height: 12,
          border: `2px solid #0D0B09`,
        }}
        isConnectable={!isDisabled}
      />
    </div>
  );
};
