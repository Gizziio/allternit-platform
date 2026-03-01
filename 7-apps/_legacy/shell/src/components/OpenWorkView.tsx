import * as React from 'react';
import { OpenWorkApp } from '@a2rchitech/openwork';

interface OpenWorkViewProps {
  className?: string;
}

export const OpenWorkView: React.FC<OpenWorkViewProps> = ({ className = '' }) => {
  return (
    <div className={`openwork-view ${className}`}>
      <div className="openwork-header">
        <h2>Ops Center</h2>
        <p>OpenWork - Integrated as React Module</p>
      </div>
      <div className="openwork-content">
        <OpenWorkApp />
      </div>
      <div className="openwork-footer">
        <p className="openwork-note">
          ✓ OpenWork is now a native React component running inside Shell UI (port 5713).
        </p>
      </div>
    </div>
  );
};

export default OpenWorkView;
