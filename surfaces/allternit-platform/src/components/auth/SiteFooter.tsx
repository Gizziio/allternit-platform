'use client';

import { useEffect, useRef } from 'react';
import { Linkedin, Twitter, Youtube } from 'lucide-react';

const SITE = 'https://allternit.com';

const footerColumns = [
  {
    title: 'Research',
    links: [
      { label: 'Interpretability',     href: `${SITE}/research#interpretability` },
      { label: 'Alignment',            href: `${SITE}/research#alignment` },
      { label: 'Societal Impacts',     href: `${SITE}/research#societal` },
      { label: 'Economic Futures',     href: `${SITE}/economic-futures` },
      { label: 'Publications',         href: `${SITE}/research#publications` },
      { label: "Gizzi's Constitution", href: `${SITE}/constitution` },
    ],
  },
  {
    title: 'Products',
    links: [
      { label: 'Platform',               href: `${SITE}/platform` },
      { label: 'Gizzi Code',             href: `${SITE}/gizzi-code` },
      { label: 'Gizzi Code Enterprise',  href: `${SITE}/gizzi-code-enterprise` },
      { label: 'Chat',                   href: `${SITE}/chat` },
      { label: 'Cowork',                 href: `${SITE}/cowork` },
      { label: 'A:// Web',              href: `${SITE}/web` },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'Documentation',   href: 'https://docs.allternit.com' },
      { label: 'API Reference',   href: 'https://docs.allternit.com/api' },
      { label: 'TypeScript SDK',  href: 'https://docs.allternit.com/sdk' },
      { label: 'Pricing',         href: `${SITE}/pricing` },
      { label: 'Service Catalog', href: 'https://docs.allternit.com/services' },
      { label: 'Console login',   href: '/sign-in' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Allternit',  href: `${SITE}/company` },
      { label: 'Careers',          href: `${SITE}/careers` },
      { label: 'News',             href: `${SITE}/news` },
      { label: 'Blog',             href: `${SITE}/blog` },
      { label: 'Customer stories', href: `${SITE}/stories` },
      { label: 'Events',           href: `${SITE}/events` },
    ],
  },
  {
    title: 'Operations',
    links: [
      { label: 'System status',   href: `${SITE}/status` },
      { label: 'Solutions',       href: `${SITE}/solutions` },
      { label: 'Support',         href: `${SITE}/support` },
      { label: 'Privacy policy',  href: '/privacy' },
      { label: 'Terms of service',href: '/terms' },
      { label: 'Usage policy',    href: `${SITE}/usage` },
    ],
  },
];

const socialLinks = [
  { icon: Linkedin, href: 'https://linkedin.com/company/allternit', label: 'LinkedIn' },
  { icon: Twitter,  href: 'https://twitter.com/allternit',          label: 'X' },
  { icon: Youtube,  href: 'https://youtube.com/@allternit',         label: 'YouTube' },
];

const legalLinks = [
  { label: 'Privacy policy',          href: '/privacy' },
  { label: 'Terms of service',        href: '/terms' },
  { label: 'Responsible disclosure',  href: `${SITE}/disclosure` },
  { label: 'Usage policy',            href: `${SITE}/usage` },
];

export function SiteFooter() {
  const borderRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<(HTMLDivElement | null)[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Animate on mount (footer is always visible on auth pages — no scroll trigger needed)
    const border = borderRef.current;
    const bottom = bottomRef.current;
    if (border) {
      border.style.transition = 'transform 0.8s cubic-bezier(0.16,1,0.3,1), opacity 0.4s ease';
      border.style.transform = 'scaleX(1)';
      border.style.opacity = '1';
    }
    columnsRef.current.forEach((col, i) => {
      if (!col) return;
      col.style.transition = `opacity 0.6s ease ${0.1 + i * 0.08}s, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.08}s`;
      col.style.opacity = '1';
      col.style.transform = 'translateY(0)';
    });
    if (bottom) {
      bottom.style.transition = 'opacity 0.5s ease 0.55s';
      bottom.style.opacity = '1';
    }
  }, []);

  return (
    <footer style={{
      background: 'var(--surface-canvas)',
      color: 'var(--ui-text-primary)',
      paddingTop: 80,
      paddingBottom: 40,
      position: 'relative',
      marginTop: 40,
    }}>
      {/* Top gradient border */}
      <div
        ref={borderRef}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(to right, transparent, rgba(201,69,32,0.5), transparent)',
          transformOrigin: 'left',
          transform: 'scaleX(0)',
          opacity: 0,
        }}
      />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px' }}>
        {/* Columns grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '32px 48px',
          marginBottom: 64,
        }}>
          {footerColumns.map((col, idx) => (
            <div
              key={col.title}
              ref={el => { columnsRef.current[idx] = el; }}
              style={{ opacity: 0, transform: 'translateY(32px)' }}
            >
              <h3 style={{
                fontFamily: "'Allternit Serif', Georgia, ui-serif, Cambria, 'Times New Roman', Times, serif",
                fontSize: 16, fontWeight: 400,
                color: 'rgba(255,255,255,0.9)',
                marginBottom: 22, lineHeight: 1.3,
              }}>
                {col.title}
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {col.links.map(link => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      style={{
                        fontSize: 13, color: 'rgba(255,255,255,0.45)',
                        textDecoration: 'none',
                        transition: 'color 0.25s',
                        display: 'inline-block',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--ui-text-primary)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.45)'; }}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          ref={bottomRef}
          style={{
            opacity: 0,
            paddingTop: 28,
            borderTop: '1px solid var(--ui-border-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          {/* Left: copyright + social */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
              © 2026 Allternit PBC
            </p>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              {socialLinks.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  style={{ color: 'rgba(255,255,255,0.3)', transition: 'color 0.25s, transform 0.25s', display: 'flex' }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLAnchorElement;
                    el.style.color = 'var(--ui-text-primary)';
                    el.style.transform = 'scale(1.15)';
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLAnchorElement;
                    el.style.color = 'rgba(255,255,255,0.3)';
                    el.style.transform = 'scale(1)';
                  }}
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Right: legal links */}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {legalLinks.map(link => (
              <a
                key={link.label}
                href={link.href}
                style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textDecoration: 'none', transition: 'color 0.25s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--ui-text-primary)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.3)'; }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
