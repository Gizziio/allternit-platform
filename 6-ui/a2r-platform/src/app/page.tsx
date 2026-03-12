'use client';

import React, { useState } from 'react';

// Minimal Shell UI demonstrating Plugin Manager features
export default function Home() {
  const [activeTab, setActiveTab] = useState<'plugins' | 'agents' | 'chat'>('plugins');

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      background: '#0a0a0a',
      color: '#e5e5e5',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Sidebar */}
      <div style={{
        width: '64px',
        background: '#141414',
        borderRight: '1px solid #262626',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 0',
        gap: '8px'
      }}>
        <NavButton 
          icon="🔌" 
          label="Plugins" 
          active={activeTab === 'plugins'} 
          onClick={() => setActiveTab('plugins')} 
        />
        <NavButton 
          icon="🤖" 
          label="Agents" 
          active={activeTab === 'agents'} 
          onClick={() => setActiveTab('agents')} 
        />
        <NavButton 
          icon="💬" 
          label="Chat" 
          active={activeTab === 'chat'} 
          onClick={() => setActiveTab('chat')} 
        />
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'plugins' && <PluginManagerView />}
        {activeTab === 'agents' && <AgentsView />}
        {activeTab === 'chat' && <ChatView />}
      </div>
    </div>
  );
}

function NavButton({ icon, label, active, onClick }: { 
  icon: string; 
  label: string; 
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: '48px',
        height: '48px',
        borderRadius: '12px',
        border: 'none',
        background: active ? '#3b82f6' : 'transparent',
        color: active ? 'white' : '#737373',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        transition: 'all 0.2s'
      }}
    >
      {icon}
    </button>
  );
}

function PluginManagerView() {
  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>Plugin Manager</h1>
      <p style={{ color: '#737373', marginBottom: '24px' }}>Manage your plugins and extensions</p>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '16px'
      }}>
        <PluginCard 
          name="A2rOS Integration"
          description="Super-Agent OS with program launcher"
          status="installed"
          version="1.0.0"
        />
        <PluginCard 
          name="Agent Communication"
          description="Real-time agent-to-agent messaging"
          status="installed"
          version="1.0.0"
        />
        <PluginCard 
          name="Canvas Renderer"
          description="Rich artifact rendering system"
          status="active"
          version="2.1.0"
        />
      </div>
    </div>
  );
}

function PluginCard({ name, description, status, version }: {
  name: string;
  description: string;
  status: string;
  version: string;
}) {
  return (
    <div style={{
      background: '#141414',
      border: '1px solid #262626',
      borderRadius: '12px',
      padding: '20px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <h3 style={{ fontWeight: 600 }}>{name}</h3>
        <span style={{
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          background: status === 'active' ? '#166534' : '#1e3a5f',
          color: status === 'active' ? '#86efac' : '#93c5fd'
        }}>
          {status}
        </span>
      </div>
      <p style={{ color: '#737373', fontSize: '14px', marginBottom: '12px' }}>{description}</p>
      <span style={{ fontSize: '12px', color: '#525252' }}>v{version}</span>
    </div>
  );
}

function AgentsView() {
  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600 }}>Agents</h1>
      <p style={{ color: '#737373', marginTop: '8px' }}>Agent management interface</p>
    </div>
  );
}

function ChatView() {
  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600 }}>Chat</h1>
      <p style={{ color: '#737373', marginTop: '8px' }}>Chat interface with A2rOS integration</p>
    </div>
  );
}
