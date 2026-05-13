"use client";
import React, { useState, useRef, useCallback } from 'react';
import { ArrowCounterClockwise, DownloadSimple, Package, X, Image as ImageIcon } from '@phosphor-icons/react';

// ── Format definitions ────────────────────────────────────────────────────────

interface BrandFormat {
  key: string;
  label: string;
  description: string;
  category: string;
  w: number;
  h: number;
  ext: 'png' | 'jpg' | 'webp';
}

const FORMATS: BrandFormat[] = [
  // Favicon
  { key: 'favicon_16',      label: 'Favicon 16',          description: 'Browser tab icon',             category: 'Favicon',   w: 16,   h: 16,   ext: 'png' },
  { key: 'favicon_32',      label: 'Favicon 32',          description: 'Browser tab icon HiDPI',       category: 'Favicon',   w: 32,   h: 32,   ext: 'png' },
  { key: 'favicon_64',      label: 'Favicon 64',          description: 'Bookmark icon',                category: 'Favicon',   w: 64,   h: 64,   ext: 'png' },
  { key: 'apple_touch',     label: 'Apple Touch 180',     description: 'iOS home screen icon',         category: 'Favicon',   w: 180,  h: 180,  ext: 'png' },
  // App Icons
  { key: 'app_192',         label: 'PWA Icon 192',        description: 'Progressive web app icon',     category: 'App Icons', w: 192,  h: 192,  ext: 'png' },
  { key: 'app_256',         label: 'App Icon 256',        description: 'Desktop app icon',             category: 'App Icons', w: 256,  h: 256,  ext: 'png' },
  { key: 'app_512',         label: 'App Icon 512',        description: 'High-res app icon',            category: 'App Icons', w: 512,  h: 512,  ext: 'png' },
  { key: 'app_1024',        label: 'App Icon 1024',       description: 'App Store / Play Store',       category: 'App Icons', w: 1024, h: 1024, ext: 'png' },
  // Social
  { key: 'og_image',        label: 'Open Graph',          description: 'Facebook / link previews',     category: 'Social',    w: 1200, h: 630,  ext: 'jpg' },
  { key: 'twitter_card',    label: 'Twitter Card',        description: 'Twitter / X link card',        category: 'Social',    w: 1200, h: 628,  ext: 'jpg' },
  { key: 'linkedin_banner', label: 'LinkedIn Banner',     description: 'Profile / company banner',     category: 'Social',    w: 1584, h: 396,  ext: 'jpg' },
  { key: 'fb_cover',        label: 'Facebook Cover',      description: 'Facebook page cover',          category: 'Social',    w: 820,  h: 312,  ext: 'jpg' },
  // Instagram
  { key: 'ig_square',       label: 'Instagram Square',    description: 'Standard post',                category: 'Instagram', w: 1080, h: 1080, ext: 'jpg' },
  { key: 'ig_portrait',     label: 'Instagram Portrait',  description: 'Portrait post',                category: 'Instagram', w: 1080, h: 1350, ext: 'jpg' },
  { key: 'ig_story',        label: 'Instagram Story',     description: 'Stories / Reels',              category: 'Instagram', w: 1080, h: 1920, ext: 'jpg' },
  // YouTube
  { key: 'yt_thumbnail',    label: 'YouTube Thumbnail',   description: '16:9 video thumbnail',         category: 'YouTube',   w: 1280, h: 720,  ext: 'jpg' },
  { key: 'yt_banner',       label: 'YouTube Banner',      description: 'Channel art',                  category: 'YouTube',   w: 2560, h: 1440, ext: 'jpg' },
  // Stores
  { key: 'play_feature',    label: 'Play Store Feature',  description: 'Feature graphic banner',       category: 'Stores',    w: 1024, h: 500,  ext: 'png' },
  { key: 'ios_store',       label: 'App Store Icon',      description: 'iOS App Store listing',        category: 'Stores',    w: 1024, h: 1024, ext: 'png' },
  // Email
  { key: 'email_header',    label: 'Email Header',        description: 'Newsletter / email top',       category: 'Email',     w: 600,  h: 200,  ext: 'jpg' },
  { key: 'email_logo',      label: 'Email Logo',          description: 'Inline logo for email',        category: 'Email',     w: 300,  h: 100,  ext: 'png' },
  // Web
  { key: 'banner_web',      label: 'Web Banner',          description: 'Generic web banner',           category: 'Web',       w: 1500, h: 500,  ext: 'jpg' },
  { key: 'thumbnail_sm',    label: 'Thumbnail 300',       description: 'Small thumbnail',              category: 'Web',       w: 300,  h: 300,  ext: 'jpg' },
  { key: 'webp_512',        label: 'WebP 512',            description: 'Modern web format',            category: 'Web',       w: 512,  h: 512,  ext: 'webp' },
];

