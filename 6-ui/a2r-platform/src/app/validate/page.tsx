/**
 * Plugin Manifest Validator Page
 * 
 * Standalone page for validating plugin.json and marketplace.json files.
 * Accessible at /validate
 */

import { Metadata } from 'next';
import { PluginManifestValidator } from '../../components/PluginManifestValidator';

export const metadata: Metadata = {
  title: 'Plugin Manifest Validator | A2R',
  description: 'Validate plugin.json and marketplace.json files against the A2R schema',
};

export default function ValidatePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0c0a09',
        padding: '40px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 960 }}>
        <PluginManifestValidator />
        
        {/* Documentation Links */}
        <div
          style={{
            marginTop: 32,
            padding: 24,
            background: 'rgba(28, 25, 23, 0.5)',
            borderRadius: 12,
            border: '1px solid rgba(212, 176, 140, 0.1)',
          }}
        >
          <h3
            style={{
              margin: '0 0 16px 0',
              fontSize: 14,
              fontWeight: 600,
              color: '#e7e5e4',
            }}
          >
            Documentation
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <a
              href="https://docs.a2r.dev/plugins/manifest"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '10px 16px',
                background: 'rgba(212, 176, 140, 0.1)',
                borderRadius: 8,
                color: '#d4b08c',
                textDecoration: 'none',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Plugin Manifest Schema
            </a>
            <a
              href="https://docs.a2r.dev/plugins/marketplace"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '10px 16px',
                background: 'rgba(212, 176, 140, 0.1)',
                borderRadius: 8,
                color: '#d4b08c',
                textDecoration: 'none',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3h18v18H3z" />
                <path d="M21 9H3" />
                <path d="M9 21V9" />
              </svg>
              Marketplace Manifest Schema
            </a>
            <a
              href="https://docs.a2r.dev/plugins/publishing"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '10px 16px',
                background: 'rgba(212, 176, 140, 0.1)',
                borderRadius: 8,
                color: '#d4b08c',
                textDecoration: 'none',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              Publishing Guide
            </a>
          </div>
        </div>

        {/* Schema Reference */}
        <div
          style={{
            marginTop: 24,
            padding: 24,
            background: 'rgba(28, 25, 23, 0.5)',
            borderRadius: 12,
            border: '1px solid rgba(212, 176, 140, 0.1)',
          }}
        >
          <h3
            style={{
              margin: '0 0 16px 0',
              fontSize: 14,
              fontWeight: 600,
              color: '#e7e5e4',
            }}
          >
            Quick Reference
          </h3>
          
          <div style={{ display: 'grid', gap: 16 }}>
            {/* Plugin Manifest Fields */}
            <div>
              <h4
                style={{
                  margin: '0 0 8px 0',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#d4b08c',
                }}
              >
                Required Plugin Fields
              </h4>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 20,
                  fontSize: 13,
                  color: '#a8a29e',
                  lineHeight: 1.6,
                }}
              >
                <li><code style={{ color: '#e7e5e4', background: 'rgba(212,176,140,0.1)', padding: '2px 4px', borderRadius: 4 }}>name</code> - Plugin identifier (max 120 chars)</li>
                <li><code style={{ color: '#e7e5e4', background: 'rgba(212,176,140,0.1)', padding: '2px 4px', borderRadius: 4 }}>description</code> - Plugin description (max 5000 chars)</li>
                <li><code style={{ color: '#e7e5e4', background: 'rgba(212,176,140,0.1)', padding: '2px 4px', borderRadius: 4 }}>version</code> - Semantic version (e.g., 1.0.0)</li>
              </ul>
            </div>

            {/* Marketplace Manifest Fields */}
            <div>
              <h4
                style={{
                  margin: '0 0 8px 0',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#d4b08c',
                }}
              >
                Required Marketplace Fields
              </h4>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 20,
                  fontSize: 13,
                  color: '#a8a29e',
                  lineHeight: 1.6,
                }}
              >
                <li><code style={{ color: '#e7e5e4', background: 'rgba(212,176,140,0.1)', padding: '2px 4px', borderRadius: 4 }}>name</code> - Marketplace name (max 120 chars)</li>
                <li><code style={{ color: '#e7e5e4', background: 'rgba(212,176,140,0.1)', padding: '2px 4px', borderRadius: 4 }}>owner.name</code> - Owner name (max 120 chars)</li>
                <li><code style={{ color: '#e7e5e4', background: 'rgba(212,176,140,0.1)', padding: '2px 4px', borderRadius: 4 }}>plugins</code> - Array of plugin entries (min 1)</li>
              </ul>
            </div>

            {/* Recommended Fields */}
            <div>
              <h4
                style={{
                  margin: '0 0 8px 0',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#f59e0b',
                }}
              >
                Recommended Fields
              </h4>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 20,
                  fontSize: 13,
                  color: '#a8a29e',
                  lineHeight: 1.6,
                }}
              >
                <li><code style={{ color: '#e7e5e4', background: 'rgba(245,158,11,0.1)', padding: '2px 4px', borderRadius: 4 }}>author</code> - Author name/email for attribution</li>
                <li><code style={{ color: '#e7e5e4', background: 'rgba(245,158,11,0.1)', padding: '2px 4px', borderRadius: 4 }}>license</code> - SPDX license identifier</li>
                <li><code style={{ color: '#e7e5e4', background: 'rgba(245,158,11,0.1)', padding: '2px 4px', borderRadius: 4 }}>tags</code> - Array of searchable tags</li>
                <li><code style={{ color: '#e7e5e4', background: 'rgba(245,158,11,0.1)', padding: '2px 4px', borderRadius: 4 }}>homepage</code> or <code style={{ color: '#e7e5e4', background: 'rgba(245,158,11,0.1)', padding: '2px 4px', borderRadius: 4 }}>repository</code> - URL for more info</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
