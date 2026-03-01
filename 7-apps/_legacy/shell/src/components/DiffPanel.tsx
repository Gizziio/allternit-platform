import * as React from 'react';

interface DiffPanelProps {
  events: Array<{
    type: string;
    message: string;
    timestamp: number;
    evidenceId?: string;
  }>;
  onHighlightSection?: (sectionId: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const DiffPanel: React.FC<DiffPanelProps> = ({
  events,
  onHighlightSection,
  isOpen = false,
  onClose,
}) => {
  const formatTimestamp = (ts: number): string => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    if (diffMs < 60000) {
      return `${Math.floor(diffMs / 1000)}s ago`;
    } else if (diffMs < 3600000) {
      const minutes = Math.floor(diffMs / 60000);
      return `${minutes}m ago`;
    } else {
      const hours = Math.floor(diffMs / 3600000);
      return `${hours}h ago`;
    }
  };

  const getEventColor = (type: string): string => {
    switch (type) {
      case 'evidenceAdded': return '#10b981';
      case 'evidenceRemoved': return '#dc2626';
      case 'dataModelPatched': return '#3b82f6';
      case 'sectionAdded': return '#059669';
      default: return '#6b7280';
    }
  };

  const getEventIcon = (type: string): string => {
    switch (type) {
      case 'evidenceAdded': return '➕';
      case 'evidenceRemoved': return '➖';
      case 'dataModelPatched': return '🔄';
      case 'sectionAdded': return '📄';
      default: return '•';
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="diff-panel">
      <div className="diff-panel-header">
        <h3>Why Updated?</h3>
        <button className="diff-panel-close" onClick={onClose} aria-label="Close" type="button">
          ×
        </button>
      </div>
      <div className="diff-panel-list">
        {events.map((event, index) => (
          <div
            key={`${event.type}-${index}`}
            className={`diff-item diff-item-${event.type}`}
            style={{ borderLeftColor: getEventColor(event.type) }}
          >
            <div className="diff-item-icon">{getEventIcon(event.type)}</div>
            <div className="diff-item-content">
              <div className="diff-item-message">{event.message}</div>
              {event.evidenceId && (
                <button
                  className="diff-item-link"
                  onClick={() => onHighlightSection?.(event.evidenceId)}
                  type="button"
                >
                  Source: {event.evidenceId.slice(0, 8)}...
                </button>
              )}
            </div>
            <div className="diff-item-timestamp">{formatTimestamp(event.timestamp)}</div>
          </div>
        ))}
        {events.length === 0 && (
          <div className="diff-empty">
            <p>No updates recorded yet</p>
          </div>
        )}
      </div>
    </div>
  );
};
