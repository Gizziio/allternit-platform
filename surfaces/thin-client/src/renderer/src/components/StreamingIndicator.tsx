/**
 * Streaming Indicator Component
 * 
 * Shows when AI is generating a response
 */

import React from 'react';

export const StreamingIndicator: React.FC = () => {
  return (
    <div className="streaming-indicator">
      <div className="dots">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
      <span className="text">Gizzi is thinking...</span>

      <style>{`
        .streaming-indicator {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md) var(--spacing-lg);
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          animation: fadeIn 0.3s ease;
        }
        
        .dots {
          display: flex;
          gap: 4px;
        }
        
        .dot {
          width: 6px;
          height: 6px;
          background: var(--color-accent);
          border-radius: 50%;
          animation: bounce 1.4s ease-in-out infinite both;
        }
        
        .dot:nth-child(1) {
          animation-delay: -0.32s;
        }
        
        .dot:nth-child(2) {
          animation-delay: -0.16s;
        }
        
        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};
