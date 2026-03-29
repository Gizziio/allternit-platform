/**
 * LoadingStates - Skeleton loaders and loading indicators
 * 
 * Provides consistent loading states for:
 * - Grid view (card skeletons)
 * - Detail view (content skeleton)
 * - Initial load (full screen spinner)
 * - Inline refresh (subtle indicator)
 */

import React from 'react';
import { Robot, MagnifyingGlass, WarningCircle, ArrowsClockwise } from '@phosphor-icons/react';
import { TEXT, MODE_COLORS, BACKGROUND, BORDER } from '@/design/a2r.tokens';

// ============================================================================
// Card Skeleton for Grid View
// ============================================================================

interface CardSkeletonProps {
  isLarge?: boolean;
}

export function CardSkeleton({ isLarge = false }: CardSkeletonProps) {
  return (
    <div
      className={`p-5 rounded-xl border animate-pulse ${isLarge ? 'col-span-2 row-span-2' : ''}`}
      style={{
        background: 'rgba(255,255,255,0.02)',
        borderColor: 'rgba(255,255,255,0.05)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          />
          <div>
            <div 
              className="w-24 h-4 rounded mb-2"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            />
            <div 
              className="w-12 h-3 rounded"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            />
          </div>
        </div>
        <div 
          className="w-12 h-6 rounded"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        />
      </div>

      {/* Progress bars */}
      {(isLarge || Math.random() > 0.5) && (
        <div className="space-y-2 mb-4">
          <div 
            className="h-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.03)' }}
          />
          {isLarge && (
            <div 
              className="h-1.5 rounded-full w-2/3"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            />
          )}
        </div>
      )}

      {/* Footer */}
      <div 
        className="absolute bottom-5 left-5 right-5 pt-3 flex justify-between"
        style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}
      >
        <div 
          className="w-12 h-3 rounded"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        />
        <div 
          className="w-16 h-3 rounded"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Grid Loading State
// ============================================================================

export function GridLoading() {
  return (
    <div className="h-full p-6 overflow-auto">
      <div 
        className="grid gap-4"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gridAutoRows: '160px',
        }}
      >
        <CardSkeleton isLarge />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

// ============================================================================
// Detail View Loading
// ============================================================================

export function DetailLoading() {
  return (
    <div className="h-full flex animate-pulse">
      {/* Sidebar */}
      <div 
        className="w-64 border-r p-4 space-y-2"
        style={{ 
          background: 'rgba(255,255,255,0.02)',
          borderColor: 'rgba(255,255,255,0.05)',
        }}
      >
        <div 
          className="w-full h-10 rounded-xl mb-4"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        />
        {[...Array(4)].map((_, i) => (
          <div 
            key={i}
            className="w-full h-14 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)' }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-6 max-w-2xl mx-auto">
        {/* Header Card */}
        <div 
          className="p-6 rounded-2xl border mb-6"
          style={{ 
            background: 'rgba(255,255,255,0.02)',
            borderColor: 'rgba(255,255,255,0.05)',
          }}
        >
          <div className="flex items-center justify-center mb-4">
            <div 
              className="w-24 h-24 rounded-3xl"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            />
          </div>
          <div 
            className="w-32 h-5 rounded mx-auto mb-2"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          />
          <div 
            className="w-24 h-3 rounded mx-auto"
            style={{ background: 'rgba(255,255,255,0.03)' }}
          />
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div 
              key={i}
              className="p-4 rounded-xl border"
              style={{ 
                background: 'rgba(255,255,255,0.02)',
                borderColor: 'rgba(255,255,255,0.05)',
              }}
            >
              <div 
                className="w-12 h-3 rounded mb-2"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              />
              <div 
                className="w-20 h-5 rounded"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Full Screen Initial Load
// ============================================================================

export function InitialLoading() {
  const modeColors = MODE_COLORS.code;
  
  return (
    <div
      className="h-full flex flex-col items-center justify-center gap-4"
      style={{ background: BACKGROUND.primary }}
    >
      {/* Spinner */}
      <div className="relative">
        <div 
          className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: `${modeColors.accent}40`, borderTopColor: 'transparent' }}
        />
        <div 
          className="absolute inset-0 w-12 h-12 rounded-full border-2 border-b-transparent animate-spin"
          style={{ 
            borderColor: modeColors.accent, 
            borderBottomColor: 'transparent',
            animationDuration: '1.5s',
            animationDirection: 'reverse',
          }}
        />
      </div>
      
      {/* Text */}
      <p className="text-sm" style={{ color: TEXT.secondary }}>
        Initializing Swarm Monitor...
      </p>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

interface EmptyStateProps {
  type?: 'no-agents' | 'no-results' | 'error';
  onRefresh?: () => void;
  onClearFilters?: () => void;
}

export function EmptyState({ type = 'no-agents', onRefresh, onClearFilters }: EmptyStateProps) {
  const modeColors = MODE_COLORS.code;

  const configs = {
    'no-agents': {
      Icon: Robot,
      title: 'No Agents Running',
      description: 'Start a conversation to create your first agent session.',
      action: onRefresh,
      actionLabel: 'Refresh',
    },
    'no-results': {
      Icon: MagnifyingGlass,
      title: 'No Results Found',
      description: 'No agents match your current filters.',
      action: onClearFilters,
      actionLabel: 'Clear Filters',
    },
    'error': {
      Icon: WarningCircle,
      title: 'Failed to Load',
      description: 'There was an error loading the agent data.',
      action: onRefresh,
      actionLabel: 'Try Again',
    },
  };

  const { Icon, title, description, action, actionLabel } = configs[type];

  return (
    <div
      className="h-full flex flex-col items-center justify-center gap-4 p-8"
      style={{ background: BACKGROUND.primary }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: BACKGROUND.tertiary, border: `1px solid ${BORDER.subtle}` }}
      >
        <Icon size={28} color={TEXT.tertiary} weight="duotone" />
      </div>
      
      <div className="text-center">
        <h3 className="text-base font-medium mb-1" style={{ color: TEXT.primary }}>
          {title}
        </h3>
        <p className="text-sm" style={{ color: TEXT.secondary }}>
          {description}
        </p>
      </div>

      {action && (
        <button
          onClick={action}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
          style={{
            background: `${modeColors.accent}20`,
            color: modeColors.accent,
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Inline Refresh Indicator
// ============================================================================

export function RefreshIndicator() {
  return (
    <div 
      className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
      style={{ 
        background: 'rgba(0,0,0,0.5)',
        color: TEXT.secondary,
        backdropFilter: 'blur(4px)',
      }}
    >
      <ArrowsClockwise size={12} color={TEXT.secondary} weight="regular" style={{ animation: 'spin 1s linear infinite' }} />
      <span>Refreshing...</span>
    </div>
  );
}
