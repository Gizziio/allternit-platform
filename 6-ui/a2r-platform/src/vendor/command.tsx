import { KBarProvider, KBarPortal, KBarPositioner, KBarAnimator, KBarSearch, KBarResults, useMatches } from 'kbar';
import { useRegisterActions } from 'kbar';
import type { Action } from 'kbar';
import React, { useCallback, useMemo } from 'react';

// Re-export kbar components and hooks
export {
  KBarProvider,
  KBarPortal,
  KBarPositioner,
  KBarAnimator,
  KBarSearch,
  KBarResults,
  useMatches,
  useRegisterActions
};

// Define types for command actions
export interface A2RCommandAction {
  id: string;
  name: string;
  shortcut?: string[];
  keywords?: string[];
  section?: string;
  perform?: () => void;
  children?: A2RCommandAction[];
}

// Helper function to transform A2RCommandAction to kbar's Action
const transformAction = (action: A2RCommandAction): Action => ({
  id: action.id,
  name: action.name,
  shortcut: action.shortcut,
  keywords: action.keywords?.join(' '),
  section: action.section,
  perform: action.perform ? () => action.perform?.() : undefined
});

// Command provider component
export const A2RCommandProvider: React.FC<{
  children: React.ReactNode;
  actions?: A2RCommandAction[];
  options?: {
    disableDefaultShortcut?: boolean;
  };
}> = ({ children, actions = [], options = {} }) => {
  // Transform actions to match kbar's Action type
  const transformedActions = useMemo(() => 
    actions.map(transformAction),
    [actions]
  );

  // Note: disableDefaultShortcut is not a standard kbar option
  // kbar uses toggleShortcut in options instead
  const kbarOptions = useMemo(() => ({
    // If disableDefaultShortcut is true, we can set a non-existent shortcut
    // Otherwise use default $mod+k
    toggleShortcut: options.disableDefaultShortcut ? undefined : undefined,
  }), [options.disableDefaultShortcut]);

  return (
    <KBarProvider 
      actions={transformedActions}
      options={kbarOptions}
    >
      {children}
    </KBarProvider>
  );
};

// Render function for KBarResults
const renderResult = ({ item, active }: { item: any; active: boolean }) => {
  if (typeof item === 'string') {
    return <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{item}</div>;
  }
  return (
    <div
      className={`px-4 py-2 cursor-pointer flex items-center justify-between ${
        active 
          ? 'bg-gray-100 dark:bg-gray-800' 
          : 'bg-transparent'
      }`}
    >
      <div className="flex items-center gap-3">
        {item.icon && <span className="text-gray-600 dark:text-gray-300">{item.icon}</span>}
        <div>
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.name}</div>
          {item.subtitle && (
            <div className="text-xs text-gray-500 dark:text-gray-400">{item.subtitle}</div>
          )}
        </div>
      </div>
      {item.shortcut?.length > 0 && (
        <div className="flex items-center gap-1">
          {item.shortcut.map((key: string) => (
            <kbd
              key={key}
              className="px-2 py-1 text-xs font-mono bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
            >
              {key}
            </kbd>
          ))}
        </div>
      )}
    </div>
  );
};

// Command palette component
export const A2RCommandPalette: React.FC = () => {
  const { results } = useMatches();

  return (
    <KBarPortal>
      <KBarPositioner style={{ zIndex: 10000 }}>
        <KBarAnimator className="max-w-[600px] w-full bg-white dark:bg-gray-900 rounded-lg shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <KBarSearch className="w-full px-4 py-3 outline-none bg-transparent" />
          <div className="max-h-[400px] overflow-y-auto px-2 pb-2">
            <KBarResults 
              items={results}
              onRender={renderResult}
              maxHeight={400}
            />
          </div>
        </KBarAnimator>
      </KBarPositioner>
    </KBarPortal>
  );
};

// Hook to use A2R commands
export const useA2RCommand = (action: A2RCommandAction) => {
  const transformedAction = useMemo(() => transformAction(action), [action]);
  useRegisterActions([transformedAction], [transformedAction]);
  
  const execute = useCallback(() => {
    if (action.perform) {
      action.perform();
    }
  }, [action]);

  return { execute };
};

export default A2RCommandProvider;
