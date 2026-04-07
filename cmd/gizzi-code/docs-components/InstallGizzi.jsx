// React/Vue component for docs site
// Install Gizzi Code section

import React from 'react';

const InstallGizzi = () => {
  const copyToClipboard = () => {
    navigator.clipboard.writeText('curl -fsSL https://install.gizziio.com/install | bash');
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0a0a0f 0%, #12121a 100%)',
      border: '1px solid rgba(217, 119, 87, 0.2)',
      borderRadius: '12px',
      padding: '40px',
      margin: '40px 0',
      textAlign: 'center'
    }}>
      {/* Gizzi Mascot ASCII */}
      <pre style={{
        fontFamily: "'Courier New', monospace",
        fontSize: '14px',
        lineHeight: '1.2',
        marginBottom: '20px',
        color: '#d97757'
      }}>
{`      ▄▄      
   ▄▄▄  ▄▄▄   
 ▄██████████▄ 
 █  ●    ●  █ 
 █  A : / / █ 
  ▀████████▀  
   █ █  █ █   
   ▀ ▀  ▀ ▀   `}
      </pre>

      <h2 style={{ color: '#d97757', fontSize: '24px', marginBottom: '10px' }}>
        Install Gizzi Code
      </h2>
      
      <p style={{ color: '#a0a0b0', marginBottom: '30px' }}>
        AI-powered terminal interface for the A2R ecosystem
      </p>

      {/* Install Command */}
      <div style={{
        background: '#0d0d12',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        maxWidth: '600px',
        margin: '0 auto 20px'
      }}>
        <code style={{
          fontFamily: "'Courier New', monospace",
          fontSize: '16px',
          color: '#d97757',
          flex: 1,
          textAlign: 'left'
        }}>
          curl -fsSL https://install.gizziio.com/install | bash
        </code>
        <button 
          onClick={copyToClipboard}
          style={{
            background: 'rgba(217, 119, 87, 0.1)',
            border: '1px solid #d97757',
            color: '#d97757',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Copy
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <a href="https://install.gizziio.com" style={{ color: '#d97757', textDecoration: 'none', fontSize: '14px' }}>
          Other install methods →
        </a>
        <a href="https://github.com/Gizziio/gizzi-code" style={{ color: '#d4b08c', textDecoration: 'none', fontSize: '14px' }}>
          GitHub
        </a>
      </div>
    </div>
  );
};

export default InstallGizzi;
