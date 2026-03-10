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
        background: active ? 'rgba(212, 176, 140, 0.2)' : 'transparent',
        color: active ? '#d4b08c' : '#737373',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        fontSize: '20px',
        transition: 'all 0.2s'
      }}
    >
      {icon}
    </button>
  );
}

// Plugin Manager View with all implemented features
function PluginManagerView() {
  const [plugins, setPlugins] = useState([
    { id: '1', name: 'Analytics Plugin', version: '1.2.0', author: 'A2R Team', enabled: true, rating: 4.5, downloads: 1200, category: 'Analytics', description: 'Real-time analytics and metrics collection' },
    { id: '2', name: 'Data Processor', version: '2.0.1', author: 'DataTeam', enabled: false, rating: 4.2, downloads: 850, category: 'Data', description: 'Advanced data transformation pipelines' },
    { id: '3', name: 'ML Vision', version: '0.9.5', author: 'AI Labs', enabled: true, rating: 4.8, downloads: 2100, category: 'AI/ML', description: 'Computer vision and image analysis' },
    { id: '4', name: 'Cloud Sync', version: '1.5.0', author: 'CloudOps', enabled: false, rating: 3.9, downloads: 600, category: 'Cloud', description: 'Multi-cloud synchronization service' },
  ]);

  const [showInstallModal, setShowInstallModal] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);

  const togglePlugin = (id: string) => {
    setPlugins(plugins.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '32px'
      }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: 600 }}>Plugin Manager</h1>
          <p style={{ margin: 0, color: '#737373' }}>Manage your plugins and discover new ones</p>
        </div>
        <button
          onClick={() => setShowInstallModal(true)}
          style={{
            padding: '12px 24px',
            background: '#d4b08c',
            color: '#1a1a1a',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer'
          }}
        >
          + Install Plugin
        </button>
      </div>

      {/* Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: '16px',
        marginBottom: '32px'
      }}>
        <StatCard label="Installed" value={plugins.length.toString()} />
        <StatCard label="Enabled" value={plugins.filter(p => p.enabled).length.toString()} />
        <StatCard label="Available Updates" value="2" />
        <StatCard label="Total Downloads" value="4.8K" />
      </div>

      {/* Plugin List */}
      <div style={{ 
        background: '#141414', 
        borderRadius: '12px',
        border: '1px solid #262626'
      }}>
        {plugins.map((plugin, i) => (
          <div
            key={plugin.id}
            style={{
              padding: '20px 24px',
              borderBottom: i < plugins.length - 1 ? '1px solid #262626' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}
          >
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #d4b08c 0%, #8b7355 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              🔌
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, fontSize: '16px' }}>{plugin.name}</span>
                <span style={{ 
                  padding: '2px 8px', 
                  background: '#262626', 
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#a3a3a3'
                }}>
                  v{plugin.version}
                </span>
                {plugin.enabled && (
                  <span style={{
                    padding: '2px 8px',
                    background: 'rgba(34, 197, 94, 0.2)',
                    color: '#22c55e',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    Active
                  </span>
                )}
              </div>
              <div style={{ fontSize: '14px', color: '#737373', marginBottom: '4px' }}>
                by {plugin.author} • ⭐ {plugin.rating} • ⬇️ {plugin.downloads}
              </div>
              <div style={{ fontSize: '13px', color: '#525252' }}>
                {plugin.description}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setSelectedPlugin(plugin.id)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  color: '#a3a3a3',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Details
              </button>
              <button
                onClick={() => togglePlugin(plugin.id)}
                style={{
                  padding: '8px 16px',
                  background: plugin.enabled ? '#ef4444' : '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                {plugin.enabled ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showInstallModal && (
        <InstallModal onClose={() => setShowInstallModal(false)} />
      )}

      {selectedPlugin && (
        <PluginDetailsModal 
          plugin={plugins.find(p => p.id === selectedPlugin)!} 
          onClose={() => setSelectedPlugin(null)} 
        />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: '#141414',
      padding: '20px',
      borderRadius: '12px',
      border: '1px solid #262626'
    }}>
      <div style={{ fontSize: '12px', color: '#737373', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: '#d4b08c' }}>
        {value}
      </div>
    </div>
  );
}

function InstallModal({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInstall = async () => {
    setIsLoading(true);
    // Simulate installation
    await new Promise(r => setTimeout(r, 1500));
    setIsLoading(false);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#1a1a1a',
        padding: '32px',
        borderRadius: '16px',
        width: '500px',
        border: '1px solid #333'
      }}>
        <h2 style={{ margin: '0 0 8px 0' }}>Install Plugin</h2>
        <p style={{ margin: '0 0 24px 0', color: '#737373' }}>
          Enter the plugin URL or select from marketplace
        </p>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#737373', marginBottom: '8px', textTransform: 'uppercase' }}>
            Plugin URL
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/.../plugin.toml"
            style={{
              width: '100%',
              padding: '12px 16px',
              background: '#0a0a0a',
              border: '1px solid #333',
              borderRadius: '8px',
              color: '#e5e5e5',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ 
          padding: '12px', 
          background: '#0a0a0a', 
          borderRadius: '8px',
          marginBottom: '24px'
        }}>
          <div style={{ fontSize: '12px', color: '#737373', marginBottom: '8px' }}>
            Or choose from marketplace:
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['Analytics', 'ML', 'Cloud', 'Security'].map(cat => (
              <button
                key={cat}
                style={{
                  padding: '6px 12px',
                  background: '#262626',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#a3a3a3',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              border: '1px solid #333',
              borderRadius: '8px',
              color: '#e5e5e5',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleInstall}
            disabled={!url || isLoading}
            style={{
              padding: '10px 20px',
              background: '#d4b08c',
              border: 'none',
              borderRadius: '8px',
              color: '#1a1a1a',
              fontWeight: 500,
              cursor: !url || isLoading ? 'not-allowed' : 'pointer',
              opacity: !url || isLoading ? 0.5 : 1
            }}
          >
            {isLoading ? 'Installing...' : 'Install'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PluginDetailsModal({ plugin, onClose }: { plugin: any, onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#1a1a1a',
        padding: '32px',
        borderRadius: '16px',
        width: '500px',
        border: '1px solid #333'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #d4b08c 0%, #8b7355 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px'
          }}>
            🔌
          </div>
          <div>
            <h2 style={{ margin: '0 0 4px 0' }}>{plugin.name}</h2>
            <p style={{ margin: 0, color: '#737373' }}>by {plugin.author}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: '#0a0a0a', padding: '12px', borderRadius: '8px' }}>
            <div style={{ fontSize: '11px', color: '#737373', textTransform: 'uppercase' }}>Version</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>{plugin.version}</div>
          </div>
          <div style={{ background: '#0a0a0a', padding: '12px', borderRadius: '8px' }}>
            <div style={{ fontSize: '11px', color: '#737373', textTransform: 'uppercase' }}>Rating</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>⭐ {plugin.rating}</div>
          </div>
          <div style={{ background: '#0a0a0a', padding: '12px', borderRadius: '8px' }}>
            <div style={{ fontSize: '11px', color: '#737373', textTransform: 'uppercase' }}>Downloads</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>{plugin.downloads}</div>
          </div>
          <div style={{ background: '#0a0a0a', padding: '12px', borderRadius: '8px' }}>
            <div style={{ fontSize: '11px', color: '#737373', textTransform: 'uppercase' }}>Category</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>{plugin.category}</div>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>Description</h3>
          <p style={{ margin: 0, color: '#a3a3a3', lineHeight: 1.5 }}>{plugin.description}</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              border: '1px solid #333',
              borderRadius: '8px',
              color: '#e5e5e5',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
          <button
            style={{
              padding: '10px 20px',
              background: plugin.enabled ? '#ef4444' : '#22c55e',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            {plugin.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Placeholder views
function AgentsView() {
  return (
    <div style={{ padding: '32px' }}>
      <h1>Agents</h1>
      <p>Agent management coming soon...</p>
    </div>
  );
}

function ChatView() {
  return (
    <div style={{ padding: '32px' }}>
      <h1>Chat</h1>
      <p>Chat interface coming soon...</p>
    </div>
  );
}
