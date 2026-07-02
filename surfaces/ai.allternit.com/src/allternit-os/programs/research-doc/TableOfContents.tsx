"use client";

import React from 'react';

interface TableOfContentsProps {
  toc: { id: string; title: string; level: number }[];
  activeId?: string;
}

export const TableOfContents: React.FC<TableOfContentsProps> = ({ toc, activeId }) => {
  return (
    <nav className="sticky top-4">
      <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
        Contents
      </h4>
      <ul className="space-y-1">
        {toc.map((item) => (
          <li key={item.id} style={{ paddingLeft: `${(item.level - 1) * 12}px` }}>
            <a
              href={`#${item.id}`}
              className={`
                block text-sm py-1 px-2 rounded
                transition-colors duration-150
                ${activeId === item.id
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }
              `}
            >
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};
