import React, { useState, useEffect } from 'react';

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

  useEffect(() => {
    const fetchTools = async () => {
      try {
        // In a real implementation, this would call the actual tool registry
        // For now, using mock data to demonstrate the UI
        const mockTools: Tool[] = [
          {
            id: 'tool-001',
            name: 'read_file',
            description: 'Reads content from a file',
            category: 'filesystem',
            status: 'enabled',
            riskLevel: 'low',
            lastUsed: '2026-02-03T10:15:22Z',
            usageCount: 42
          },
          {
            id: 'tool-002',
            name: 'write_file',
            description: 'Writes content to a file',
            category: 'filesystem',
            status: 'enabled',
            riskLevel: 'medium',
            lastUsed: '2026-02-03T09:42:11Z',
            usageCount: 31
          },
          {
            id: 'tool-003',
            name: 'execute_command',
            description: 'Executes a shell command',
            category: 'execution',
            status: 'restricted',
            riskLevel: 'high',
            lastUsed: '2026-02-02T15:30:45Z',
            usageCount: 17
          },
          {
            id: 'tool-004',
            name: 'web_search',
            description: 'Performs a web search',
            category: 'network',
            status: 'enabled',
            riskLevel: 'low',
            lastUsed: '2026-02-03T11:20:33Z',
            usageCount: 89
          },
          {
            id: 'tool-005',
            name: 'browser_control',
            description: 'Controls the embedded browser',
            category: 'browser',
            status: 'enabled',
            riskLevel: 'medium',
            lastUsed: '2026-02-03T10:55:18Z',
            usageCount: 23
          }
        ];
        
        setTools(mockTools);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching tools:', err);
        setError('Failed to load tools from registry');
        setTools([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTools();
  }, []);

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
              // Refresh the tools list
              const refreshTools = async () => {
                try {
                  setLoading(true);
                  // In a real implementation, this would call the actual tool registry
                  // For now, using mock data to demonstrate the UI
                  const mockTools: Tool[] = [
                    {
                      id: 'tool-001',
                      name: 'read_file',
                      description: 'Reads content from a file',
                      category: 'filesystem',
                      status: 'enabled',
                      riskLevel: 'low',
                      lastUsed: '2026-02-03T10:15:22Z',
                      usageCount: 42
                    },
                    {
                      id: 'tool-002',
                      name: 'write_file',
                      description: 'Writes content to a file',
                      category: 'filesystem',
                      status: 'enabled',
                      riskLevel: 'medium',
                      lastUsed: '2026-02-03T09:42:11Z',
                      usageCount: 31
                    },
                    {
                      id: 'tool-003',
                      name: 'execute_command',
                      description: 'Executes a shell command',
                      category: 'execution',
                      status: 'restricted',
                      riskLevel: 'high',
                      lastUsed: '2026-02-02T15:30:45Z',
                      usageCount: 17
                    },
                    {
                      id: 'tool-004',
                      name: 'web_search',
                      description: 'Performs a web search',
                      category: 'network',
                      status: 'enabled',
                      riskLevel: 'low',
                      lastUsed: '2026-02-03T11:20:33Z',
                      usageCount: 89
                    },
                    {
                      id: 'tool-005',
                      name: 'browser_control',
                      description: 'Controls the embedded browser',
                      category: 'browser',
                      status: 'enabled',
                      riskLevel: 'medium',
                      lastUsed: '2026-02-03T10:55:18Z',
                      usageCount: 23
                    }
                  ];
                  
                  setTools(mockTools);
                  setError(null);
                } catch (err: any) {
                  console.error('Error refreshing tools:', err);
                  setError('Failed to refresh tools from registry');
                } finally {
                  setLoading(false);
                }
              };
              
              refreshTools();
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