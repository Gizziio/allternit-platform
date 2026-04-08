import React, { useState, useEffect, useCallback } from 'react';
import { getAllToolDefinitions } from '@/lib/agents/tools';

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'enabled' | 'disabled' | 'restricted';
  riskLevel: 'low' | 'medium' | 'high';
  lastUsed?: string;
  usageCount?: number;
}

export function ToolsView() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const loadTools = useCallback(() => {
    try {
      const defs = getAllToolDefinitions();
      const mapped: Tool[] = defs.map((def) => ({
        id: def.name,
        name: def.name,
        description: String(def.description).split('\n')[0],
        category: def.name.split('_')[0],
        status: 'enabled' as const,
        riskLevel: 'low' as const,
      }));
      setTools(mapped);
      setError(null);
    } catch (err: any) {
      setError('Failed to load tools from registry');
      setTools([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTools();
  }, [loadTools]);

  const filteredTools = filter === 'all' 
    ? tools 
    : tools.filter(tool => tool.status === filter);

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading tools from registry...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, textAlign: 'center', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#ff3b30' }}>
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontWeight: 600 }}>Available Tools</h2>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ 
              padding: '6px 12px', 
              border: '1px solid var(--border-default)', 
              borderRadius: 4,
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)'
            }}
          >
            <option value="all">All Tools</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
            <option value="restricted">Restricted</option>
          </select>
          
          <button 
            style={{ 
              padding: '6px 12px', 
              border: '1px solid var(--border-default)', 
              borderRadius: 4,
              backgroundColor: 'var(--bg-tertiary)',
              cursor: 'pointer'
            }}
            onClick={() => {
              setLoading(true);
              loadTools();
            }}
          >
            Refresh
          </button>
        </div>
      </div>
      
      <div style={{ display: 'grid', gap: 12 }}>
        {filteredTools.map(tool => (
          <div 
            key={tool.id} 
            style={{ 
              padding: 16, 
              border: '1px solid var(--border-default)', 
              borderRadius: 8,
              backgroundColor: 'var(--bg-secondary)',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 600, fontSize: 16 }}>{tool.name}</h3>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <span style={{ 
                    padding: '2px 6px', 
                    borderRadius: 4, 
                    fontSize: 11,
                    backgroundColor: 
                      tool.status === 'enabled' ? 'rgba(52, 199, 89, 0.1)' :
                      tool.status === 'disabled' ? 'rgba(88, 86, 91, 0.1)' : 'rgba(255, 149, 0, 0.1)',
                    color:
                      tool.status === 'enabled' ? '#34C759' :
                      tool.status === 'disabled' ? '#58565B' : '#FF9500'
                  }}>
                    {tool.status.toUpperCase()}
                  </span>
                  
                  <span style={{ 
                    padding: '2px 6px', 
                    borderRadius: 4, 
                    fontSize: 11,
                    backgroundColor: 
                      tool.riskLevel === 'low' ? 'rgba(52, 199, 89, 0.1)' :
                      tool.riskLevel === 'medium' ? 'rgba(255, 149, 0, 0.1)' : 'rgba(255, 59, 48, 0.1)',
                    color:
                      tool.riskLevel === 'low' ? '#34C759' :
                      tool.riskLevel === 'medium' ? '#FF9500' : '#FF3B30'
                  }}>
                    {tool.riskLevel.toUpperCase()} RISK
                  </span>
                  
                  <span style={{ 
                    padding: '2px 6px', 
                    borderRadius: 4, 
                    fontSize: 11,
                    backgroundColor: 'rgba(88, 86, 91, 0.1)',
                    color: '#58565B'
                  }}>
                    {tool.category.toUpperCase()}
                  </span>
                </div>
              </div>
              
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'right' }}>
                <div>Used: {tool.usageCount || 0}</div>
                {tool.lastUsed && <div>Last: {new Date(tool.lastUsed).toLocaleDateString()}</div>}
              </div>
            </div>
            
            <p style={{ margin: '8px 0 12px 0', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {tool.description}
            </p>
            
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                style={{ 
                  padding: '6px 12px', 
                  border: '1px solid var(--border-default)', 
                  borderRadius: 4,
                  backgroundColor: 'var(--bg-tertiary)',
                  cursor: tool.status === 'disabled' ? 'not-allowed' : 'pointer',
                  opacity: tool.status === 'disabled' ? 0.6 : 1
                }}
                disabled={tool.status === 'disabled'}
              >
                Execute
              </button>
              <button 
                style={{ 
                  padding: '6px 12px', 
                  border: '1px solid var(--border-default)', 
                  borderRadius: 4,
                  backgroundColor: 'var(--bg-tertiary)'
                }}
              >
                View Details
              </button>
              <button 
                style={{ 
                  padding: '6px 12px', 
                  border: '1px solid var(--border-default)', 
                  borderRadius: 4,
                  backgroundColor: 'var(--bg-tertiary)'
                }}
              >
                Permissions
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}