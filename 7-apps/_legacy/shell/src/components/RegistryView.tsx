import * as React from 'react';
import { useState } from 'react';

export const RegistryView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'agents' | 'tools' | 'skills' | 'workflows'>('agents');
  const [searchTerm, setSearchTerm] = useState('');

  // Mock data for registry entries
  const registryData = {
    agents: [
      { id: 'agent-1', name: 'CodeGen Agent', version: '1.2.3', status: 'active', permissions: 'code', dependencies: ['git', 'npm'], usedBy: 5 },
      { id: 'agent-2', name: 'TestBot', version: '0.9.1', status: 'beta', permissions: 'read', dependencies: ['jest'], usedBy: 3 },
      { id: 'agent-3', name: 'DeployMaster', version: '2.1.0', status: 'active', permissions: 'write', dependencies: ['kubectl', 'docker'], usedBy: 8 }
    ],
    tools: [
      { id: 'tool-1', name: 'Git Integration', version: '1.0.0', status: 'active', permissions: 'read', dependencies: [], usedBy: 12 },
      { id: 'tool-2', name: 'Docker Wrapper', version: '1.5.2', status: 'active', permissions: 'write', dependencies: [], usedBy: 7 },
      { id: 'tool-3', name: 'API Client', version: '0.8.3', status: 'deprecated', permissions: 'read', dependencies: [], usedBy: 2 }
    ],
    skills: [
      { id: 'skill-1', name: 'Code Review', version: '1.1.0', status: 'active', permissions: 'read', dependencies: ['lint'], usedBy: 6 },
      { id: 'skill-2', name: 'Documentation', version: '0.7.5', status: 'active', permissions: 'write', dependencies: ['markdown'], usedBy: 4 }
    ],
    workflows: [
      { id: 'wf-1', name: 'CI/CD Pipeline', version: '2.3.1', status: 'active', permissions: 'admin', dependencies: ['docker', 'kubectl'], usedBy: 10 },
      { id: 'wf-2', name: 'Data Processing', version: '1.0.0', status: 'active', permissions: 'read', dependencies: ['spark'], usedBy: 3 }
    ]
  };

  const filteredData = registryData[activeSection].filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="registry-view" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div className="registry-header" style={{
        padding: '16px',
        borderBottom: '1px solid #e2e8f0',
        backgroundColor: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{
          margin: 0,
          fontSize: '24px',
          color: '#1e293b',
          fontWeight: '600'
        }}>
          Registry - Authoritative Catalog
        </h1>
        <div className="registry-search" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <input
            type="text"
            placeholder="Search registry..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              width: '250px'
            }}
          />
        </div>
      </div>

      <div className="registry-nav" style={{
        display: 'flex',
        borderBottom: '1px solid #e2e8f0',
        backgroundColor: 'white'
      }}>
        <button
          className={`nav-btn ${activeSection === 'agents' ? 'active' : ''}`}
          onClick={() => setActiveSection('agents')}
          style={{
            padding: '12px 20px',
            border: 'none',
            borderBottom: activeSection === 'agents' ? '3px solid #3b82f6' : '3px solid transparent',
            backgroundColor: activeSection === 'agents' ? '#eff6ff' : 'transparent',
            color: activeSection === 'agents' ? '#3b82f6' : '#64748b',
            fontWeight: activeSection === 'agents' ? '600' : 'normal',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Agents ({registryData.agents.length})
        </button>
        <button
          className={`nav-btn ${activeSection === 'tools' ? 'active' : ''}`}
          onClick={() => setActiveSection('tools')}
          style={{
            padding: '12px 20px',
            border: 'none',
            borderBottom: activeSection === 'tools' ? '3px solid #3b82f6' : '3px solid transparent',
            backgroundColor: activeSection === 'tools' ? '#eff6ff' : 'transparent',
            color: activeSection === 'tools' ? '#3b82f6' : '#64748b',
            fontWeight: activeSection === 'tools' ? '600' : 'normal',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Tools ({registryData.tools.length})
        </button>
        <button
          className={`nav-btn ${activeSection === 'skills' ? 'active' : ''}`}
          onClick={() => setActiveSection('skills')}
          style={{
            padding: '12px 20px',
            border: 'none',
            borderBottom: activeSection === 'skills' ? '3px solid #3b82f6' : '3px solid transparent',
            backgroundColor: activeSection === 'skills' ? '#eff6ff' : 'transparent',
            color: activeSection === 'skills' ? '#3b82f6' : '#64748b',
            fontWeight: activeSection === 'skills' ? '600' : 'normal',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Skills ({registryData.skills.length})
        </button>
        <button
          className={`nav-btn ${activeSection === 'workflows' ? 'active' : ''}`}
          onClick={() => setActiveSection('workflows')}
          style={{
            padding: '12px 20px',
            border: 'none',
            borderBottom: activeSection === 'workflows' ? '3px solid #3b82f6' : '3px solid transparent',
            backgroundColor: activeSection === 'workflows' ? '#eff6ff' : 'transparent',
            color: activeSection === 'workflows' ? '#3b82f6' : '#64748b',
            fontWeight: activeSection === 'workflows' ? '600' : 'normal',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Workflows ({registryData.workflows.length})
        </button>
      </div>

      <div className="registry-content" style={{
        flex: 1,
        padding: '24px',
        overflow: 'auto',
        backgroundColor: '#f1f5f9'
      }}>
        <div className="registry-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '20px'
        }}>
          {filteredData.map((item) => (
            <div key={item.id} className="registry-card" style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              position: 'relative'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <h3 style={{ margin: '0 0 4px 0', color: '#1e293b', fontSize: '16px' }}>{item.name}</h3>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  backgroundColor: item.status === 'active' ? '#dcfce7' : 
                                 item.status === 'beta' ? '#fef3c7' : 
                                 item.status === 'deprecated' ? '#fee2e2' : '#e2e8f0',
                  color: item.status === 'active' ? '#16a34a' : 
                        item.status === 'beta' ? '#ca8a04' : 
                        item.status === 'deprecated' ? '#dc2626' : '#64748b'
                }}>
                  {item.status}
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', fontSize: '14px' }}>
                <div>
                  <strong>Version:</strong> {item.version}
                </div>
                <div>
                  <strong>Perm:</strong> {item.permissions}
                </div>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <strong>Dependencies:</strong> {item.dependencies.length > 0 ? item.dependencies.join(', ') : 'None'}
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <strong>Used by:</strong> {item.usedBy} {item.usedBy === 1 ? 'workflow' : 'workflows'}
              </div>
              
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button style={{
                  flex: 1,
                  padding: '8px 12px',
                  backgroundColor: '#e2e8f0',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}>
                  Edit
                </button>
                <button style={{
                  flex: 1,
                  padding: '8px 12px',
                  backgroundColor: '#e2e8f0',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}>
                  Test
                </button>
                <button style={{
                  flex: 1,
                  padding: '8px 12px',
                  backgroundColor: '#e2e8f0',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}>
                  Version
                </button>
              </div>
            </div>
          ))}
        </div>
        
        {filteredData.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#94a3b8'
          }}>
            <p>No {activeSection} found matching "{searchTerm}"</p>
          </div>
        )}
      </div>
    </div>
  );
};