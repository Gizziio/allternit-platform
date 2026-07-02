"use client";

import React from 'react';

interface BreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ path, onNavigate }) => {
  const parts = path ? path.split('/') : [];

  return (
    <div className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400 overflow-x-auto no-scrollbar py-1">
      <button type="button"
        onClick={() => onNavigate('')}
        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg flex-shrink-0 transition-colors"
        title="Home"
      >
        <span className="text-lg">🏠</span>
      </button>
      {parts.map((part, index) => (
        <React.Fragment key={`${part}-${index}`}>
          <span className="text-zinc-400 font-light select-none">/</span>
          <button type="button"
            onClick={() => onNavigate(parts.slice(0, index + 1).join('/'))}
            className={`
              px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg 
              truncate max-w-[150px] transition-colors
              ${index === parts.length - 1 ? 'font-semibold text-zinc-900 dark:text-zinc-100' : ''}
            `}
          >
            {part}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};
