/**
 * Loading Skeleton Component
 * 
 * Animated skeleton placeholders for visual verification loading states.
 */

import React from 'react';

interface SkeletonProps {
  variant?: 'card' | 'meter' | 'chart' | 'panel';
  count?: number;
}

const shimmerKeyframes = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;

const shimmerStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: '4px',
};

const CardSkeleton: React.FC = () => (
  <div style={{
    background: 'var(--surface-panel)',
    border: '1px solid #333',
    borderRadius: '12px',
    padding: '16px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
      <div style={{ ...shimmerStyle, width: '100px', height: '28px', borderRadius: '8px' }} />
      <div style={{ ...shimmerStyle, width: '50px', height: '24px', borderRadius: '6px' }} />
    </div>
    <div style={{ ...shimmerStyle, width: '100%', height: '120px', borderRadius: '8px', marginBottom: '12px' }} />
    <div style={{ ...shimmerStyle, width: '100%', height: '4px', borderRadius: '2px' }} />
    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
      <div style={{ ...shimmerStyle, width: '80px', height: '20px', borderRadius: '6px' }} />
      <div style={{ ...shimmerStyle, width: '60px', height: '20px', borderRadius: '6px' }} />
    </div>
  </div>
);

const MeterSkeleton: React.FC = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '24px',
    background: 'var(--surface-panel)',
    borderRadius: '12px',
  }}>
    <div style={{ ...shimmerStyle, width: '100px', height: '16px' }} />
    <div style={{ ...shimmerStyle, width: '140px', height: '140px', borderRadius: '50%' }} />
    <div style={{ ...shimmerStyle, width: '80px', height: '24px', borderRadius: '12px' }} />
    <div style={{ ...shimmerStyle, width: '100px', height: '14px' }} />
  </div>
);

const ChartSkeleton: React.FC = () => (
  <div style={{
    background: 'var(--surface-panel)',
    border: '1px solid #333',
    borderRadius: '12px',
    padding: '20px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
      <div style={{ ...shimmerStyle, width: '120px', height: '16px' }} />
      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ ...shimmerStyle, width: '50px', height: '24px' }} />
        <div style={{ ...shimmerStyle, width: '50px', height: '24px' }} />
      </div>
    </div>
    <div style={{ ...shimmerStyle, width: '100%', height: '150px' }} />
    <div style={{ display: 'flex', gap: '16px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #333' }}>
      <div style={{ ...shimmerStyle, width: '80px', height: '12px' }} />
      <div style={{ ...shimmerStyle, width: '80px', height: '12px' }} />
    </div>
  </div>
);

const PanelSkeleton: React.FC = () => (
  <div style={{
    background: 'var(--surface-panel)',
    border: '1px solid #333',
    borderRadius: '16px',
    overflow: 'hidden',
  }}>
    {/* Header */}
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      padding: '20px 24px',
      borderBottom: '1px solid #333',
      background: 'var(--surface-panel)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ ...shimmerStyle, width: '48px', height: '48px', borderRadius: '12px' }} />
        <div>
          <div style={{ ...shimmerStyle, width: '150px', height: '18px', marginBottom: '4px' }} />
          <div style={{ ...shimmerStyle, width: '100px', height: '13px' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ ...shimmerStyle, width: '36px', height: '36px', borderRadius: '8px' }} />
      </div>
    </div>

    {/* Content */}
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '24px', marginBottom: '24px' }}>
        <MeterSkeleton />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div style={{ ...shimmerStyle, height: '80px', borderRadius: '12px' }} />
            <div style={{ ...shimmerStyle, height: '80px', borderRadius: '12px' }} />
            <div style={{ ...shimmerStyle, height: '80px', borderRadius: '12px' }} />
          </div>
          <ChartSkeleton />
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
      </div>
    </div>
  </div>
);

export const LoadingSkeleton: React.FC<SkeletonProps> = ({ 
  variant = 'panel',
  count = 1,
}) => {
  const SkeletonComponent = {
    card: CardSkeleton,
    meter: MeterSkeleton,
    chart: ChartSkeleton,
    panel: PanelSkeleton,
  }[variant];

  return (
    <>
      <style>{shimmerKeyframes}</style>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonComponent key={i} />
      ))}
    </>
  );
};

export default LoadingSkeleton;
