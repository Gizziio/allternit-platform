import React from 'react';
import { z } from 'zod';
import { GlassCard } from '@/design/glass/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CaretUp, CaretDown } from '@phosphor-icons/react';
import { VideoUseRenderer } from './video-use/VideoUseRenderer';
import { VideoEditorView } from '../../views/design/video/VideoEditorView';
import { Hyperframe } from '../../views/design/hyperframes/HyperframeRenderer';
import { OrchestratorProgram } from '../../allternit-os/programs/OrchestratorProgram';

// Stub for missing Evaluator component
const Evaluator = () => <div className="p-4 text-sm text-muted-foreground">Evaluator view not available</div>;
const Orchestrator = OrchestratorProgram;

// ============================================================================
// Component Schemas (Zod)
// ============================================================================

export const schemas = {
  'v:stack': z.object({
    spacing: z.number().optional().default(4),
    direction: z.enum(['vertical', 'horizontal']).optional().default('vertical'),
    align: z.enum(['start', 'center', 'end', 'stretch']).optional().default('stretch'),
  }),
  'v:grid': z.object({
    cols: z.number().optional().default(1),
    gap: z.number().optional().default(4),
  }),
  'v:hyperframe': z.object({
    layout: z.enum(['flex', 'grid', 'stack']).optional().default('stack'),
    padding: z.number().optional().default(16),
    gap: z.number().optional().default(12),
    align: z.enum(['start', 'center', 'end', 'stretch']).optional().default('stretch'),
  }),
  'v:card': z.object({
    title: z.string().optional(),
    variant: z.enum(['default', 'primary', 'success', 'warning', 'danger']).optional().default('default'),
    elevation: z.enum(['flat', 'raised', 'floating']).optional().default('raised'),
  }),
  'v:metric': z.object({
    label: z.string(),
    val: z.string().or(z.number()),
    trend: z.enum(['up', 'down', 'none']).optional().default('none'),
    trendVal: z.string().optional(),
  }),
  'v:button': z.object({
    label: z.string(),
    variant: z.enum(['default', 'secondary', 'outline', 'ghost', 'destructive']).optional().default('default'),
    size: z.enum(['default', 'sm', 'lg', 'icon']).optional().default('default'),
    action: z.string().optional(),
  }),
  'v:input': z.object({
    label: z.string().optional(),
    placeholder: z.string().optional(),
    name: z.string(),
  }),
  'v:table': z.object({
    headers: z.array(z.string()),
    data: z.array(z.any()),
  }),
  'v:orchestrator': z.object({
    steps: z.array(z.object({
      title: z.string(),
      status: z.enum(['pending', 'running', 'completed', 'failed']),
      detail: z.string().optional(),
    })),
    currentStep: z.number().optional().default(0),
  }),
  'v:evaluator': z.object({
    title: z.string().optional(),
    optionA: z.object({ label: z.string(), content: z.string() }),
    optionB: z.object({ label: z.string(), content: z.string() }),
    onSelect: z.string().optional(),
  }),
  'v:video-manifest': z.object({
    template: z.string(),
    css: z.string().optional(),
    timeline: z.array(z.object({
      id: z.string(),
      start: z.number(),
      duration: z.number(),
      effect: z.string()
    })),
  }),
  'v:video-editor': z.object({
    projectName: z.string().optional(),
  }),
  'v:one-pager': z.object({
    title: z.string(),
    subtitle: z.string().optional(),
  }),
  'v:diagram-arc': z.object({
    labels: z.array(z.string()),
    values: z.array(z.number()),
  }),
  'v:skill-graph': z.object({
    nodes: z.array(z.object({ id: z.string(), label: z.string(), x: z.number().optional(), y: z.number().optional() })),
    links: z.array(z.object({ from: z.string(), to: z.string() })),
  }),
  'v:pipeline': z.object({
    items: z.array(z.object({ platform: z.string(), status: z.string(), content: z.string().optional() })),
  }),
};

// ============================================================================
// Global Action Handler
// ============================================================================

const handleUIAction = (actionName: string, data?: any) => {
  console.log(`[OpenUI Action] ${actionName}`, data);
  const event = new CustomEvent('allternit:ui-action', { 
    detail: { action: actionName, data } 
  });
  window.dispatchEvent(event);
};

