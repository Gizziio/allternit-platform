import React, { useState } from 'react';
import { GlassCard } from '../../design/GlassCard';
import { useRunnerStore } from '../../runner/runner.store';
import { PatchGate } from './PatchGate';
import {
  CheckCircle,
  Download,
  FileText,
  GitDiff,
  Package,
  Plus,
  Trash,
  TreeStructure,
  X,
} from '@phosphor-icons/react';

type InspectorTab = 'diff' | 'patch' | 'files' | 'plan' | 'artifacts';

interface ContextFile {
  name: string;
  language: string;
  lines: number;
  type: 'typescript' | 'json' | 'markdown';
}

interface GeneratedArtifact {
  name: string;
  type: string;
  lines: number;
  generatedTime: string;
  fileType: 'typescript' | 'markdown';
}


const inspectorBodyStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  background: 'transparent',
};

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: 0.55,
  margin: 0,
};

const panelButtonStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: 999,
  border: '1px solid rgba(255, 255, 255, 0.08)',
  background: 'rgba(255, 255, 255, 0.04)',
  color: 'var(--text-secondary)',
  fontSize: 10,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
};

const listContainerStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const metadataPillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 6px',
  borderRadius: 999,
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
};

const getFileIcon = (type: 'typescript' | 'json' | 'markdown'): React.ReactNode => {
  switch (type) {
    case 'typescript':
      return (
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: '#3178c6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 700,
            color: 'white',
          }}
        >
          TS
        </div>
      );
    case 'json':
      return (
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: '#f9d423',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 700,
            color: '#333',
          }}
        >
          {'{}'}
        </div>
      );
    case 'markdown':
      return (
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: '#083fa1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 700,
            color: 'white',
          }}
        >
          MD
        </div>
      );
  }
};

export function InspectorStack() {
  const activeRun = useRunnerStore((state) => state.activeRun);
  const [activeTab, setActiveTab] = useState<InspectorTab>('diff');
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
      <div
        style={{
          padding: '14px 14px 12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(13, 16, 20, 0.74)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 4,
              }}
            >
              Inspector
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              Diff, patches, context, artifacts
            </div>
          </div>
          <div
            style={{
              padding: '4px 8px',
              borderRadius: 999,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255, 255, 255, 0.06)',
              color: 'var(--text-secondary)',
              fontSize: 10,
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            {activeRun ? `${activeRun.state.toUpperCase()} RUN` : 'IDLE'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Tab id="diff" icon={GitDiff} active={activeTab === 'diff'} onClick={setActiveTab} />
          <Tab id="patch" icon={CheckCircle} active={activeTab === 'patch'} onClick={setActiveTab} />
          <Tab id="files" icon={FileText} active={activeTab === 'files'} onClick={setActiveTab} />
          <Tab id="plan" icon={TreeStructure} active={activeTab === 'plan'} onClick={setActiveTab} />
          <Tab id="artifacts" icon={Package} active={activeTab === 'artifacts'} onClick={setActiveTab} />
        </div>
      </div>

      <div style={inspectorBodyStyle}>
        {activeTab === 'diff' && <PatchGate />}
        {activeTab === 'patch' && <PatchGate />}

        {activeTab === 'files' && (
          <div style={inspectorBodyStyle}>
            <div
              style={{
                padding: '14px 16px 12px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <h3 style={sectionHeadingStyle}>Context Attachments</h3>
            </div>

            <div style={listContainerStyle}>
              {contextFiles.map((file, index) => (
                <GlassCard
                  key={index}
                  style={{
                    padding: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    justifyContent: 'space-between',
                    background: 'rgba(16, 19, 22, 0.22)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.12)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    {getFileIcon(file.type)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {file.name}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--text-tertiary)',
                          marginTop: 4,
                          display: 'flex',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={metadataPillStyle}>{file.language}</span>
                        <span>{`${file.lines} lines`}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setContextFiles((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}
                    style={{
                      padding: 4,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={16} />
                  </button>
                </GlassCard>
              ))}
            </div>

            <div style={{ padding: 12, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <button style={{ ...panelButtonStyle, width: '100%', justifyContent: 'center', padding: '10px 12px' }}>
                <Plus size={14} weight="fill" />
                Add File
              </button>
            </div>
          </div>
        )}

        {activeTab === 'artifacts' && (
          <div style={inspectorBodyStyle}>
            <div
              style={{
                padding: '14px 16px 12px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <h3 style={sectionHeadingStyle}>Generated Artifacts</h3>
              <button style={panelButtonStyle}>
                <Trash size={12} />
                Clear All
              </button>
            </div>

            <div style={listContainerStyle}>
              {([] as GeneratedArtifact[]).map((artifact, index) => (
                <GlassCard
                  key={index}
                  style={{
                    padding: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    justifyContent: 'space-between',
                    background: 'rgba(16, 19, 22, 0.22)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.12)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    {getFileIcon(artifact.fileType)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {artifact.name}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--text-tertiary)',
                          marginTop: 4,
                          display: 'flex',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={metadataPillStyle}>{artifact.type}</span>
                        <span>{`${artifact.lines} lines`}</span>
                        <span>{`Generated ${artifact.generatedTime}`}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      style={{
                        padding: '4px 8px',
                        borderRadius: 999,
                        border: 'none',
                        background: 'var(--accent-chat)',
                        color: 'white',
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      View
                    </button>
                    <button style={panelButtonStyle}>
                      <Download size={14} />
                    </button>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'plan' && (
          <div style={{ padding: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
            {activeRun ? `Run ${activeRun.id.slice(0, 8)}: ${activeRun.state.toUpperCase()}` : 'No Active Run'}
          </div>
        )}
      </div>
    </div>
  );
}

function Tab({
  id,
  icon: Icon,
  active,
  onClick,
}: {
  id: InspectorTab;
  icon: React.ComponentType<any>;
  active: boolean;
  onClick: (id: InspectorTab) => void;
}) {
  return (
    <button
      onClick={() => onClick(id)}
      style={{
        padding: '8px 10px',
        borderRadius: 999,
        background: active ? 'rgba(217, 119, 87, 0.18)' : 'rgba(255, 255, 255, 0.04)',
        border: active ? '1px solid rgba(217, 119, 87, 0.35)' : '1px solid rgba(255, 255, 255, 0.06)',
        color: active ? 'var(--accent-chat)' : 'var(--text-tertiary)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minWidth: 40,
      }}
    >
      <Icon size={16} weight={active ? 'duotone' : 'regular'} />
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{id}</span>
    </button>
  );
}
