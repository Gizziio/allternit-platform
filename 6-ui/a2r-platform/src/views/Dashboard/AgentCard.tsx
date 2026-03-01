/**
 * Agent Card Component
 * 
 * Displays agent info with avatar in dashboard view.
 */

import React from 'react';
import styles from './AgentCard.module.css';
import { Avatar } from '../../components/Avatar';
import { useVisualState } from '../../hooks/useVisualState';

export interface AgentCardProps {
  /** Agent ID */
  agentId: string;
  /** Agent name */
  agentName: string;
  /** Agent role/description */
  role?: string;
  /** Current task */
  currentTask?: string;
  /** Status indicator */
  status?: 'online' | 'busy' | 'offline';
  /** Click handler */
  onClick?: () => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({
  agentId,
  agentName,
  role,
  currentTask,
  status = 'online',
  onClick,
}) => {
  const { visualState } = useVisualState(agentId);

  return (
    <div 
      className={`${styles.card} ${onClick ? styles.clickable : ''}`}
      onClick={onClick}
    >
      <div className={styles.header}>
        <div className={styles.avatar}>
          {visualState ? (
            <Avatar visualState={visualState} size="md" animate />
          ) : (
            <div className={styles.placeholderAvatar}>🤖</div>
          )}
        </div>
        
        <div className={styles.statusIndicator} data-status={status} />
      </div>

      <div className={styles.info}>
        <h4 className={styles.name}>{agentName}</h4>
        {role && <p className={styles.role}>{role}</p>}
        
        {visualState && (
          <div className={styles.mood}>
            <span 
              className={styles.moodDot}
              style={{ backgroundColor: getMoodColor(visualState.mood) }}
            />
            {visualState.mood}
          </div>
        )}
        
        {currentTask && (
          <p className={styles.task}>{currentTask}</p>
        )}
      </div>
    </div>
  );
};

function getMoodColor(mood: string): string {
  const colors: Record<string, string> = {
    idle: '#9E9E9E',
    focused: '#2196F3',
    thinking: '#FF9800',
    uncertain: '#FFC107',
    celebrating: '#4CAF50',
    warning: '#FF5722',
    error: '#F44336',
    listening: '#9C27B0',
    speaking: '#00BCD4',
    sleeping: '#607D8B',
    confused: '#795548',
  };
  return colors[mood] || '#9E9E9E';
}

export default AgentCard;