// ============================================================================
// Component Implementations
// ============================================================================

const Table = ({ headers, data }: any) => (
  <div 
    className="w-full overflow-hidden border transition-all"
    style={{
      backgroundColor: 'var(--design-color-surface, rgba(255, 255, 255, 0.02))',
      borderColor: 'var(--design-color-primary, transparent)20',
      borderRadius: 'var(--design-radius-card, 12px)',
    }}
  >
    <table className="w-full text-left text-xs">
      <thead 
        className="font-bold uppercase tracking-wider transition-colors"
        style={{ 
          backgroundColor: 'var(--design-color-primary, transparent)10',
          color: 'var(--design-color-muted, var(--ui-text-muted))'
        }}
      >
        <tr>
          {headers.map((h: string, i: number) => (
            <th key={i} className="px-4 py-3">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody 
        className="divide-y"
        style={{ borderColor: 'var(--design-color-primary, transparent)10' }}
      >
        {data.map((row: any, i: number) => (
          <tr 
            key={i} 
            className="transition-colors hover:bg-white/[0.02]"
            style={{ color: 'var(--design-color-text, var(--ui-text-primary))' }}
          >
            {Array.isArray(row) 
              ? row.map((cell: any, j: number) => <td key={j} className="px-4 py-3">{cell}</td>)
              : headers.map((h: string, j: number) => <td key={j} className="px-4 py-3">{row[h.toLowerCase()]}</td>)
            }
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Stack = ({ spacing, direction, align, children }: any) => (
  <div 
    style={{ 
      display: 'flex', 
      flexDirection: direction === 'horizontal' ? 'row' : 'column',
      gap: `calc(var(--design-spacing-unit, 4px) * ${spacing})`,
      alignItems: align,
      width: '100%',
    }}
  >
    {children}
  </div>
);

const Grid = ({ cols, gap, children }: any) => (
  <div 
    style={{ 
      display: 'grid', 
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      gap: `calc(var(--design-spacing-unit, 4px) * ${gap})`,
      width: '100%',
    }}
  >
    {children}
  </div>
);

const MetricDisplay = ({ label, val, trend, trendVal }: any) => (
  <div 
    className="p-4 rounded-xl flex flex-col gap-1 border transition-colors"
    style={{
      backgroundColor: 'var(--design-color-surface, rgba(255, 255, 255, 0.03))',
      borderColor: 'var(--design-color-primary, var(--accent-chat))80',
    }}
  >
    <span 
      className="text-[10px] font-bold uppercase tracking-wider"
      style={{ color: 'var(--design-color-muted, var(--ui-text-muted))' }}
    >
      {label}
    </span>
    <div className="flex items-baseline gap-2">
      <span 
        className="text-2xl font-bold"
        style={{ color: 'var(--design-color-text, var(--ui-text-primary))' }}
      >
        {val}
      </span>
      {trend !== 'none' && (
        <span className={`text-xs flex items-center gap-0.5 ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
          {trend === 'up' ? <CaretUp size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />}
          {trendVal}
        </span>
      )}
    </div>
  </div>
);

const OpenUICard = ({ title, variant, elevation, children }: any) => (
  <GlassCard 
    variant={variant} 
    elevation={elevation} 
    className="w-full transition-all"
    style={{
      borderRadius: 'var(--design-radius-card, 16px)',
      borderWidth: '1.5px',
      borderColor: 'var(--design-color-primary, transparent)30',
    }}
  >
    {title && (
      <div className="mb-4 flex items-center gap-2">
        <div 
          className="w-1 h-3 rounded-full" 
          style={{ backgroundColor: 'var(--design-color-primary, var(--accent-chat))' }}
        />
        <h3 
          className="text-sm font-semibold tracking-tight"
          style={{ color: 'var(--design-color-text, var(--ui-text-primary))' }}
        >
          {title}
        </h3>
      </div>
    )}
    <div className="flex flex-col gap-4">
      {children}
    </div>
  </GlassCard>
);

const VideoManifestPreview = ({ template, css, timeline }: any) => (
  <div className="w-full flex flex-col gap-4">
    <div className="text-[10px] font-bold opacity-40 uppercase tracking-widest">HTML Manifestation Preview</div>
    <div 
      className="w-full aspect-video bg-black rounded-xl border border-white/10 overflow-hidden relative"
      dangerouslySetInnerHTML={{ __html: `<style>${css}</style>${template}` }}
    />
    <div className="grid grid-cols-2 gap-2">
      {timeline?.map((t: any) => (
        <div key={t.id} className="p-2 bg-white/5 rounded border border-white/5 text-[9px]">
           <span className="opacity-40">[{t.start}s]</span> {t.effect}
        </div>
      ))}
    </div>
  </div>
);

const SkillGraph = ({ nodes, links }: any) => (
  <div className="w-full aspect-square bg-black/40 rounded-2xl border border-white/5 relative overflow-hidden">
    <div className="absolute top-4 left-4 flex flex-col gap-1">
      <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Knowledge Graph</span>
      <span className="text-xs text-white/80">Active Nodes: {nodes?.length}</span>
    </div>
    <svg className="w-full h-full">
      {links?.map((l: any, i: number) => {
        const from = nodes.find((n: any) => n.id === l.from);
        const to = nodes.find((n: any) => n.id === l.to);
        if (!from || !to) return null;
        return <line key={i} x1={from.x || 50} y1={from.y || 50} x2={to.x || 100} y2={to.y || 100} stroke="var(--ui-border-default)" strokeWidth="1" />;
      })}
    </svg>
    {nodes?.map((n: any) => (
      <div key={n.id} className="absolute p-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-white/70" style={{ left: n.x || 50, top: n.y || 50 }}>
        {n.label}
      </div>
    ))}
  </div>
);

const Pipeline = ({ items }: any) => (
  <div className="w-full flex flex-col gap-2">
    {items?.map((item: any, i: number) => (
      <div key={i} className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/20 flex items-center justify-center text-[10px] font-black" style={{ backgroundColor: 'var(--design-color-primary, var(--accent-chat))', color: '#000' }}>{item.platform[0]}</div>
        <div className="flex-1">
          <div className="text-xs font-bold">{item.platform}</div>
          <div className="text-[10px] opacity-40 uppercase">{item.status}</div>
        </div>
        <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-[var(--accent-primary)]" style={{ width: item.status === 'Ready' ? '100%' : '40%', backgroundColor: 'var(--design-color-primary)' }} />
        </div>
      </div>
    ))}
  </div>
);

// ============================================================================
// The Component Registry
// ============================================================================

export const componentRegistry: Record<string, React.ComponentType<any>> = {
  'v:stack': Stack,
  'v:grid': Grid,
  'v:hyperframe': Hyperframe,
  'v:card': OpenUICard,
  'v:metric': MetricDisplay,
  'v:table': Table,
  'v:orchestrator': Orchestrator,
  'v:evaluator': Evaluator,
  'v:video-use': VideoUseRenderer,
  'v:video-editor': VideoEditorView,
  'v:video-manifest': VideoManifestPreview,
  'v:one-pager': ({ title, subtitle, children }: any) => (
     <div className="w-full p-8 border border-white/10 rounded-xl bg-white/5">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="opacity-40">{subtitle}</p>}
        <div className="mt-4">{children}</div>
     </div>
  ),
  'v:diagram-arc': ({ labels, values }: any) => (
     <div className="w-full flex gap-2 items-end h-24">
        {values?.map((v: number, i: number) => (
           <div key={i} className="flex-1 bg-[var(--design-color-primary)] opacity-40 rounded-t" style={{ height: `${v}%` }} />
        ))}
     </div>
  ),
  'v:skill-graph': SkillGraph,
  'v:pipeline': Pipeline,
  'v:input': ({ label, name, ...props }: any) => (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-[10px] font-bold uppercase text-[var(--ui-text-muted)] ml-1">{label}</label>}
      <Input {...props} name={name} className="bg-white/5 border-white/10" />
    </div>
  ),
  'v:button': ({ label, action, ...props }: any) => (
    <Button 
      {...props} 
      onClick={() => action && handleUIAction(action)}
      style={{
        borderRadius: 'var(--design-radius-button, 8px)',
        backgroundColor: props.variant === 'primary' ? 'var(--design-color-primary, var(--accent-chat))' : undefined,
        borderColor: props.variant === 'outline' ? 'var(--design-color-primary, var(--accent-chat))' : undefined,
      }}
    >
      {label}
    </Button>
  ),
};
