/**
 * Standardized EmptyState Component
 * Used across the application for consistent empty/loading/error states
 */

import React, { ReactNode } from 'react';

export type EmptyStateVariant = 'empty' | 'loading' | 'error' | 'search';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  minHeight?: string | number;
}

const defaultIcons: Record<EmptyStateVariant, ReactNode> = {
  empty: (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
      <polyline points="13 2 13 9 20 9"/>
    </svg>
  ),
  loading: (
    <div style={{ 
      width: '64px', 
      height: '64px', 
      borderRadius: '50%',
      border: '3px solid color-mix(in srgb, var(--accent-primary) 10%, transparent)',
      borderTopColor: 'var(--accent-primary)',
      animation: 'spin 1s linear infinite'
    }} />
  ),
  error: (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  search: (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
};

const defaultTitles: Record<EmptyStateVariant, string> = {
  empty: 'No items found',
  loading: 'Loading...',
  error: 'Something went wrong',
  search: 'No results found',
};

const defaultDescriptions: Record<EmptyStateVariant, string> = {
  empty: 'Get started by creating your first item.',
  loading: 'Please wait while we fetch the data.',
  error: 'We encountered an error while loading the data. Please try again.',
  search: 'Try adjusting your search terms or filters.',
};

export function EmptyState({
  variant = 'empty',
  title,
  description,
  icon,
  action,
  secondaryAction,
  className = '',
  minHeight = '400px',
}: EmptyStateProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight,
        padding: '40px',
        textAlign: 'center',
      }}
    >
      <div style={{ marginBottom: '24px' }}>
        {icon || defaultIcons[variant]}
      </div>
      
      <h3 style={{ 
        fontSize: '18px', 
        fontWeight: 600, 
        color: '#fff', 
        margin: '0 0 8px 0' 
      }}>
        {title || defaultTitles[variant]}
      </h3>
      
      <p style={{ 
        fontSize: '14px', 
        color: 'rgba(255,255,255,0.5)', 
        margin: '0 0 24px 0',
        maxWidth: '400px',
        lineHeight: 1.5
      }}>
        {description || defaultDescriptions[variant]}
      </p>
      
      {(action || secondaryAction) && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {action && (
            <button
              onClick={action.onClick}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: action.variant === 'secondary' ? '1px solid rgba(255,255,255,0.2)' : 'none',
                background: action.variant === 'secondary' ? 'transparent' : 'var(--accent-primary)',
                color: action.variant === 'secondary' ? '#fff' : 'var(--ui-text-inverse)',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'transparent',
                color: '#fff',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Specialized variants
export function EmptyStateLoading({ 
  title = 'Loading...', 
  description = 'Please wait while we fetch the data.',
  ...props 
}: Partial<EmptyStateProps>) {
  return <EmptyState variant="loading" title={title} description={description} {...props} />;
}

export function EmptyStateError({ 
  title = 'Something went wrong', 
  description = 'We encountered an error while loading the data.',
  action,
  ...props 
}: Partial<EmptyStateProps> & { action?: { label: string; onClick: () => void } }) {
  return (
    <EmptyState 
      variant="error" 
      title={title} 
      description={description} 
      action={action}
      {...props} 
    />
  );
}

export function EmptyStateSearch({ 
  title = 'No results found', 
  description = 'Try adjusting your search terms or filters.',
  ...props 
}: Partial<EmptyStateProps>) {
  return <EmptyState variant="search" title={title} description={description} {...props} />;
}
