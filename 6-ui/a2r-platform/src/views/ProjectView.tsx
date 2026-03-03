import React from 'react';
import { useChatStore } from './chat/ChatStore';
import { GlassCard } from '../design/GlassCard';
import { tokens } from '../design/tokens';
import { 
  FolderOpen, 
  FilePlus, 
  ChatText, 
  Plus,
  Clock,
  ArrowSquareOut
} from '@phosphor-icons/react';

export function ProjectView() {
  const { projects, activeProjectId, threads, setActiveThread, addFileToProject } = useChatStore();
  const project = projects.find(p => p.id === activeProjectId);

  if (!project) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
      Select a project to view context and sessions
    </div>
  );

  const projectThreads = threads.filter(t => t.projectId === project.id);

  return (
    <div style={{ padding: 40, height: '100%', overflowY: 'auto', background: 'var(--bg-primary)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* Project Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ 
              width: 56, height: 56, borderRadius: 16, background: 'rgba(0, 122, 255, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-chat)'
            }}>
              <FolderOpen size={32} weight="duotone" />
            </div>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0 }}>{project.title}</h1>
              <div style={{ fontSize: 14, opacity: 0.5, marginTop: 4 }}>Created on {new Date(project.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
          
          <button 
            onClick={() => {
              const name = prompt('File Name:');
              if (name) addFileToProject(project.id, { name, size: 1024, type: 'text/markdown' });
            }}
            style={{
              background: 'var(--accent-chat)', color: 'white', border: 'none', borderRadius: 12,
              padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10,
              fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,122,255,0.3)'
            }}
          >
            <Plus size={18} weight="bold" />
            Add Files
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 40 }}>
          {/* Main List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <section>
              <h3 style={{ fontSize: 13, fontWeight: 700, opacity: 0.4, textTransform: 'uppercase', marginBottom: 16, letterSpacing: '0.05em' }}>Saved Sessions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {projectThreads.length === 0 ? (
                  <div style={{ padding: '40px', border: '2px dashed var(--border-subtle)', borderRadius: 20, textAlign: 'center', opacity: 0.5 }}>
                    No sessions saved to this project yet.
                  </div>
                ) : (
                  projectThreads.map(t => (
                    <button 
                      key={t.id}
                      onClick={() => setActiveThread(t.id)}
                      style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', width: '100%' }}
                    >
                      <GlassCard style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                        <ChatText size={20} weight="duotone" color="var(--accent-chat)" />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{t.title}</div>
                          <div style={{ fontSize: 12, opacity: 0.4 }}>Last active recently</div>
                        </div>
                        <ArrowSquareOut size={18} style={{ opacity: 0.3 }} />
                      </GlassCard>
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <section>
              <h3 style={{ fontSize: 13, fontWeight: 700, opacity: 0.4, textTransform: 'uppercase', marginBottom: 16, letterSpacing: '0.05em' }}>Context Files</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {project.files.map(f => (
                  <div key={f.id} style={{ 
                    padding: '10px 12px', borderRadius: 10, background: 'var(--bg-secondary)',
                    display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600
                  }}>
                    <FilePlus size={16} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                  </div>
                ))}
                <button style={{ 
                  padding: '10px', borderRadius: 10, border: '1px dashed var(--border-subtle)', background: 'none',
                  color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                }}>
                  + Upload Document
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
