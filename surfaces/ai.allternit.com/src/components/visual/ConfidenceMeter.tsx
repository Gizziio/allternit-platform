/**
 * Confidence Meter Component
 * 
 * Animated circular progress indicator showing visual verification
 * confidence score with color-coded thresholds.
 */

import React, { useEffect, useState } from 'react';

interface ConfidenceMeterProps {
  confidence: number; // 0.0 to 1.0
  threshold?: number; // Default 0.7
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  animated?: boolean;
}

function getColor(confidence: number, threshold: number): string {
  if (confidence >= threshold) return 'var(--status-success)'; // Green
  if (confidence >= threshold * 0.85) return '#eab308'; // Yellow
  return 'var(--status-error)'; // Red
}

function getStatus(confidence: number, threshold: number): 'passed' | 'warning' | 'failed' {
  if (confidence >= threshold) return 'passed';
  if (confidence >= threshold * 0.85) return 'warning';
  return 'failed';
}

const sizeMap = {
  small: 60,
  medium: 100,
  large: 140,
};

export const ConfidenceMeter: React.FC<ConfidenceMeterProps> = ({
  confidence,
  threshold = 0.7,
  size = 'medium',
  showLabel = true,
  animated = true,
}) => {
  const [displayConfidence, setDisplayConfidence] = useState(0);
  const pixelSize = sizeMap[size];
  const color = getColor(confidence, threshold);
  const status = getStatus(confidence, threshold);
  
  const radius = (pixelSize - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(displayConfidence, 0), 1);
  const strokeDashoffset = circumference - progress * circumference;

  useEffect(() => {
    const duration = 600;
    const start = displayConfidence;
    const diff = confidence - start;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayConfidence(start + diff * easeOut);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [confidence]);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    width: pixelSize,
  };

  const meterStyle: React.CSSProperties = {
    position: 'relative',
    width: pixelSize,
    height: pixelSize,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const glowStyle: React.CSSProperties = {
    position: 'absolute',
    inset: '-4px',
    borderRadius: '50%',
    background: color,
    opacity: confidence * 0.15,
    filter: 'blur(12px)',
  };

  const scoreContainerStyle: React.CSSProperties = {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const scoreStyle: React.CSSProperties = {
    fontSize: pixelSize * 0.35,
    fontWeight: 700,
    color: '#fff',
    fontVariantNumeric: 'tabular-nums',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: pixelSize * 0.12,
    color: 'var(--ui-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  const badgeStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    background: status === 'passed' ? 'rgba(34, 197, 94, 0.15)' : 
                status === 'warning' ? 'rgba(234, 179, 8, 0.15)' : 
                'rgba(239, 68, 68, 0.15)',
    color: color,
  };

  const thresholdStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    color: 'var(--ui-text-muted)',
  };

  return (
    <div style={containerStyle}>
      <div style={meterStyle}>
        <div style={glowStyle} />
        <svg 
          viewBox={`0 0 ${pixelSize} ${pixelSize}`} 
          style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}
        >
          <circle
            cx={pixelSize / 2}
            cy={pixelSize / 2}
            r={radius}
            fill="none"
            stroke="#2a2a2a"
            strokeWidth={8}
          />
          <circle
            cx={pixelSize / 2}
            cy={pixelSize / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
          />
        </svg>
        <div style={scoreContainerStyle}>
          <span style={scoreStyle}>
            {Math.round(displayConfidence * 100)}%
          </span>
          {showLabel && <span style={labelStyle}>Confidence</span>}
        </div>
      </div>
      
      <div style={badgeStyle}>
        {status === 'passed' && '✓ Passed'}
        {status === 'warning' && '⚠ Warning'}
        {status === 'failed' && '✗ Failed'}
      </div>
      
      <div style={thresholdStyle}>
        <div style={{ 
          width: '6px', 
          height: '6px', 
          borderRadius: '50%', 
          background: confidence >= threshold ? 'var(--status-success)' : '#444',
          transition: 'background 0.3s'
        }} />
        Threshold: {Math.round(threshold * 100)}%
      </div>
    </div>
  );
};

export default ConfidenceMeter;
