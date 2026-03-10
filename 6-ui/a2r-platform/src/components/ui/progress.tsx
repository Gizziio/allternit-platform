import React from 'react';

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
}

export const Progress: React.FC<ProgressProps> = ({ value, max = 100, className }) => {
  const percentage = Math.min((value / max) * 100, 100);
  
  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '8px',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${percentage}%`,
          height: '100%',
          background: '#d4b08c',
          borderRadius: '4px',
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
};
