'use client';

import React, { useState } from 'react';
import {
  MicrosoftWordLogo,
  MicrosoftExcelLogo,
  FilePpt,
  PuzzlePiece,
  Globe,
  Desktop,
  ArrowSquareOut,
  CheckCircle,
} from '@phosphor-icons/react';

interface AddinCardProps {
  icon: React.ReactNode;
  name: string;
  description: string;
  desktopScheme: string;
  webUrl: string;
  accentColor: string;
}

function AddinCard({ icon, name, description, desktopScheme, webUrl, accentColor }: AddinCardProps) {
  const [desktopLaunched, setDesktopLaunched] = useState(false);

  const handleDesktop = () => {
    window.location.href = desktopScheme;
    setDesktopLaunched(true);
    setTimeout(() => setDesktopLaunched(false), 2500);
  };

  const handleWeb = () => {
    window.open(webUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div style={{
      background: 'var(--surface-elevated)',
      border: '1px solid var(--ui-border-muted)',
      borderRadius: 12,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40,
          borderRadius: 10,
          background: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ui-text-primary)' }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--ui-text-muted)', marginTop: 2 }}>{description}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleDesktop}
          style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 12px',
            background: desktopLaunched ? 'color-mix(in srgb, var(--status-success) 12%, transparent)' : 'var(--surface-overlay)',
            border: `1px solid ${desktopLaunched ? 'var(--status-success)' : 'var(--ui-border-muted)'}`,
            borderRadius: 8,
            color: desktopLaunched ? 'var(--status-success)' : 'var(--ui-text-secondary)',
            fontSize: 12, fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {desktopLaunched
            ? <><CheckCircle size={14} /> Launched</>
            : <><Desktop size={14} /> Desktop App</>
          }
        </button>
        <button
          onClick={handleWeb}
          style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 12px',
            background: `color-mix(in srgb, ${accentColor} 8%, transparent)`,
            border: `1px solid color-mix(in srgb, ${accentColor} 20%, transparent)`,
            borderRadius: 8,
            color: accentColor,
            fontSize: 12, fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = `color-mix(in srgb, ${accentColor} 16%, transparent)`; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = `color-mix(in srgb, ${accentColor} 8%, transparent)`; }}
        >
          <Globe size={14} /> Web App <ArrowSquareOut size={11} />
        </button>
      </div>
    </div>
  );
}

export function BrowserExtensionsView() {
  return (
    <div style={{
      height: '100%',
      overflow: 'auto',
      background: 'var(--view-browser-bg, var(--surface-canvas))',
      padding: '32px 32px 48px',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <PuzzlePiece size={20} color="var(--accent-primary)" weight="fill" />
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ui-text-primary)', margin: 0 }}>Extensions</h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ui-text-muted)', margin: 0 }}>
          Allternit add-ins and integrations for your productivity tools.
        </p>
      </div>

      {/* Microsoft Office Add-ins */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--ui-text-muted)',
          marginBottom: 14,
        }}>
          Microsoft Office
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          <AddinCard
            icon={<MicrosoftWordLogo size={20} color="#2B579A" weight="fill" />}
            name="Word Add-in"
            description="Allternit AI writing assistant for Word"
            desktopScheme="ms-word:"
            webUrl="https://word.office.com"
            accentColor="#2B579A"
          />
          <AddinCard
            icon={<MicrosoftExcelLogo size={20} color="#217346" weight="fill" />}
            name="Excel Add-in"
            description="Data analysis and formula assistant for Excel"
            desktopScheme="ms-excel:"
            webUrl="https://excel.office.com"
            accentColor="#217346"
          />
          <AddinCard
            icon={<FilePpt size={20} color="#D24726" weight="fill" />}
            name="PowerPoint Add-in"
            description="Slide design and content generation for PowerPoint"
            desktopScheme="ms-powerpoint:"
            webUrl="https://powerpoint.office.com"
            accentColor="#D24726"
          />
        </div>
      </div>

      {/* Open Source Alternatives */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--ui-text-muted)',
          marginBottom: 14,
        }}>
          Open Source Alternatives
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          <AddinCard
            icon={<span style={{ fontSize: 18 }}>📄</span>}
            name="Writer"
            description="Allternit-powered document editor (open source)"
            desktopScheme=""
            webUrl="https://onlyoffice.com"
            accentColor="var(--accent-primary)"
          />
          <AddinCard
            icon={<span style={{ fontSize: 18 }}>📊</span>}
            name="Spreadsheet"
            description="Allternit-powered spreadsheet editor (open source)"
            desktopScheme=""
            webUrl="https://onlyoffice.com"
            accentColor="var(--accent-primary)"
          />
          <AddinCard
            icon={<span style={{ fontSize: 18 }}>📊</span>}
            name="Presentation"
            description="Allternit-powered slide editor (open source)"
            desktopScheme=""
            webUrl="https://onlyoffice.com"
            accentColor="var(--accent-primary)"
          />
        </div>
      </div>

      {/* More coming */}
      <div style={{
        padding: '20px 24px',
        background: 'color-mix(in srgb, var(--accent-primary) 6%, transparent)',
        border: '1px dashed color-mix(in srgb, var(--accent-primary) 20%, transparent)',
        borderRadius: 12,
        color: 'var(--ui-text-muted)',
        fontSize: 13,
        textAlign: 'center',
      }}>
        More extensions coming soon — Canvas LMS, Summit Academy, and custom connectors.
      </div>
    </div>
  );
}
