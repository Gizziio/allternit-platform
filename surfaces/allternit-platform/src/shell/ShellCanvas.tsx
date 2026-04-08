import React from 'react';

export function ShellCanvas({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      height: '100%',
      width: '100%',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flex: 1
    }}>
      {children}
    </div>
  );
}
