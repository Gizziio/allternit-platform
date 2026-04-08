import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Monitor,
  Cloud,
  Code,
  Terminal,
  Laptop,
  Globe,
  DownloadSimple,
  Sparkle,
  X,
  PuzzlePiece as Puzzle,
  HardDrives,
  Cpu,
  Shield,
  RocketLaunch,
  ArrowRight,
  Key,
  Stack,
  Cursor,
  Chat,
  Camera,
  FileText,
  TextT,
  Lightning,
  CheckCircle,
  Copy,
  ArrowSquareOut,
  CaretRight,
  Play,
  Cube,
  Wrench,
  Eye,
  Command,
  Storefront,
  ShoppingBag,
} from '@phosphor-icons/react';
import { GizziMascot } from '@/components/ai-elements/GizziMascot';
import { MatrixLogo } from '@/components/ai-elements/MatrixLogo';

// Platform-specific icons
const AppleIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);

const WindowsIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 12V6.75l6-1.32v6.48L3 12m17-9v8.75l-10 .15V5.21L20 3M3 13l6 .09v6.81l-6-1.15V13m17 .25V22l-10-1.91V13.1l10 .15z"/>
  </svg>
);

const LinuxIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489.117.779.437 1.512.913 2.13.476.618 1.092 1.116 1.804 1.456.712.34 1.51.52 2.354.52.845 0 1.642-.18 2.354-.52.712-.34 1.328-.838 1.804-1.456.476-.618.796-1.351.913-2.13.123-.805-.009-1.657-.287-2.489-.589-1.771-1.831-3.47-2.716-4.521-.75-1.067-.974-1.928-1.05-3.02-.065-1.491 1.056-5.965-3.17-6.298-.165-.013-.325-.021-.48-.021zm-.504 2.473c.495 0 .9.405.9.9s-.405.9-.9.9-.9-.405-.9-.9.405-.9.9-.9zm-2.5 1.5c.276 0 .5.224.5.5s-.224.5-.5.5-.5-.224-.5-.5.224-.5.5-.5zm5 0c.276 0 .5.224.5.5s-.224.5-.5.5-.5-.224-.5-.5.224-.5.5-.5zm-6.5 2c.276 0 .5.224.5.5s-.224.5-.5.5-.5-.224-.5-.5.224-.5.5-.5zm8 0c.276 0 .5.224.5.5s-.224.5-.5.5-.5-.224-.5-.5.224-.5.5-.5zm-9.5 3c.276 0 .5.224.5.5s-.224.5-.5.5-.5-.224-.5-.5.224-.5.5-.5zm11 0c.276 0 .5.224.5.5s-.224.5-.5.5-.5-.224-.5-.5.224-.5.5-.5z"/>
  </svg>
);

const VSCodeIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.583.063a1.5 1.5 0 0 0-1.092.46l-8.953 8.952-3.47-2.766a1.2 1.2 0 0 0-1.544.06l-1.15 1.032a.8.8 0 0 0 0 1.197l3.08 2.757-3.08 2.758a.8.8 0 0 0 0 1.197l1.15 1.032a1.2 1.2 0 0 0 1.544.06l3.47-2.767 8.953 8.953a1.5 1.5 0 0 0 1.092.46h1.917a.6.6 0 0 0 .6-.6V.663a.6.6 0 0 0-.6-.6h-1.917zM19.5 3.6v16.8l-7.033-5.625L19.5 3.6z"/>
  </svg>
);

const JetBrainsIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M0 0v24h24V0H0zm2.667 2.667h18.666v18.666H2.667V2.667zm4.385 3.793c.667 0 1.104.229 1.448.573l-.604.723c-.218-.197-.437-.307-.781-.307-.51 0-.896.374-.896.916v.01c0 .52.386.906.896.906.354 0 .604-.12.802-.328l.593.708c-.354.385-.792.624-1.458.624-.979 0-1.77-.677-1.77-1.916v-.01c0-1.229.791-1.899 1.77-1.899zm4.312 0v3.864H10.05v-.73h-.792v.76H7.98V6.46h1.28v2.07h.79V6.46h1.313zm3.884 0v.76h-1.145v3.104h-1.312V7.22h-1.145v-.76h3.602zm-10.374 7h6.668v1.334H5.334V13.334zm0 2.666h6.668V17.334H5.334V16z"/>
  </svg>
);

const ChromeIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4.909c2.298 0 4.332.993 5.758 2.56L12 17.5 5.564 6.256C7.193 5.46 9.045 4.909 12 4.909zM4.056 8.056l5.636 9.838C5.228 16.538 3.5 13.29 3.5 11.5c0-1.146.222-2.24.556-3.444zm15.888 0c.334 1.204.556 2.298.556 3.444 0 1.79-1.728 5.038-6.192 6.394l5.636-9.838z"/>
  </svg>
);

const FirefoxIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12c2.437 0 4.698-.73 6.593-1.98.346-.232.68-.482 1-.75.326-.272.637-.56.931-.864.293-.304.568-.624.823-.958.255-.334.49-.682.704-1.043.215-.36.408-.733.58-1.118.172-.385.322-.781.45-1.188.127-.407.232-.825.313-1.251.08-.426.137-.86.17-1.3.033-.44.04-.885.023-1.33-.017-.446-.056-.89-.118-1.328-.062-.44-.147-.874-.255-1.3-.108-.426-.24-.843-.393-1.25-.154-.407-.33-.803-.527-1.187-.198-.385-.417-.758-.657-1.117-.24-.36-.5-.705-.78-1.035-.28-.33-.578-.643-.893-.938-.316-.296-.648-.573-.995-.83-.347-.258-.708-.495-1.08-.71-.374-.216-.758-.41-1.15-.58-.393-.17-.794-.317-1.2-.437-.408-.12-.82-.22-1.235-.3-.415-.08-.833-.14-1.25-.177-.418-.038-.835-.053-1.25-.045-.416.008-.83.037-1.238.088-.41.05-.813.123-1.208.218-.396.095-.783.212-1.16.35-.377.14-.744.3-1.1.48-.355.18-.698.38-1.028.6-.33.22-.646.46-.948.72-.302.26-.588.54-.858.84-.27.3-.523.62-.758.96-.235.34-.45.7-.645 1.07-.195.37-.37.76-.52 1.16-.152.4-.282.82-.39 1.24-.108.42-.193.86-.255 1.3-.062.44-.1.884-.118 1.33-.017.445-.01.89.023 1.33.033.44.09.874.17 1.3.08.426.186.844.313 1.25.127.407.277.803.45 1.188.172.385.365.758.58 1.118.214.36.45.71.704 1.043.255.334.53.654.823.958.294.304.605.592.93.864.32.268.655.518 1 .75 1.895 1.25 4.156 1.98 6.593 1.98zm0-3.818c-1.063 0-2.07-.247-2.965-.685l3.346-5.85 3.346 5.85c-.895.438-1.902.685-2.965.685z"/>
  </svg>
);

const EdgeIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.3 10.3c.2-1.3.7-2.5 1.5-3.4.8-.9 1.9-1.5 3.2-1.8 1.3-.3 2.7-.2 4.1.3v2.4c-.5-.3-1.1-.5-1.7-.6-.6-.1-1.2 0-1.7.3-.5.3-.9.7-1.2 1.3-.3.6-.4 1.3-.3 2.2.1.9.5 1.6 1 2.1.5.5 1.2.8 1.9.9.7.1 1.4 0 2.1-.3v2.4c-1.4.5-2.8.6-4.1.3-1.3-.3-2.4-.9-3.2-1.8-.8-.9-1.3-2.1-1.5-3.4-.2-1.3 0-2.5.6-3.6.6-1.1 1.4-1.9 2.5-2.4 1.1-.5 2.3-.7 3.6-.5 1.3.2 2.5.7 3.5 1.6 1 .9 1.7 2 2.1 3.3.4 1.3.4 2.7 0 4.1-.4 1.4-1.1 2.6-2.1 3.6-1 1-2.2 1.7-3.5 2.1-1.3.4-2.7.4-4.1 0-1.4-.4-2.6-1.1-3.6-2.1-1-1-1.7-2.2-2.1-3.6z"/>
  </svg>
);

const SafariIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 14.36l-1.42-1.42c.15-.26.25-.55.3-.86h2c-.07.47-.24.91-.5 1.32-.25.4-.58.74-.98.98l-.4-.02zm-9.28 0l-.4.02c-.4-.24-.73-.58-.98-.98-.26-.41-.43-.85-.5-1.32h2c.05.31.15.6.3.86l-1.42 1.42zm1.42-9.28l1.42 1.42c-.26.15-.55.25-.86.3v-2c.47.07.91.24 1.32.5.4.25.74.58.98.98l-.02.4-.84-.8zm6.84 6.84l.8.84-.02.4c-.24.4-.58.73-.98.98-.41.26-.85.43-1.32.5v-2c.31-.05.6-.15.86-.3l1.42 1.42c.24-.4.38-.83.42-1.28l-.38-.56zM12 6.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0 8c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/>
  </svg>
);

const AndroidIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.523 15.3414c-.5 0-.909.409-.909.909 0 .5.409.909.909.909.5 0 .909-.409.909-.909 0-.5-.409-.909-.909-.909zm-11.046 0c-.5 0-.909.409-.909.909 0 .5.409.909.909.909.5 0 .909-.409.909-.909 0-.5-.409-.909-.909-.909zm11.4-6.117l1.995-3.455a.318.318 0 0 0-.436-.436l-2.015 3.49C15.782 8.327 13.967 7.875 12 7.875c-1.967 0-3.782.452-5.421 1.248L4.564 5.633a.318.318 0 0 0-.436.436l1.995 3.455C2.729 11.389 0 15.1 0 19.375h24c0-4.275-2.729-7.986-6.123-10.1506z"/>
  </svg>
);

const TerminalIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5"/>
    <line x1="12" y1="19" x2="20" y2="19"/>
  </svg>
);

interface PlatformItem {
  icon: React.ReactNode;
  name: string;
  action: string;
  color?: string;
  disabled?: boolean;
  onClick?: () => void;
}

interface ExtensionFeature {
  icon: React.ReactNode;
  title: string;
  description: string;
  shortcut?: string;
}

