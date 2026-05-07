import React from 'react';
import type { ViewContext } from '../../nav/nav.types';

export function BrowserCapsuleReal({ context }: { context: ViewContext }) {
  return (
    <div style={{ padding: 20 }}>
      <h3>Browser Capsule (Real)</h3>
      <p>View ID: {context.viewId}</p>
    </div>
  );
}
