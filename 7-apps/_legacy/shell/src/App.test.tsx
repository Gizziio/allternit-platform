import React from 'react';

export const App: React.FC = () => {
  return (
    <div style={{
      padding: '40px',
      background: '#f9fafb',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1 style={{ color: '#111', marginBottom: '20px' }}>
        A2rchitech Shell - Test Render
      </h1>
      <p style={{ color: '#4b5563', lineHeight: '1.6' }}>
        If you can see this text, React is working.
      </p>
      <div style={{
        padding: '20px',
        background: '#fff',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        maxWidth: '600px'
      }}>
        <h2 style={{ marginTop: '0', marginBottom: '16px', color: '#111' }}>
          Canonical UI Components
        </h2>
        <ul style={{ color: '#4b5563', paddingLeft: '20px' }}>
          <li style={{ marginBottom: '8px' }}>✓ LeftRail</li>
          <li style={{ marginBottom: '8px' }}>✓ ConsoleDrawer</li>
          <li style={{ marginBottom: '8px' }}>✓ Canvas</li>
          <li style={{ marginBottom: '8px' }}>✓ VoiceOrb</li>
          <li style={{ marginBottom: '8px' }}>✓ SplitPane</li>
          <li style={{ marginBottom: '8px' }}>✓ EvidenceRail</li>
          <li style={{ marginBottom: '8px' }}>✓ ActionDock</li>
        </ul>
        <p style={{ marginTop: '20px', color: '#dc2626', fontWeight: '600' }}>
          Current time: {new Date().toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
};