// Animated Background Component for Cards
function CardBackground({ type }: { type: 'code' | 'cloud' | 'desktop' | 'mobile' | 'browser' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      if (type === 'code') {
        ctx.fillStyle = 'rgba(217, 119, 87, 0.03)';
        const cols = 15;
        const colWidth = w / cols;
        for (let i = 0; i < cols; i++) {
          const x = i * colWidth;
          const offset = (time * 20 + i * 30) % h;
          const height = 60 + Math.sin(time * 0.5 + i) * 30;
          ctx.fillRect(x, offset, colWidth - 2, height);
        }
      } else if (type === 'cloud') {
        const particles = 8;
        for (let i = 0; i < particles; i++) {
          const x = ((time * 10 + i * 100) % (w + 100)) - 50;
          const y = h * 0.3 + Math.sin(time * 0.3 + i) * 40;
          const radius = 30 + Math.sin(time * 0.5 + i) * 15;
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
          gradient.addColorStop(0, 'rgba(91, 141, 239, 0.08)');
          gradient.addColorStop(1, 'transparent');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (type === 'desktop') {
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.05)';
        ctx.lineWidth = 1;
        const gridSize = 40;
        const pulse = Math.sin(time * 2) * 0.5 + 0.5;
        for (let x = 0; x < w; x += gridSize) {
          ctx.globalAlpha = 0.3 + pulse * 0.4;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = 0; y < h; y += gridSize) {
          ctx.globalAlpha = 0.3 + pulse * 0.4;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (type === 'browser') {
        // Pulsing rings for browser
        for (let i = 0; i < 3; i++) {
          const x = w * 0.8;
          const y = h * 0.3;
          const radius = 30 + i * 30 + Math.sin(time * 2 + i) * 10;
          const alpha = 0.1 - i * 0.03;
          ctx.strokeStyle = `rgba(66, 133, 244, ${alpha})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      time += 0.016;
      animationId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [type]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}

export const ProductsDiscoveryView: React.FC = () => {
  const [showExtensionDetail, setShowExtensionDetail] = useState(false);

  return (
    <div style={{ 
      height: '100vh',
      overflowY: 'auto',
      backgroundColor: '#0a0a0a',
      padding: '64px 80px',
      color: '#e5e5e5',
    }}>
      {/* Close button */}
      <button 
        onClick={() => window.dispatchEvent(new CustomEvent('allternit:close-products'))}
        style={{
          position: 'fixed',
          top: 24,
          right: 24,
          width: 44,
          height: 44,
          borderRadius: 12,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#888',
          transition: 'all 0.2s',
          zIndex: 100,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
          e.currentTarget.style.color = '#fff';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
          e.currentTarget.style.color = '#888';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <X size={20} />
      </button>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '64px' }}>
        <h1 style={{ 
          fontSize: '44px', 
          fontWeight: '600', 
          color: '#ffffff',
          margin: '0 0 12px 0',
          letterSpacing: '-0.02em'
        }}>
          Allternit Platform
        </h1>
        <p style={{
          fontSize: '18px',
          color: '#666',
          margin: 0,
        }}>
          Do more with Allternit, everywhere you work
        </p>
      </div>

      {/* Products Grid */}
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Row 1: Code + Cloud */}
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '32px',
          marginBottom: '32px'
        }}>
          {/* Gizziio Code */}
          <ProductCard
            type="code"
            title="Gizziio Code"
            subtitle="AI-Powered Development"
            description="Build, debug, and ship from your terminal or IDE. Your AI pair programmer that lives in your development workflow."
            gradient="linear-gradient(135deg, #D97757 0%, #B08D6E 100%)"
            accentColor="#D97757"
            icon={<Code size={32} color="#fff" />}
            mascot={<GizziMascot size={90} emotion="proud" />}
            platforms={[
              { icon: <TerminalIcon size={18} />, name: 'Terminal', action: 'Install', color: '#6e6e6e' },
              { icon: <VSCodeIcon size={18} />, name: 'VS Code', action: 'Install', color: '#007ACC' },
              { icon: <Monitor size={18} />, name: 'Desktop', action: 'Open', color: '#22c55e' },
              { icon: <JetBrainsIcon size={18} />, name: 'JetBrains', action: 'Install', color: '#00CDD7' },
            ]}
          />

          {/* Gizzi Cloud */}
          <ProductCard
            type="cloud"
            title="Gizzi Cloud"
            subtitle="Cloud Infrastructure"
            description="Deploy and manage AI agents in the cloud. Scale your workflows with managed infrastructure."
            gradient="linear-gradient(135deg, #5B8DEF 0%, #7B68EE 100%)"
            accentColor="#5B8DEF"
            icon={<Cloud size={32} color="#fff" />}
            platforms={[
              { icon: <Globe size={18} />, name: 'Web Dashboard', action: 'Open', color: '#5B8DEF' },
              { icon: <ArrowUpRight size={18} />, name: 'API Access', action: 'View Docs', color: '#7B68EE' },
              { icon: <TerminalIcon size={18} />, name: 'CLI Tool', action: 'Install', color: '#6e6e6e' },
            ]}
          />
        </div>

        {/* Row 2: Desktop + Browser Extension */}
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '32px',
          marginBottom: '32px'
        }}>
          {/* Desktop App - Allternit Brand Colors */}
          <ProductCard
            type="desktop"
            title="Allternit Desktop"
            subtitle="Native Application"
            description="The full Allternit experience on your computer. Chat, Cowork, and Code modes all in one native application."
            gradient="linear-gradient(135deg, #D4B08C 0%, #B08D6E 100%)"
            accentColor="#D4B08C"
            icon={<div style={{ transform: 'scale(0.5)' }}><MatrixLogo state="idle" size={64} /></div>}
            platforms={[
              { icon: <AppleIcon size={18} />, name: 'macOS', action: 'Download', color: '#A2AAAD' },
              { icon: <WindowsIcon size={18} />, name: 'Windows', action: 'Download', color: '#00A4EF' },
              { icon: <LinuxIcon size={18} />, name: 'Linux', action: 'Download', color: '#FCC624' },
            ]}
          />

          {/* Browser Extension - Fully Implemented */}
          <ProductCard
            type="browser"
            title="Gizzi for Browsers"
            subtitle="Browser Extension"
            description="Bring Allternit into your browser. Access AI assistance on any webpage with powerful browser automation capabilities."
            gradient="linear-gradient(135deg, #4285F4 0%, #34A853 100%)"
            accentColor="#4285F4"
            icon={<Puzzle size={32} color="#fff" />}
            platforms={[
              { 
                icon: <ChromeIcon size={18} />, 
                name: 'Chrome', 
                action: 'Add to Chrome', 
                color: '#4285F4',
                onClick: () => window.open('https://chrome.google.com/webstore', '_blank')
              },
              { 
                icon: <FirefoxIcon size={18} />, 
                name: 'Firefox', 
                action: 'Add to Firefox', 
                color: '#FF7139',
                onClick: () => window.open('https://addons.mozilla.org', '_blank')
              },
            ]}
            onCardClick={() => setShowExtensionDetail(true)}
          />
        </div>

        {/* Row 3: Allternit Dev + Marketplace */}
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '32px',
          marginBottom: '32px'
        }}>
          {/* Allternit Dev Portal */}
          <ProductCard
            type="code"
            title="Allternit Dev"
            subtitle="Developer Portal"
            description="Build plugins, extensions, and integrations for the Allternit ecosystem. Access APIs, SDKs, and documentation."
            gradient="linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
            accentColor="#6366f1"
            icon={<Code size={32} color="#fff" />}
            platforms={[
              { 
                icon: <ArrowSquareOut size={18} />, 
                name: 'Dev Portal', 
                action: 'Open', 
                color: '#6366f1',
                onClick: () => window.open('https://dev.a2r.dev', '_blank')
              },
              { 
                icon: <FileText size={18} />, 
                name: 'Documentation', 
                action: 'View', 
                color: '#8b5cf6',
                onClick: () => window.open('https://docs.a2r.dev', '_blank')
              },
              { 
                icon: <Terminal size={18} />, 
                name: 'API Reference', 
                action: 'Explore', 
                color: '#a78bfa',
                onClick: () => window.open('https://docs.a2r.dev/api', '_blank')
              },
            ]}
          />

          {/* Allternit Marketplace */}
          <ProductCard
            type="cloud"
            title="Allternit Marketplace"
            subtitle="Plugin Directory"
            description="Discover and install plugins, skills, and extensions built by the Allternit community. Extend your Allternit experience."
            gradient="linear-gradient(135deg, #10b981 0%, #06b6d4 100%)"
            accentColor="#10b981"
            icon={<ShoppingBag size={32} color="#fff" />}
            platforms={[
              { 
                icon: <Storefront size={18} />, 
                name: 'Browse', 
                action: 'Open', 
                color: '#10b981',
                onClick: () => window.open('https://marketplace.a2r.dev', '_blank')
              },
              { 
                icon: <Puzzle size={18} />, 
                name: 'Plugins', 
                action: 'Discover', 
                color: '#06b6d4',
                onClick: () => window.open('https://marketplace.a2r.dev/plugins', '_blank')
              },
              { 
                icon: <Sparkle size={18} />, 
                name: 'Publish', 
                action: 'Submit', 
                color: '#14b8a6',
                onClick: () => window.open('https://marketplace.a2r.dev/publish', '_blank')
              },
            ]}
          />
        </div>

        {/* Browser Extension Detail Section */}
        {showExtensionDetail && <ExtensionDetailSection onClose={() => setShowExtensionDetail(false)} />}

        {/* Gizzi in the Web - Extension Banner */}
        <div style={{ marginTop: '32px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #141414 0%, #0f172a 100%)',
            borderRadius: '24px',
            border: '1px solid rgba(66, 133, 244, 0.2)',
            padding: '40px 48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Animated gradient background */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, rgba(66,133,244,0.05) 0%, transparent 50%, rgba(52,168,83,0.03) 100%)',
            }} />
            
            {/* Floating orbs */}
            <div style={{
              position: 'absolute',
              top: -60,
              right: 100,
              width: 150,
              height: 150,
              background: 'radial-gradient(circle, rgba(66,133,244,0.15) 0%, transparent 70%)',
              filter: 'blur(20px)',
              animation: 'float 8s ease-in-out infinite',
            }} />
            <div style={{
              position: 'absolute',
              bottom: -40,
              right: 200,
              width: 120,
              height: 120,
              background: 'radial-gradient(circle, rgba(52,168,83,0.1) 0%, transparent 70%)',
              filter: 'blur(20px)',
              animation: 'float 6s ease-in-out infinite reverse',
            }} />

            <style>{`
              @keyframes float {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-20px); }
              }
            `}</style>

            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', position: 'relative' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #4285F4 0%, #34A853 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 32px rgba(66,133,244,0.3)',
              }}>
                <Puzzle size={28} color="#fff" />
              </div>
              <div>
                <h3 style={{ 
                  fontSize: '24px', 
                  fontWeight: '600', 
                  color: '#ffffff',
                  margin: '0 0 6px 0'
                }}>
                  Allternit Browser Capsule
                </h3>
                <p style={{ 
                  fontSize: '15px', 
                  color: '#888',
                  margin: 0,
                  maxWidth: 450,
                }}>
                  Your AI assistant in every tab. Click, automate, and analyze any webpage.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', position: 'relative' }}>
              <button 
                onClick={() => window.open('https://chrome.google.com/webstore', '_blank')}
                style={{
                  padding: '12px 20px',
                  borderRadius: '12px',
                  border: '1px solid #4285F4',
                  background: 'rgba(66,133,244,0.1)',
                  color: '#4285F4',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(66,133,244,0.2)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(66,133,244,0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <ChromeIcon size={16} />
                Chrome Store
              </button>
              <button 
                onClick={() => window.open('https://addons.mozilla.org', '_blank')}
                style={{
                  padding: '12px 20px',
                  borderRadius: '12px',
                  border: '1px solid #FF7139',
                  background: 'rgba(255,113,57,0.1)',
                  color: '#FF7139',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,113,57,0.2)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,113,57,0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <FirefoxIcon size={16} />
                Firefox
              </button>
            </div>
          </div>
        </div>

        {/* Infrastructure Gateway - VPS/BYOC/Cloud */}
        <div style={{ marginTop: '48px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #141414 0%, #0f0f0f 100%)',
            borderRadius: '24px',
            border: '1px solid rgba(212,176,140,0.15)',
            padding: '40px 48px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Animated background effect */}
            <div style={{
              position: 'absolute',
              top: -100,
              right: -100,
              width: 300,
              height: 300,
              background: 'radial-gradient(circle, rgba(212,176,140,0.08) 0%, transparent 70%)',
              filter: 'blur(40px)',
            }} />
            <div style={{
              position: 'absolute',
              bottom: -50,
              left: -50,
              width: 200,
              height: 200,
              background: 'radial-gradient(circle, rgba(34,197,94,0.06) 0%, transparent 70%)',
              filter: 'blur(30px)',
            }} />

            {/* Header */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '16px', 
              marginBottom: '32px',
              position: 'relative',
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(212,176,140,0.2) 0%, rgba(212,176,140,0.05) 100%)',
                border: '1px solid rgba(212,176,140,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <HardDrives size={28} color="#d4b08c" />
              </div>
              <div>
                <h3 style={{
                  fontSize: '24px',
                  fontWeight: '600',
                  color: '#fff',
                  margin: '0 0 4px 0',
                }}>
                  Deploy Your Infrastructure
                </h3>
                <p style={{
                  fontSize: '15px',
                  color: '#888',
                  margin: 0,
                }}>
                  BYOC, VPS, or Cloud. Your agents, your servers, your control.
                </p>
              </div>
            </div>

            {/* Options Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px',
              marginBottom: '24px',
              position: 'relative',
            }}>
              {/* Cloud Deploy */}
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('allternit:open-settings', { 
                    detail: { section: 'infrastructure', tab: 'providers' } 
                  }));
                }}
                style={{
                  padding: '24px',
                  borderRadius: '16px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(34,197,94,0.4)';
                  e.currentTarget.style.background = 'rgba(34,197,94,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(34,197,94,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <RocketLaunch size={20} color="#22c55e" />
                  </div>
                  <span style={{ fontSize: '13px', color: '#22c55e', fontWeight: 600 }}>New</span>
                </div>
                <h4 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#fff',
                  margin: '0 0 6px 0',
                }}>
                  Cloud Deploy
                </h4>
                <p style={{
                  fontSize: '13px',
                  color: '#888',
                  margin: '0 0 16px 0',
                  lineHeight: '1.5',
                }}>
                  Deploy Allternit nodes to Hetzner, AWS, DigitalOcean in minutes.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#22c55e', fontSize: '13px', fontWeight: 500 }}>
                  Get Started <ArrowRight size={14} />
                </div>
              </button>

              {/* Connect VPS */}
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('allternit:open-settings', { 
                    detail: { section: 'infrastructure', tab: 'connections' } 
                  }));
                }}
                style={{
                  padding: '24px',
                  borderRadius: '16px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(212,176,140,0.4)';
                  e.currentTarget.style.background = 'rgba(212,176,140,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(212,176,140,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Cpu size={20} color="#d4b08c" />
                  </div>
                </div>
                <h4 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#fff',
                  margin: '0 0 6px 0',
                }}>
                  Connect VPS
                </h4>
                <p style={{
                  fontSize: '13px',
                  color: '#888',
                  margin: '0 0 16px 0',
                  lineHeight: '1.5',
                }}>
                  Bring your own server. Connect any VPS with SSH.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#d4b08c', fontSize: '13px', fontWeight: 500 }}>
                  Connect <ArrowRight size={14} />
                </div>
              </button>

              {/* Environments */}
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('allternit:open-settings', { 
                    detail: { section: 'infrastructure', tab: 'environments' } 
                  }));
                }}
                style={{
                  padding: '24px',
                  borderRadius: '16px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(123,104,238,0.4)';
                  e.currentTarget.style.background = 'rgba(123,104,238,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(123,104,238,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Stack size={20} color="#7b68ee" />
                  </div>
                </div>
                <h4 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#fff',
                  margin: '0 0 6px 0',
                }}>
                  Environments
                </h4>
                <p style={{
                  fontSize: '13px',
                  color: '#888',
                  margin: '0 0 16px 0',
                  lineHeight: '1.5',
                }}>
                  Railway-style setup. Devcontainers, Nix, Sandboxes.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#7b68ee', fontSize: '13px', fontWeight: 500 }}>
                  Browse Templates <ArrowRight size={14} />
                </div>
              </button>
            </div>

            {/* Bottom row with features */}
            <div style={{
              display: 'flex',
              gap: '24px',
              padding: '16px 0 0 0',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              position: 'relative',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={14} color="#666" />
                <span style={{ fontSize: '12px', color: '#666' }}>End-to-end encrypted</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={14} color="#666" />
                <span style={{ fontSize: '12px', color: '#666' }}>SSH key management</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={14} color="#666" />
                <span style={{ fontSize: '12px', color: '#666' }}>5 cloud providers</span>
              </div>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('allternit:open-settings', { detail: { section: 'infrastructure' } }))}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(212,176,140,0.3)',
                  background: 'rgba(212,176,140,0.08)',
                  color: '#d4b08c',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(212,176,140,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(212,176,140,0.08)';
                }}
              >
                Manage Infrastructure <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div style={{ 
          marginTop: '48px', 
          textAlign: 'center',
          padding: '48px',
          backgroundColor: '#141414',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.06)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Top gradient line */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 400,
            height: 2,
            background: 'linear-gradient(90deg, transparent, #d4b08c, transparent)',
          }} />
          
          {/* Subtle glow */}
          <div style={{
            position: 'absolute',
            top: -100,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 300,
            height: 200,
            background: 'radial-gradient(circle, rgba(212,176,140,0.1) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }} />

          <Sparkle size={32} color="#d4b08c" style={{ marginBottom: 16 }} />
          <p style={{ fontSize: '20px', color: '#fff', margin: '0 0 8px 0', fontWeight: 500, position: 'relative' }}>
            Want early access?
          </p>
          <p style={{ fontSize: '15px', color: '#666', margin: '0 0 24px 0', position: 'relative' }}>
            Join the beta program to get exclusive access to new features and products.
          </p>
          <button style={{
            padding: '14px 32px',
            borderRadius: '12px',
            border: 'none',
            background: '#d4b08c',
            color: '#0a0a0a',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            position: 'relative',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(212,176,140,0.35)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          >
            Join the Beta Program
          </button>
        </div>

        {/* Spacer for scrolling */}
        <div style={{ height: 64 }} />
      </div>
    </div>
  );
};

// Extension Detail Section Component
function ExtensionDetailSection({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'chrome' | 'firefox' | 'build'>('chrome');
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const features: ExtensionFeature[] = [
    {
      icon: <Cursor size={24} color="#4285F4" />,
      title: 'Browser Automation',
      description: 'Click, type, scroll, and interact with any webpage using natural language commands.',
      shortcut: 'Ctrl+Shift+A',
    },
    {
      icon: <Chat size={24} color="#34A853" />,
      title: 'Ask AI Anywhere',
      description: 'Select text on any page and ask questions, get explanations, or rewrite content.',
      shortcut: 'Ctrl+Shift+Q',
    },
    {
      icon: <Camera size={24} color="#EA4335" />,
      title: 'Screenshot Analysis',
      description: 'Capture and analyze screenshots. Ask questions about visual content.',
      shortcut: 'Ctrl+Shift+S',
    },
    {
      icon: <FileText size={24} color="#FBBC04" />,
      title: 'Page Summarization',
      description: 'Get instant summaries of articles, docs, and long-form content.',
      shortcut: 'Ctrl+Shift+Z',
    },
    {
      icon: <TextT size={24} color="#4285F4" />,
      title: 'Form Filling',
      description: 'Automatically fill forms with AI assistance. Smart field detection.',
      shortcut: 'Ctrl+Shift+F',
    },
    {
      icon: <Lightning size={24} color="#34A853" />,
      title: 'Quick Access',
      description: 'Access your agents from any webpage with a single click or keyboard shortcut.',
      shortcut: 'Ctrl+Shift+G',
    },
  ];

  const buildCommands = [
    { label: 'Clone repository', command: 'git clone https://github.com/a2r/chrome-extension.git' },
    { label: 'Install dependencies', command: 'cd chrome-extension && npm install' },
    { label: 'Build extension', command: 'npm run build:prod' },
    { label: 'Load in Chrome', command: 'Open chrome://extensions → Developer mode → Load unpacked → Select dist/' },
  ];

  const copyToClipboard = (command: string) => {
    navigator.clipboard.writeText(command);
    setCopiedCommand(command);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  return (
    <div style={{
      marginTop: '32px',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      borderRadius: '24px',
      border: '1px solid rgba(66, 133, 244, 0.2)',
      padding: '40px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background effects */}
      <div style={{
        position: 'absolute',
        top: -100,
        right: -50,
        width: 300,
        height: 300,
        background: 'radial-gradient(circle, rgba(66,133,244,0.1) 0%, transparent 70%)',
        filter: 'blur(60px)',
      }} />

      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '32px',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #4285F4 0%, #34A853 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Puzzle size={28} color="#fff" />
          </div>
          <div>
            <h3 style={{ fontSize: '24px', fontWeight: '600', color: '#fff', margin: '0 0 4px 0' }}>
              Allternit Browser Capsule
            </h3>
            <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>
              Version 1.0.0 • Free • Open Source
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#888',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.color = '#888';
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Browser Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '32px',
        padding: '4px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '12px',
        width: 'fit-content',
      }}>
        {[
          { id: 'chrome', icon: <ChromeIcon size={16} />, label: 'Chrome' },
          { id: 'firefox', icon: <FirefoxIcon size={16} />, label: 'Firefox' },
          { id: 'build', icon: <Wrench size={16} />, label: 'Build from Source' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === tab.id ? 'rgba(66,133,244,0.2)' : 'transparent',
              color: activeTab === tab.id ? '#4285F4' : '#888',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Installation Content */}
      <div style={{ marginBottom: '40px' }}>
        {activeTab === 'chrome' && (
          <div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)', 
              gap: '16px',
              marginBottom: '24px',
            }}>
              <a
                href="https://chrome.google.com/webstore"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '20px',
                  borderRadius: '16px',
                  background: 'rgba(66,133,244,0.1)',
                  border: '1px solid rgba(66,133,244,0.3)',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(66,133,244,0.15)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(66,133,244,0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ color: '#4285F4' }}><ChromeIcon size={32} /></div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                    Chrome Web Store
                  </div>
                  <div style={{ fontSize: '13px', color: '#888' }}>
                    Official release • Auto-updates
                  </div>
                </div>
                <ArrowSquareOut size={18} color="#4285F4" style={{ marginLeft: 'auto' }} />
              </a>

              <a
                href="https://github.com/a2r/chrome-extension/releases"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '20px',
                  borderRadius: '16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <DownloadSimple size={32} color="#d4b08c" />
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                    Download .crx
                  </div>
                  <div style={{ fontSize: '13px', color: '#888' }}>
                    Manual installation • Latest build
                  </div>
                </div>
                <ArrowSquareOut size={18} color="#d4b08c" style={{ marginLeft: 'auto' }} />
              </a>
            </div>

            <div style={{
              padding: '16px 20px',
              background: 'rgba(34,197,94,0.1)',
              borderRadius: '12px',
              border: '1px solid rgba(34,197,94,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <CheckCircle size={20} color="#22c55e" />
              <span style={{ fontSize: '14px', color: '#22c55e' }}>
                Compatible with Chrome, Edge, Brave, Opera, and all Chromium-based browsers
              </span>
            </div>
          </div>
        )}

        {activeTab === 'firefox' && (
          <div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)', 
              gap: '16px',
              marginBottom: '24px',
            }}>
              <a
                href="https://addons.mozilla.org"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '20px',
                  borderRadius: '16px',
                  background: 'rgba(255,113,57,0.1)',
                  border: '1px solid rgba(255,113,57,0.3)',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,113,57,0.15)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,113,57,0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ color: '#FF7139' }}><FirefoxIcon size={32} /></div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                    Firefox Add-ons
                  </div>
                  <div style={{ fontSize: '13px', color: '#888' }}>
                    Official release • Auto-updates
                  </div>
                </div>
                <ArrowSquareOut size={18} color="#FF7139" style={{ marginLeft: 'auto' }} />
              </a>

              <a
                href="https://github.com/a2r/firefox-extension/releases"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '20px',
                  borderRadius: '16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Cube size={32} color="#d4b08c" />
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                    Download .xpi
                  </div>
                  <div style={{ fontSize: '13px', color: '#888' }}>
                    Manual installation • Latest build
                  </div>
                </div>
                <ArrowSquareOut size={18} color="#d4b08c" style={{ marginLeft: 'auto' }} />
              </a>
            </div>

            <div style={{
              padding: '16px 20px',
              background: 'rgba(255,113,57,0.1)',
              borderRadius: '12px',
              border: '1px solid rgba(255,113,57,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <CheckCircle size={20} color="#FF7139" />
              <span style={{ fontSize: '14px', color: '#FF7139' }}>
                Compatible with Firefox, Waterfox, LibreWolf, and Firefox-based browsers
              </span>
            </div>
          </div>
        )}

        {activeTab === 'build' && (
          <div>
            <p style={{ fontSize: '14px', color: '#888', marginBottom: '20px' }}>
              Build the extension from source for the latest features and development.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {buildCommands.map((item, index) => (
                <div
                  key={index}
                  style={{
                    padding: '16px 20px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                  }}
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'rgba(66,133,244,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    color: '#4285F4',
                    fontWeight: 600,
                  }}>
                    {index + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                      {item.label}
                    </div>
                    <code style={{ 
                      fontSize: '14px', 
                      color: '#d4b08c',
                      fontFamily: 'monospace',
                    }}>
                      {item.command}
                    </code>
                  </div>
                  <button
                    onClick={() => copyToClipboard(item.command)}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      background: copiedCommand === item.command ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)',
                      border: 'none',
                      cursor: 'pointer',
                      color: copiedCommand === item.command ? '#22c55e' : '#888',
                      transition: 'all 0.2s',
                    }}
                    title="Copy command"
                  >
                    {copiedCommand === item.command ? <CheckCircle size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: '20px',
              padding: '16px 20px',
              background: 'rgba(66,133,244,0.05)',
              borderRadius: '12px',
              border: '1px solid rgba(66,133,244,0.1)',
            }}>
              <div style={{ fontSize: '14px', color: '#4285F4', fontWeight: 500, marginBottom: '8px' }}>
                Requirements
              </div>
              <div style={{ fontSize: '13px', color: '#888', display: 'flex', gap: '16px' }}>
                <span>• Node.js 18+</span>
                <span>• npm or pnpm</span>
                <span>• Chrome 88+ or Firefox 109+</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Features Grid */}
      <div style={{ marginBottom: '32px' }}>
        <h4 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', margin: '0 0 20px 0' }}>
          Features
        </h4>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
        }}>
          {features.map((feature, index) => (
            <div
              key={index}
              style={{
                padding: '20px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.05)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.borderColor = 'rgba(66,133,244,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
              }}
            >
              <div style={{ marginBottom: '12px' }}>{feature.icon}</div>
              <h5 style={{ fontSize: '15px', fontWeight: '600', color: '#fff', margin: '0 0 8px 0' }}>
                {feature.title}
              </h5>
              <p style={{ fontSize: '13px', color: '#888', margin: '0 0 12px 0', lineHeight: '1.5' }}>
                {feature.description}
              </p>
              {feature.shortcut && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#666',
                  fontFamily: 'monospace',
                }}>
                  <Command size={12} />
                  {feature.shortcut}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Browser Support */}
      <div style={{
        padding: '20px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.05)',
      }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', margin: '0 0 16px 0' }}>
          Supported Browsers
        </h4>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {[
            { icon: <ChromeIcon size={20} />, name: 'Chrome', version: '88+' },
            { icon: <FirefoxIcon size={20} />, name: 'Firefox', version: '109+' },
            { icon: <EdgeIcon size={20} />, name: 'Edge', version: '88+' },
            { icon: <div style={{ color: '#FBBC04' }}><Cube size={20} /></div>, name: 'Brave', version: '1.20+' },
            { icon: <div style={{ color: '#FF1B2D' }}><Cube size={20} /></div>, name: 'Opera', version: '74+' },
          ].map((browser, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {browser.icon}
              <div>
                <div style={{ fontSize: '13px', color: '#fff' }}>{browser.name}</div>
                <div style={{ fontSize: '11px', color: '#666' }}>{browser.version}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Product Card Component with Animated Background
function ProductCard({ 
  type,
  title, 
  subtitle,
  description, 
  gradient, 
  accentColor,
  icon,
  mascot,
  platforms,
  comingSoon,
  onCardClick,
}: { 
  type: 'code' | 'cloud' | 'desktop' | 'mobile' | 'browser';
  title: string;
  subtitle: string;
  description: string;
  gradient: string;
  accentColor: string;
  icon: React.ReactNode;
  mascot?: React.ReactNode;
  platforms: PlatformItem[];
  comingSoon?: boolean;
  onCardClick?: () => void;
}) {
  return (
    <div 
      onClick={onCardClick}
      style={{
        backgroundColor: '#141414',
        borderRadius: '24px',
        border: '1px solid rgba(255,255,255,0.06)',
        padding: '44px',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 440,
        display: 'flex',
        flexDirection: 'column',
        opacity: comingSoon ? 0.65 : 1,
        transition: 'all 0.3s ease',
        cursor: onCardClick ? 'pointer' : 'default',
      }}
      onMouseEnter={(e) => {
        if (!comingSoon) {
          e.currentTarget.style.borderColor = `${accentColor}30`;
          e.currentTarget.style.transform = 'translateY(-4px)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Animated Background */}
      <CardBackground type={type as any} />

      {/* Static gradient orb decoration */}
      <div style={{
        position: 'absolute',
        top: -100,
        right: -100,
        width: 250,
        height: 250,
        background: `radial-gradient(circle, ${accentColor}15 0%, transparent 70%)`,
        filter: 'blur(40px)',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, position: 'relative' }}>
        <div>
          <p style={{
            fontSize: '12px',
            fontWeight: '600',
            color: accentColor,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            margin: '0 0 10px 0',
          }}>
            {subtitle}
          </p>
          <h2 style={{ fontSize: '30px', fontWeight: '600', color: '#ffffff', margin: 0 }}>
            {title}
          </h2>
        </div>
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '16px',
          background: gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 10px 40px ${accentColor}40`,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Shine effect */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: '-100%',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
            animation: 'shine 3s infinite',
          }} />
          <style>{`
            @keyframes shine {
              0% { left: -100%; }
              50%, 100% { left: 100%; }
            }
          `}</style>
          {icon}
        </div>
      </div>

      {/* Mascot (for Code card) */}
      {mascot && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginBottom: 16,
          padding: '12px 0',
          position: 'relative',
        }}>
          {mascot}
        </div>
      )}

      {/* Description */}
      <p style={{ 
        fontSize: '15px', 
        color: '#777', 
        margin: '0 0 36px 0', 
        lineHeight: '1.65',
        flex: 1,
        position: 'relative',
      }}>
        {description}
      </p>

      {/* Platforms - Visual list with lines */}
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {platforms.map((platform, index) => (
          <React.Fragment key={platform.name}>
            {index > 0 && (
              <div style={{
                height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 20%, rgba(255,255,255,0.08) 80%, transparent)',
                margin: '4px 0',
              }} />
            )}
            <PlatformRow {...platform} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// Platform Row Component
function PlatformRow({ 
  icon, 
  name, 
  action, 
  color = '#888',
  disabled = false,
  onClick,
}: PlatformItem & { disabled?: boolean; onClick?: () => void }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 4px',
      opacity: disabled ? 0.4 : 1,
      transition: 'opacity 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <span style={{ 
          color: color,
          display: 'flex',
          alignItems: 'center',
          filter: disabled ? 'grayscale(100%)' : 'none',
          opacity: disabled ? 0.6 : 1,
        }}>
          {icon}
        </span>
        <span style={{ fontSize: '15px', color: disabled ? '#555' : '#d0d0d0', fontWeight: 500 }}>
          {name}
        </span>
      </div>
      <button 
        onClick={onClick}
        disabled={disabled}
        style={{
          padding: '10px 18px',
          borderRadius: '10px',
          border: disabled ? '1px dashed rgba(255,255,255,0.12)' : '1px solid rgba(212,176,140,0.35)',
          background: disabled ? 'transparent' : 'rgba(212,176,140,0.06)',
          color: disabled ? '#555' : '#d4b08c',
          fontSize: '13px',
          fontWeight: '600',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.background = 'rgba(212,176,140,0.12)';
            e.currentTarget.style.transform = 'scale(1.02)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled) {
            e.currentTarget.style.background = 'rgba(212,176,140,0.06)';
            e.currentTarget.style.transform = 'scale(1)';
          }
        }}
      >
        {action}
      </button>
    </div>
  );
}

export default ProductsDiscoveryView;
