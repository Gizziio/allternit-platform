
import React, { useState } from 'react';
import { ALL_TEMPLATES } from '@/components/chat/TemplatePreviewCards';
import { MODE_TABS } from './ModeDock';

export interface Template {
  title: string;
  description: string;
  prompt: string;
  previewImage: string;
}

const FEATURED_TEMPLATES: Partial<Record<string, Template[]>> = {
  swarms: [
    { title: 'VS Code Web Replica', description: 'Coordinate a team to recreate a complete browser IDE', prompt: 'Use an agent swarm to build a polished, working VS Code web replica. Split the work across product, frontend, systems, and QA agents.', previewImage: '/images/templates/agent-cards/swarm-vscode.jpg' },
    { title: 'Build Linux System', description: 'Plan and assemble a complete Linux environment', prompt: 'Use an agent swarm to design and build a complete Linux system. Coordinate architecture, packages, security, desktop, and validation.', previewImage: '/images/templates/agent-cards/swarm-linux.jpg' },
    { title: 'Pixel-Perfect Zotero: 500+ Papers', description: 'Research and reproduce a large reference workspace', prompt: 'Use an agent swarm to create a pixel-perfect Zotero-style research workspace capable of organizing more than 500 papers.', previewImage: '/images/templates/agent-cards/swarm-zotero.jpg' },
  ],
  research: [
    { title: 'Shein Profit & Risk', description: 'Analyze profitability, exposure, and strategic risk', prompt: 'Create an in-depth research report on Shein profit drivers and business risks, with evidence, charts, and cited sources.', previewImage: '/images/templates/agent-cards/research-shein.jpg' },
    { title: 'Impressionism Timeline Research', description: 'Build a sourced visual history of Impressionism', prompt: 'Research the history of Impressionism and produce a cited timeline covering its artists, movements, exhibitions, and influence.', previewImage: '/images/templates/agent-cards/research-impressionism.jpg' },
    { title: 'BCI Industry Landscape', description: 'Map the brain-computer interface market', prompt: 'Create an in-depth, cited landscape report on the brain-computer interface industry, including companies, technology, funding, and market outlook.', previewImage: '/images/templates/agent-cards/research-bci.jpg' },
  ],
  website: [
    { title: 'Cyber Rain', description: 'Dark, cinematic technology landing page', prompt: 'Build a production-ready dark technology website inspired by falling code and cinematic cyber interfaces.', previewImage: '/images/templates/agent-cards/web-cyber-rain.jpg' },
    { title: 'Color Room', description: 'Immersive editorial gallery experience', prompt: 'Build an immersive editorial gallery website with bold color rooms, art direction, and fluid transitions.', previewImage: '/images/templates/agent-cards/web-color-room.jpg' },
    { title: 'Flow Shader', description: 'Atmospheric WebGL creative studio site', prompt: 'Build an atmospheric creative studio website centered on an interactive flowing shader and minimal typography.', previewImage: '/images/templates/agent-cards/web-flow-shader.jpg' },
    { title: 'Sunset Trip', description: 'Warm, cinematic travel experience', prompt: 'Build a cinematic travel website with warm sunset photography, editorial storytelling, and refined motion.', previewImage: '/images/templates/agent-cards/web-sunset-trip.jpg' },
    { title: 'Dream Run', description: 'Futuristic product launch page', prompt: 'Build a futuristic product launch website with a neon horizon, strong typography, and precise scroll choreography.', previewImage: '/images/templates/agent-cards/web-dream-run.jpg' },
    { title: 'Vortex Gallery', description: 'Spatial portfolio and image gallery', prompt: 'Build a spatial image gallery website with perspective, layered artwork, and smooth interactive navigation.', previewImage: '/images/templates/agent-cards/web-vortex-gallery.jpg' },
  ],
  slides: [
    { title: 'Freestyle', description: 'Adaptive presentation design for any topic', prompt: 'Create a polished presentation using an adaptive freestyle visual system. Ask for my topic and desired slide count.', previewImage: '/images/templates/agent-cards/slides-freestyle.jpg' },
    { title: 'Bold Blue', description: 'High-impact campaign and launch deck', prompt: 'Create a bold blue presentation with oversized typography, sharp geometry, and a high-impact campaign aesthetic.', previewImage: '/images/templates/agent-cards/slides-bold-blue.jpg' },
    { title: 'Graphite Cyan', description: 'Technical AI and research presentation', prompt: 'Create a graphite and cyan presentation for a technical or AI topic, balancing clarity, diagrams, and editorial restraint.', previewImage: '/images/templates/agent-cards/slides-graphite-cyan.jpg' },
    { title: 'The Science of Sleep', description: 'Calm editorial research deck', prompt: 'Create an editorial research presentation about sleep science with calm typography, clear evidence, and readable charts.', previewImage: '/images/templates/agent-cards/slides-sleep.jpg' },
    { title: 'New Hire', description: 'Clean employee onboarding deck', prompt: 'Create a clean new-hire onboarding presentation covering the company, team, role, tools, and first-week plan.', previewImage: '/images/templates/agent-cards/slides-new-hire.jpg' },
    { title: 'History and Culture of Tea', description: 'Story-led educational presentation', prompt: 'Create a story-led presentation on the history and culture of tea with an elegant editorial visual system.', previewImage: '/images/templates/agent-cards/slides-tea.jpg' },
  ],
  docs: [
    { title: 'Project Proposal', description: 'Structured scope, timeline, and budget', prompt: 'Draft a professional project proposal. Ask me for the client, goals, scope, timeline, deliverables, and budget.', previewImage: '/images/templates/agent-cards/docs-proposal.jpg' },
    { title: 'Research Report', description: 'Evidence-backed long-form document', prompt: 'Create a structured research report with an executive summary, methodology, findings, citations, and recommendations.', previewImage: '/images/templates/agent-cards/docs-report.jpg' },
    { title: 'Product Requirements', description: 'Clear PRD with requirements and acceptance criteria', prompt: 'Draft a complete product requirements document with context, goals, users, requirements, edge cases, and acceptance criteria.', previewImage: '/images/templates/agent-cards/docs-prd.jpg' },
  ],
  data: [
    { title: 'CSV Analysis', description: 'Upload, profile, and analyze datasets', prompt: 'Analyze my data. Upload your CSV or spreadsheet and calculate statistics, identify patterns, segment results, flag anomalies, and extract actionable insights.', previewImage: '/images/templates/agent-cards/sheets-csv.jpg' },
    { title: 'SQL Queries', description: 'Query relational data efficiently', prompt: 'Help me write SQL queries. Ask for my database schema and the analysis I need, then produce optimized queries with explanations and performance considerations.', previewImage: '/images/templates/agent-cards/sheets-sql.jpg' },
    { title: 'Data Visualization', description: 'Build clear charts and dashboards', prompt: 'Create data visualizations from my dataset or metrics. Recommend appropriate chart types and produce a clear dashboard that communicates the important insights.', previewImage: '/images/templates/agent-cards/sheets-viz.jpg' },
    { title: 'Forecasting', description: 'Project trends with confidence ranges', prompt: 'Build a forecast model from my historical data. Analyze trend and seasonality, then create projections with assumptions, validation metrics, and confidence intervals.', previewImage: '/images/templates/agent-cards/sheets-forecast.jpg' },
  ],
};

