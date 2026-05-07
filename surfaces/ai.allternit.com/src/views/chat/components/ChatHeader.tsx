/**
 * Chat Header Component
 * 
 * Displays agent name and avatar in chat view.
 */

import React from 'react';
import styles from './ChatHeader.module.css';
import { Avatar } from '../../../components/Avatar';
import { useVisualState } from '../../../hooks/useVisualState';

export interface ChatHeaderProps {
  /** Agent ID */
  agentId: string;
  /** Agent name */
  agentName: string;
  /** Agent description */
  agentDescription?: string;
  /** Show avatar */
  showAvatar?: boolean;
  /** On close handler */
  onClose?: () => void;
  /** Additional actions */
  actions?: React.ReactNode;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  agentId,
  agentName,
  agentDescription,
  showAvatar = true,
  onClose,
  actions,
}) => {
  const { visualState } = useVisualState(agentId);

  return (
    <div className={styles.header}>
      <div className={styles.left}>
        {showAvatar && visualState && (
          <div className={styles.avatar}>
            <Avatar
              visualState={visualState}
              size="sm"
              animate
            />
          </div>
        )}
        
        <div className={styles.info}>
          <h3 className={styles.name}>{agentName}</h3>
          {agentDescription && (
            <p className={styles.description}>{agentDescription}</p>
          )}
          {visualState && (
            <span className={styles.status}>
              {visualState.mood}
            </span>
          )}
        </div>
      </div>
      
      <div className={styles.right}>
        {actions}
        {onClose && (
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close chat"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatHeader;
