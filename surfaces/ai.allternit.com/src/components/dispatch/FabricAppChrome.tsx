'use client';

import React from 'react';
import { CaretLeft } from '@phosphor-icons/react';

export function FabricViewTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: React.ReactNode;
}): React.ReactNode {
  return (
    <div className="min-w-0">
      <h1
        className="text-2xl sm:text-3xl font-medium tracking-tight m-0"
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        {title}
      </h1>
      {subtitle ? (
        <p className="m-0 mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</p>
      ) : null}
    </div>
  );
}

export function FabricHeaderControl({
  children,
  onClick,
  href,
  title,
  active,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  title?: string;
  active?: boolean;
  className?: string;
}): React.ReactNode {
  const classes =
    'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-solid border-[var(--border-subtle)] text-[12px] font-semibold cursor-pointer no-underline ' +
    (active
      ? 'bg-[var(--shell-control-active-bg)] text-[var(--shell-control-active-fg)]'
      : 'bg-[var(--shell-control-bg)] text-[var(--shell-control-fg)]') +
    (className ? ` ${className}` : '');
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" title={title} className={classes}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} title={title} className={classes}>
      {children}
    </button>
  );
}

export function FabricStatusCluster({
  onlineCount,
  runtimeCount,
  pendingPermissions,
  pendingQuestions,
  children,
}: {
  onlineCount: number;
  runtimeCount: number;
  pendingPermissions: number;
  pendingQuestions: number;
  children?: React.ReactNode;
}): React.ReactNode {
  return (
    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
      <span className="text-[12px] font-semibold text-[var(--shell-item-muted)] whitespace-nowrap">
        {onlineCount}/{runtimeCount} online
      </span>
      <span className="hidden sm:inline text-[12px] font-semibold text-[var(--shell-item-muted)] whitespace-nowrap">
        {pendingPermissions} perms
      </span>
      <span className="hidden sm:inline text-[12px] font-semibold text-[var(--shell-item-muted)] whitespace-nowrap">
        {pendingQuestions} questions
      </span>
      {children}
    </div>
  );
}

export function FabricAppHeader({
  title,
  onBack,
  backLabel = 'Home',
  children,
}: {
  title?: string;
  onBack?: () => void;
  backLabel?: string;
  children?: React.ReactNode;
}): React.ReactNode {
  return (
    <header className="min-h-11 shrink-0 flex items-center justify-between gap-2 px-3 sm:px-4 border-b border-solid border-[var(--border-subtle)] bg-[var(--shell-rail-bg)]">
      <div className="flex items-center gap-3 min-w-0">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--shell-control-bg)] text-[12px] font-semibold text-[var(--shell-control-fg)] cursor-pointer"
          >
            <CaretLeft size={16} weight="bold" />
            {backLabel}
          </button>
        ) : null}
        {title ? (
          <span className="text-[15px] font-medium tracking-tight truncate" style={{ fontFamily: 'var(--font-ui)' }}>
            {title}
          </span>
        ) : null}
      </div>
      {children}
    </header>
  );
}