export function getModeTemplates(modeId: string): Template[] {
  const featured = FEATURED_TEMPLATES[modeId];
  if (featured) return featured;
  const templates = ALL_TEMPLATES[modeId];
  if (!templates) return [];
  const seenImages = new Set<string>();
  return templates.map((t) => ({
    title: t.name,
    description: t.description,
    prompt: t.prompt,
    previewImage: t.previewImage,
  })).filter((template) => {
    // Never show two cards with the same artwork. The legacy catalogs include
    // repeated fallback images; hiding those duplicates keeps every visible
    // template visually distinct until it receives purpose-built artwork.
    if (seenImages.has(template.previewImage)) return false;
    seenImages.add(template.previewImage);
    return true;
  });
}

function TemplateCard({
  title,
  description,
  prompt,
  previewImage,
  color,
  modeLabel,
  imagePosition,
  onClick,
}: Template & { color: string; modeLabel: string; imagePosition: string; onClick?: (prompt: string) => void }) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onClick?.(prompt)}
      className="group relative flex flex-col overflow-hidden bg-[color-mix(in_srgb,var(--surface-panel)_86%,transparent)] border border-white/[0.08] rounded-2xl cursor-pointer text-left transition-all duration-300 ease-out hover:-translate-y-1 hover:border-white/[0.18] hover:shadow-[0_18px_42px_rgba(0,0,0,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-chat)]"
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = color)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
    >
      <div
        className="h-[132px] relative overflow-hidden bg-black/20"
        style={{
          background: `linear-gradient(135deg, ${color}20 0%, ${color}05 100%)`,
        }}
      >
        <img
          src={previewImage}
          alt={title}
          className={`w-full h-full object-cover scale-[1.02] transition-[opacity,transform] duration-500 ease-out group-hover:scale-[1.07] ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ objectPosition: imagePosition }}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(false)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/[0.08] to-white/[0.06] pointer-events-none" />
        <div className="absolute left-3 top-3 rounded-full border border-white/[0.14] bg-black/35 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white/80 backdrop-blur-md">
          {modeLabel}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px opacity-70" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      </div>
      <div className="flex min-h-[82px] flex-col px-3.5 py-3">
        <div className="mb-1.5 text-[13px] font-bold tracking-[-0.01em] text-primary transition-colors group-hover:text-white">{title}</div>
        <div className="text-[11px] text-muted leading-[1.45] line-clamp-2">{description}</div>
      </div>
    </button>
  );
}

interface TemplateGalleryProps {
  modeId: string;
  onSelectTemplate?: (prompt: string, template: Template) => void;
}

export function TemplateGallery({ modeId, onSelectTemplate }: TemplateGalleryProps) {
  const templates = getModeTemplates(modeId);
  const mode = MODE_TABS.find((m) => m.id === modeId);

  if (!mode || templates.length === 0) return null;

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-[var(--ui-text-secondary)] uppercase tracking-[0.14em]">
          Featured {mode.label} Cases
        </span>
        <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[10px] text-[var(--ui-text-muted)]">{templates.length} templates</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template, index) => (
          <TemplateCard
            key={template.title}
            {...template}
            color={mode.color}
            modeLabel={mode.label}
            imagePosition={index % 3 === 0 ? '42% center' : index % 3 === 1 ? 'center center' : '58% center'}
            onClick={(prompt) => onSelectTemplate?.(prompt, template)}
          />
        ))}
      </div>
    </div>
  );
}
