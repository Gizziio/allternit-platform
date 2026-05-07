/**
 * Swarm Role Cards - CrewAI-inspired
 *
 * Production-ready role selection cards for swarm orchestration.
 * Each role has distinct visual identity, description, and use cases.
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Code,
  ShieldCheck,
  Brain,
  Target,
  Eye,
  Check,
} from '@phosphor-icons/react';
import { SwarmRole } from '@/lib/agents';

// ============================================================================
// Role Configuration
// ============================================================================

const ROLE_CONFIG: Record<SwarmRole, {
  label: string;
  icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  gradient: string;
  description: string;
  responsibilities: string[];
  bestFor: string[];
}> = {
  leader: {
    label: 'Leader',
    icon: Users,
    color: 'var(--status-info)', // blue-400
    bgColor: 'rgba(96, 165, 250, 0.15)',
    borderColor: 'rgba(96, 165, 250, 0.4)',
    gradient: 'linear-gradient(135deg, rgba(96, 165, 250, 0.2) 0%, rgba(96, 165, 250, 0.05) 100%)',
    description: 'Coordinates and delegates to other agents',
    responsibilities: [
      'Orchestrate swarm execution',
      'Delegate tasks to workers',
      'Make final decisions',
      'Handle escalations',
    ],
    bestFor: ['Complex workflows', 'Multi-step processes', 'Team coordination'],
  },
  worker: {
    label: 'Worker',
    icon: Code,
    color: 'var(--status-success)', // green-400
    bgColor: 'rgba(74, 222, 128, 0.15)',
    borderColor: 'rgba(74, 222, 128, 0.4)',
    gradient: 'linear-gradient(135deg, rgba(74, 222, 128, 0.2) 0%, rgba(74, 222, 128, 0.05) 100%)',
    description: 'Executes tasks and implements solutions',
    responsibilities: [
      'Execute assigned tasks',
      'Implement solutions',
      'Report progress',
      'Request help when blocked',
    ],
    bestFor: ['Implementation', 'Task execution', 'Code generation'],
  },
  critic: {
    label: 'Critic',
    icon: ShieldCheck,
    color: '#a78bfa', // purple-400
    bgColor: 'rgba(167, 139, 250, 0.15)',
    borderColor: 'rgba(167, 139, 250, 0.4)',
    gradient: 'linear-gradient(135deg, rgba(167, 139, 250, 0.2) 0%, rgba(167, 139, 250, 0.05) 100%)',
    description: 'Reviews and validates work quality',
    responsibilities: [
      'Review outputs',
      'Validate quality',
      'Identify issues',
      'Provide feedback',
    ],
    bestFor: ['Code review', 'Quality assurance', 'Error detection'],
  },
  planner: {
    label: 'Planner',
    icon: Brain,
    color: '#fb923c', // orange-400
    bgColor: 'rgba(251, 146, 60, 0.15)',
    borderColor: 'rgba(251, 146, 60, 0.4)',
    gradient: 'linear-gradient(135deg, rgba(251, 146, 60, 0.2) 0%, rgba(251, 146, 60, 0.05) 100%)',
    description: 'Creates execution plans and strategies',
    responsibilities: [
      'Analyze requirements',
      'Create execution plans',
      'Identify dependencies',
      'Optimize workflows',
    ],
    bestFor: ['Strategy', 'Planning', 'Architecture'],
  },
  specialist: {
    label: 'Specialist',
    icon: Target,
    color: '#2dd4bf', // teal-400
    bgColor: 'rgba(45, 212, 191, 0.15)',
    borderColor: 'rgba(45, 212, 191, 0.4)',
    gradient: 'linear-gradient(135deg, rgba(45, 212, 191, 0.2) 0%, rgba(45, 212, 191, 0.05) 100%)',
    description: 'Domain expert with specialized knowledge',
    responsibilities: [
      'Provide domain expertise',
      'Handle specialized tasks',
      'Offer deep insights',
      'Solve complex problems',
    ],
    bestFor: ['Domain expertise', 'Specialized tasks', 'Complex analysis'],
  },
  observer: {
    label: 'Observer',
    icon: Eye,
    color: '#f472b6', // pink-400
    bgColor: 'rgba(244, 114, 182, 0.15)',
    borderColor: 'rgba(244, 114, 182, 0.4)',
    gradient: 'linear-gradient(135deg, rgba(244, 114, 182, 0.2) 0%, rgba(244, 114, 182, 0.05) 100%)',
    description: 'Monitors and reports on swarm activity',
    responsibilities: [
      'Monitor swarm health',
      'Track metrics',
      'Generate reports',
      'Identify bottlenecks',
    ],
    bestFor: ['Monitoring', 'Analytics', 'Reporting'],
  },
};

// ============================================================================
// Types
// ============================================================================

export interface SwarmRoleCardProps {
  role: SwarmRole;
  isSelected?: boolean;
  isDisabled?: boolean;
  onSelect?: (role: SwarmRole) => void;
  showDetails?: boolean;
  compact?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function SwarmRoleCard({
  role,
  isSelected = false,
  isDisabled = false,
  onSelect,
  showDetails = true,
  compact = false,
}: SwarmRoleCardProps) {
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;

  const handleClick = () => {
    if (!isDisabled && onSelect) {
      onSelect(role);
    }
  };

  return (
    <motion.button
      layout
      onClick={handleClick}
      disabled={isDisabled}
      whileHover={!isDisabled ? { scale: 1.02, y: -2 } : {}}
      whileTap={!isDisabled ? { scale: 0.98 } : {}}
      className={`
        relative w-full text-left rounded-xl border transition-all overflow-hidden
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${isSelected ? 'ring-2' : ''}
      `}
      style={{
        background: config.gradient,
        borderColor: isSelected ? config.color : config.borderColor,
      }}
    >
      {/* Selection Indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center"
          style={{
            background: config.color,
            boxShadow: `0 0 20px ${config.color}66`,
          }}
        >
          <Check size={14} strokeWidth={3} className="text-white" />
        </motion.div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          {/* Icon */}
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: config.bgColor,
              border: `1px solid ${config.borderColor}`,
              color: config.color,
            }}
          >
            <Icon size={24} strokeWidth={1.5} />
          </div>

          {/* Title & Description */}
          <div className="flex-1 min-w-0">
            <h3
              className="text-sm font-bold mb-1 truncate"
              style={{ color: isSelected ? config.color : 'var(--ui-text-primary)' }}
            >
              {config.label}
            </h3>
            {!compact && (
              <p className="text-xs text-white/50 leading-relaxed">
                {config.description}
              </p>
            )}
          </div>
        </div>

        {/* Details */}
        {showDetails && !compact && (
          <div className="space-y-3">
            {/* Responsibilities */}
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">
                Responsibilities
              </h4>
              <ul className="space-y-1">
                {config.responsibilities.map((resp, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-white/70 flex items-start gap-2"
                  >
                    <span
                      className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0"
                      style={{ background: config.color }}
                    />
                    <span>{resp}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Best For */}
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">
                Best For
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {config.bestFor.map((use, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] px-2 py-1 rounded-full font-medium"
                    style={{
                      background: config.bgColor,
                      color: config.color,
                      border: `1px solid ${config.borderColor}`,
                    }}
                  >
                    {use}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.button>
  );
}

// ============================================================================
// Role Selector Grid
// ============================================================================

export interface SwarmRoleSelectorProps {
  selectedRole?: SwarmRole;
  onRoleSelect?: (role: SwarmRole) => void;
  disabledRoles?: SwarmRole[];
  compact?: boolean;
}

export function SwarmRoleSelector({
  selectedRole,
  onRoleSelect,
  disabledRoles = [],
  compact = false,
}: SwarmRoleSelectorProps) {
  const roles: SwarmRole[] = ['leader', 'worker', 'critic', 'planner', 'specialist', 'observer'];

  return (
    <div className={`grid gap-3 ${compact ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-3'}`}>
      {roles.map((role) => (
        <SwarmRoleCard
          key={role}
          role={role}
          isSelected={selectedRole === role}
          isDisabled={disabledRoles.includes(role)}
          onSelect={onRoleSelect}
          showDetails={!compact}
          compact={compact}
        />
      ))}
    </div>
  );
}

export default SwarmRoleCard;
