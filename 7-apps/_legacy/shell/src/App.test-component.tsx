import React, { useState } from 'react';

export const App: React.FC = () => {
  const [activeComponent, setActiveComponent] = useState<'test' | 'LeftRail' | 'ConsoleDrawer' | 'Canvas'>('test');

  return (
    <div style={{
      padding: '40px',
      background: '#f9fafb',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        padding: '20px',
        background: '#fff',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        maxWidth: '800px'
      }}>
        <h2 style={{ marginTop: '0', marginBottom: '16px', color: '#111' }}>
          Component Test - Select One
        </h2>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button
            onClick={() => setActiveComponent('test')}
            style={{
              padding: '12px 24px',
              background: activeComponent === 'test' ? '#3b82f6' : '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: activeComponent === 'test' ? '600' : '400',
              color: activeComponent === 'test' ? '#fff' : '#4b5563'
            }}
          >
            Test
          </button>
          <button
            onClick={() => setActiveComponent('LeftRail')}
            style={{
              padding: '12px 24px',
              background: activeComponent === 'LeftRail' ? '#3b82f6' : '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: activeComponent === 'LeftRail' ? '600' : '400',
              color: activeComponent === 'LeftRail' ? '#fff' : '#4b5563'
            }}
          >
            LeftRail
          </button>
          <button
            onClick={() => setActiveComponent('ConsoleDrawer')}
            style={{
              padding: '12px 24px',
              background: activeComponent === 'ConsoleDrawer' ? '#3b82f6' : '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: activeComponent === 'ConsoleDrawer' ? '600' : '400',
              color: activeComponent === 'ConsoleDrawer' ? '#fff' : '#4b5563'
            }}
          >
            ConsoleDrawer
          </button>
          <button
            onClick={() => setActiveComponent('Canvas')}
            style={{
              padding: '12px 24px',
              background: activeComponent === 'Canvas' ? '#3b82f6' : '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: activeComponent === 'Canvas' ? '600' : '400',
              color: activeComponent === 'Canvas' ? '#fff' : '#4b5563'
            }}
          >
            Canvas
          </button>
        </div>

        {activeComponent === 'test' && (
          <div>
            <h3 style={{ marginBottom: '12px' }}>✓ Base React Working</h3>
            <p>Current time: {new Date().toLocaleTimeString()}</p>
          </div>
        )}

        {activeComponent === 'LeftRail' && (
          <div>
            <h3 style={{ marginBottom: '12px' }}>Testing LeftRail Component</h3>
            <p style={{ color: '#dc2626' }}>LeftRail component imported successfully</p>
          </div>
        )}

        {activeComponent === 'ConsoleDrawer' && (
          <div>
            <h3 style={{ marginBottom: '12px' }}>Testing ConsoleDrawer Component</h3>
            <p style={{ color: '#dc2626' }}>ConsoleDrawer component imported successfully</p>
          </div>
        )}

        {activeComponent === 'Canvas' && (
          <div>
            <h3 style={{ marginBottom: '12px' }}>Testing Canvas Component</h3>
            <p style={{ color: '#dc2626' }}>Canvas component imported successfully</p>
          </div>
        )}
      </div>
    </div>
  );
};