const PRESETS: Record<string, string[]> = {
  'Favicon Pack':    ['favicon_16', 'favicon_32', 'favicon_64', 'apple_touch'],
  'Social Pack':     ['og_image', 'twitter_card', 'linkedin_banner', 'fb_cover'],
  'Instagram Pack':  ['ig_square', 'ig_portrait', 'ig_story'],
  'App Pack':        ['app_192', 'app_512', 'app_1024', 'ios_store', 'play_feature'],
  'Email Pack':      ['email_header', 'email_logo'],
  'Select All':      FORMATS.map(f => f.key),
};

const CATEGORIES = Array.from(new Set(FORMATS.map(f => f.category)));

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resizeToBlob(img: HTMLImageElement, w: number, h: number, ext: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error('no ctx')); return; }
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = img.naturalWidth * scale, sh = img.naturalHeight * scale;
    ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh);
    const mime = ext === 'jpg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob')), mime, 0.92);
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewState = 'upload' | 'processing' | 'results';
interface GeneratedAsset { format: BrandFormat; blob: Blob; url: string; }

// ── Component ─────────────────────────────────────────────────────────────────

export function BrandKitEditor({ projectName }: { projectName: string }) {
  const [view, setView] = useState<ViewState>('upload');
  const [srcImg, setSrcImg]     = useState<HTMLImageElement | null>(null);
  const [srcUrl, setSrcUrl]     = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string; dims: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(FORMATS.map(f => f.key)));
  const [search, setSearch]     = useState('');
  const [assets, setAssets]     = useState<GeneratedAsset[]>([]);
  const [processStep, setProcessStep] = useState(0);
  const [activeResultTab, setActiveResultTab] = useState<'assets' | 'original'>('assets');
  const fileRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setSrcImg(img); setSrcUrl(url);
      setFileInfo({
        name: file.name,
        size: file.size > 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${Math.round(file.size / 1024)} KB`,
        dims: `${img.naturalWidth} × ${img.naturalHeight} px`,
      });
    };
    img.src = url;
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) loadFile(file);
  }, [loadFile]);

  const toggleFormat = (key: string) => setSelected(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const applyPreset  = (keys: string[]) => setSelected(new Set(keys));

  const filteredFormats = FORMATS.filter(f =>
    !search || f.label.toLowerCase().includes(search.toLowerCase()) ||
    f.description.toLowerCase().includes(search.toLowerCase()) ||
    f.category.toLowerCase().includes(search.toLowerCase())
  );
  const groupedFiltered = CATEGORIES.reduce<Record<string, BrandFormat[]>>((acc, cat) => {
    const items = filteredFormats.filter(f => f.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  const generate = async () => {
    if (!srcImg) return;
    setView('processing'); setProcessStep(0);
    const toProcess = FORMATS.filter(f => selected.has(f.key));
    const generated: GeneratedAsset[] = [];
    setProcessStep(1);
    await new Promise(r => setTimeout(r, 400));
    setProcessStep(2);
    for (const fmt of toProcess) {
      const blob = await resizeToBlob(srcImg, fmt.w, fmt.h, fmt.ext);
      generated.push({ format: fmt, blob, url: URL.createObjectURL(blob) });
    }
    setProcessStep(3);
    await new Promise(r => setTimeout(r, 300));
    setProcessStep(4);
    await new Promise(r => setTimeout(r, 200));
    setAssets(generated);
    setView('results');
    setActiveResultTab('assets');
  };

  const downloadZip = async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const slug = projectName.replace(/\s+/g, '_').toLowerCase();
    for (const asset of assets) {
      zip.file(`${slug}_${asset.format.key}.${asset.format.ext}`, asset.blob);
    }
    const content = await zip.generateAsync({ type: 'blob' });
    triggerDownload(content, `${slug}_brand_kit.zip`);
  };

  const reset = () => {
    assets.forEach(a => URL.revokeObjectURL(a.url));
    setAssets([]); setSrcImg(null); setSrcUrl(null); setFileInfo(null);
    setView('upload'); setProcessStep(0);
  };

  // ── Upload view ──────────────────────────────────────────────────────────────

  if (view === 'upload') return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 28px', background: 'var(--bg-secondary)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Upload row */}
        <div style={{ display: 'grid', gridTemplateColumns: srcImg ? '1fr 1fr' : '1fr', gap: 16 }}>

          {/* Drop zone */}
          <div
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => !srcImg && fileRef.current?.click()}
            style={{
              height: 256, borderRadius: 10,
              border: `2px dashed ${isDragging ? 'var(--accent-primary)' : srcImg ? 'color-mix(in srgb, var(--accent-primary) 50%, transparent)' : 'var(--border-default)'}`,
              background: isDragging ? 'color-mix(in srgb, var(--accent-primary) 8%, var(--bg-primary))' : 'var(--bg-primary)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              cursor: srcImg ? 'default' : 'pointer', transition: 'all 0.25s', overflow: 'hidden',
              position: 'relative',
            }}
          >
            {srcUrl ? (
              <>
                <img src={srcUrl} alt="preview" style={{ maxHeight: 230, maxWidth: '100%', objectFit: 'contain', borderRadius: 6 }} />
                <button onClick={e => { e.stopPropagation(); setSrcImg(null); setSrcUrl(null); setFileInfo(null); }}
                  style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 6, background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={13} weight="bold" />
                </button>
              </>
            ) : (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDragging ? 'var(--accent-primary)' : 'var(--text-tertiary)' }}>
                  {isDragging
                    ? <svg style={{ width: 48, height: 48, animation: 'pulse 1s infinite' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" /></svg>
                    : <ImageIcon size={48} />
                  }
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{isDragging ? 'Drop image here!' : 'Drag & drop or click'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>JPG, PNG, GIF, WEBP</div>
                </div>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />

          {/* File info */}
          {fileInfo && (
            <div style={{ background: 'var(--bg-primary)', borderRadius: 10, border: '1px solid var(--border-subtle)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center' }}>
              {[['Filename', fileInfo.name], ['Size', fileInfo.size], ['Dimensions', fileInfo.dims]].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{val}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Options row: format selection + presets side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Format selection */}
          <div style={{ background: 'var(--bg-primary)', borderRadius: 10, border: '1px solid var(--border-subtle)', padding: '16px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
              <svg style={{ width: 16, height: 16, color: 'var(--text-tertiary)', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Select Formats</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>{selected.size}/{FORMATS.length}</span>
            </div>

            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search formats…"
              style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', marginBottom: 10 }}
            />

            <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 4 }}>
              {Object.entries(groupedFiltered).map(([cat, items]) => (
                <div key={cat}>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 5 }}>{cat}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {items.map(fmt => (
                      <label key={fmt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '3px 2px', borderRadius: 5 }} title={`${fmt.description} (${fmt.w}×${fmt.h})`}>
                        <input type="checkbox" checked={selected.has(fmt.key)} onChange={() => toggleFormat(fmt.key)}
                          style={{ width: 14, height: 14, accentColor: 'var(--accent-primary)', cursor: 'pointer', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{fmt.label}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>{fmt.w}×{fmt.h}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Presets */}
          <div style={{ background: 'var(--bg-primary)', borderRadius: 10, border: '1px solid var(--border-subtle)', padding: '16px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
              <svg style={{ width: 16, height: 16, color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" /></svg>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Quick Presets</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
              {Object.entries(PRESETS).map(([name, keys]) => (
                <button key={name} onClick={() => applyPreset(keys)}
                  style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                  {name}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>Click a preset to quickly select formats for common use cases.</p>
          </div>
        </div>

        {/* Generate CTA */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={generate}
            disabled={!srcImg || selected.size === 0}
            style={{ padding: '14px 40px', borderRadius: 10, border: 'none', background: !srcImg || selected.size === 0 ? 'var(--border-default)' : 'var(--accent-primary)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: !srcImg || selected.size === 0 ? 'default' : 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Package size={16} weight="bold" />
            Generate {selected.size} Asset{selected.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Processing view ───────────────────────────────────────────────────────────

  if (view === 'processing') return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)' }}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 16, border: '1px solid var(--border-subtle)', padding: '48px 56px', textAlign: 'center', maxWidth: 420, width: '100%' }}>
        <svg style={{ width: 48, height: 48, margin: '0 auto', color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <div style={{ marginTop: 20, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Generating your assets…</div>
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
          {[
            [1, 'Processing image…'],
            [2, `Resizing to ${selected.size} formats…`],
            [3, 'Creating output files…'],
            [4, 'Packaging assets…'],
          ].map(([step, label]) => (
            <div key={step as number} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: processStep >= (step as number) ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
              {processStep > (step as number) ? (
                <svg style={{ width: 16, height: 16, color: '#10b981', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              ) : processStep === (step as number) ? (
                <svg style={{ width: 16, height: 16, color: 'var(--accent-primary)', flexShrink: 0, animation: 'pulse 1s infinite' }} fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" /></svg>
              ) : (
                <div style={{ width: 16, height: 16, borderRadius: '50%', border: '1.5px solid var(--border-default)', flexShrink: 0 }} />
              )}
              {label}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, fontSize: 12, color: 'var(--text-tertiary)' }}>This may take a moment for large images.</div>
      </div>
    </div>
  );

  // ── Results view ──────────────────────────────────────────────────────────────

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '28px 32px', background: 'var(--bg-secondary)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>Your Brand Kit is Ready!</div>

          {/* Big green ZIP button */}
          <button onClick={downloadZip}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 32px', borderRadius: 10, border: 'none', background: '#16a34a', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(22,163,74,0.35)', transition: 'opacity 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            <DownloadSimple size={18} weight="bold" />
            Download All Assets (.zip)
          </button>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Contains all {assets.length} generated images in a single package</div>

          <button onClick={reset}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            <ArrowCounterClockwise size={14} /> Start Over
          </button>
        </div>

        {/* Tabs */}
        <div>
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-subtle)', marginBottom: 16 }}>
            {(['assets', 'original'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveResultTab(tab)}
                style={{ padding: '8px 16px', background: 'transparent', border: 'none', borderBottom: `2px solid ${activeResultTab === tab ? 'var(--accent-primary)' : 'transparent'}`, color: activeResultTab === tab ? 'var(--accent-primary)' : 'var(--text-tertiary)', fontSize: 13, fontWeight: activeResultTab === tab ? 700 : 400, cursor: 'pointer', marginBottom: -1, transition: 'all 0.15s' }}>
                {tab === 'assets' ? 'Generated Assets' : 'Original Image'}
              </button>
            ))}
          </div>

          {/* Original image tab */}
          {activeResultTab === 'original' && srcUrl && (
            <div style={{ background: 'var(--bg-primary)', borderRadius: 10, border: '1px solid var(--border-subtle)', padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Original Uploaded Image</div>
              <img src={srcUrl} style={{ maxWidth: 320, maxHeight: 320, objectFit: 'contain', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }} />
              {fileInfo && (
                <a href={srcUrl} download={fileInfo.name}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
                  <DownloadSimple size={14} /> Download Original
                </a>
              )}
            </div>
          )}

          {/* Generated assets tab */}
          {activeResultTab === 'assets' && (
            <div style={{ background: 'var(--bg-primary)', borderRadius: 10, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Generated Formats</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {assets.length} assets generated from your image
                </div>
              </div>
              <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 8 }}>
                {assets.map(asset => (
                  <div key={asset.format.key}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-primary) 40%, transparent)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.boxShadow = 'none'; }}>

                    {/* Thumbnail + text */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{ width: 60, height: 60, flexShrink: 0, borderRadius: 5, border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={asset.url} alt={asset.format.label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{asset.format.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{asset.format.description}</div>
                      </div>
                    </div>

                    {/* Dimensions + download */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, padding: '2px 7px', borderRadius: 5, background: 'var(--bg-tertiary, rgba(0,0,0,0.07))', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {asset.format.w}×{asset.format.h}
                      </span>
                      <button
                        onClick={() => { const slug = projectName.replace(/\s+/g, '_').toLowerCase(); triggerDownload(asset.blob, `${slug}_${asset.format.key}.${asset.format.ext}`); }}
                        style={{ fontSize: 12, padding: '3px 9px', borderRadius: 5, border: '1px solid var(--border-subtle)', background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        .{asset.format.ext}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom ZIP button */}
              <div style={{ padding: '16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'center' }}>
                <button onClick={downloadZip}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 28px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  <DownloadSimple size={14} weight="bold" /> Download All (.zip)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
