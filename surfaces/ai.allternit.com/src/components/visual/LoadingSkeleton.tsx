/**
 * Loading Skeleton Component
 * 
 * Animated skeleton placeholders for visual verification loading states.
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  variant?: 'card' | 'meter' | 'chart' | 'panel';
  count?: number;
}

const shimmerClass = "bg-[linear-gradient(90deg,var(--surface-active)_25%,var(--surface-hover)_50%,var(--surface-active)_75%)] bg-[length:200%_100%] animate-[shimmer_1.5s_infinite] rounded";

const CardSkeleton: React.FC = () => (
  <div className="bg-[var(--surface-panel)] border border-solid border-[#333] rounded-xl p-4">
    <div className="flex items-center justify-between mb-3">
      <div className={cn(shimmerClass, "w-[100px] h-7 rounded-lg")} />
      <div className={cn(shimmerClass, "w-[50px] h-6 rounded-md")} />
    </div>
    <div className={cn(shimmerClass, "w-full h-[120px] rounded-lg mb-3")} />
    <div className={cn(shimmerClass, "w-full h-1 rounded-sm")} />
    <div className="flex gap-2 mt-3">
      <div className={cn(shimmerClass, "w-20 h-5 rounded-md")} />
      <div className={cn(shimmerClass, "w-[60px] h-5 rounded-md")} />
    </div>
  </div>
);

const MeterSkeleton: React.FC = () => (
  <div className="flex flex-col items-center gap-4 p-6 bg-[var(--surface-panel)] rounded-xl">
    <div className={cn(shimmerClass, "w-[100px] h-4")} />
    <div className={cn(shimmerClass, "size-[140px] rounded-full")} />
    <div className={cn(shimmerClass, "w-20 h-6 rounded-xl")} />
    <div className={cn(shimmerClass, "w-[100px] h-3.5")} />
  </div>
);

const ChartSkeleton: React.FC = () => (
  <div className="bg-[var(--surface-panel)] border border-solid border-[#333] rounded-xl p-5">
    <div className="flex items-center justify-between mb-4">
      <div className={cn(shimmerClass, "w-[120px] h-4")} />
      <div className="flex gap-4">
        <div className={cn(shimmerClass, "w-[50px] h-6")} />
        <div className={cn(shimmerClass, "w-[50px] h-6")} />
      </div>
    </div>
    <div className={cn(shimmerClass, "w-full h-[150px]")} />
    <div className="flex gap-4 mt-4 pt-4 border-t border-solid border-[#333]">
      <div className={cn(shimmerClass, "w-20 h-3")} />
      <div className={cn(shimmerClass, "w-20 h-3")} />
    </div>
  </div>
);

const PanelSkeleton: React.FC = () => (
  <div className="bg-[var(--surface-panel)] border border-solid border-[#333] rounded-2xl overflow-hidden">
    {/* Header */}
    <div className="flex items-center justify-between p-[20px_24px] border-b border-solid border-[#333] bg-[var(--surface-panel)]">
      <div className="flex items-center gap-4">
        <div className={cn(shimmerClass, "size-12 rounded-xl")} />
        <div>
          <div className={cn(shimmerClass, "w-[150px] h-4.5 mb-1")} />
          <div className={cn(shimmerClass, "w-[100px] h-3.5")} />
        </div>
      </div>
      <div className="flex gap-2">
        <div className={cn(shimmerClass, "size-9 rounded-lg")} />
      </div>
    </div>

    {/* Content */}
    <div className="p-6">
      <div className="grid grid-cols-[auto_1fr] gap-6 mb-6">
        <MeterSkeleton />
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-4">
            <div className={cn(shimmerClass, "h-20 rounded-xl")} />
            <div className={cn(shimmerClass, "h-20 rounded-xl")} />
            <div className={cn(shimmerClass, "h-20 rounded-xl")} />
          </div>
          <ChartSkeleton />
        </div>
      </div>
      
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {[1, 2, 3].map(i => <CardSkeleton key={`skeleton-card-${i}`} />)}
      </div>
    </div>
  </div>
);

const LoadingSkeleton: React.FC<SkeletonProps> = ({ 
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
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonComponent key={`skeleton-${variant}-${i}`} />
      ))}
    </>
  );
};

export default LoadingSkeleton;
