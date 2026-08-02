'use client';

import React from 'react';
import type { Icon } from '@phosphor-icons/react';
import {
  AppWindow,
  ArrowLeft,
  ArrowUpRight,
  Cpu,
  Desktop,
  Globe,
  GraduationCap,
  MicrosoftExcelLogo,
  MicrosoftPowerpointLogo,
  MicrosoftWordLogo,
  Play,
  PlugsConnected,
  PuzzlePiece,
  SquaresFour,
  Storefront,
  TerminalWindow,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

/*
 * Apps & Extensions marketplace.
 * Deliberately committed to the light warm palette of the reference design
 * (Downloads/Screen Recording 2026-07-12 at 6.17.27 PM.mov) in both themes,
 * so colors are literal rather than theme variables.
 */

const INK = '#1F1E1D';
const MUTED = '#6B685F';
const HAIRLINE = '#ECEAE3';
const CARD_BORDER = '#BBB4A1';

function openExternal(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function switchMode(mode: 'chat' | 'cowork' | 'code' | 'design' | 'browser'): void {
  window.dispatchEvent(new CustomEvent('allternit:switch-mode', { detail: { mode } }));
}

function openView(viewType: string): void {
  window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType } }));
}

function openSettings(section: string): void {
  window.dispatchEvent(new CustomEvent('allternit:open-settings', { detail: { section } }));
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function BetaBadge(): React.ReactNode {
  return (
    <span className="px-2.5 py-1 rounded-lg bg-[#DFE6F1] text-[#3D4B63] text-[12px] font-semibold leading-none">
      Beta
    </span>
  );
}

function PillButton({ label, external, dark, onClick }: {
  label: string;
  external?: boolean;
  dark?: boolean;
  onClick: () => void;
}): React.ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-xl text-[14px] font-medium cursor-pointer transition-colors shrink-0",
        dark
          ? "border-none bg-[#1F1E1D] text-[#FDFCFA] px-6 py-2.5 hover:bg-[#3A3835]"
          : "border border-solid border-[#CFCABC] bg-[#FDFCFA] text-[#1F1E1D] px-5 py-2 hover:bg-[#F3F1EA]"
      )}
    >
      {label}
      {external && <ArrowUpRight size={13} weight="bold" className="text-[#8A867C]" />}
    </button>
  );
}

function InstallRow({ icon: RowIcon, iconColor, label, beta, action }: {
  icon: Icon;
  iconColor?: string;
  label: string;
  beta?: boolean;
  action: React.ReactNode;
}): React.ReactNode {
  return (
    <div
      className="flex items-center justify-between gap-3 py-4 border-0 border-t border-solid first:border-t-0"
      style={{ borderColor: HAIRLINE }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <RowIcon size={26} weight="fill" style={{ color: iconColor ?? INK }} className="shrink-0" />
        <span className="text-[15px] font-medium truncate" style={{ color: INK }}>{label}</span>
        {beta && <BetaBadge />}
      </div>
      {action}
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }): React.ReactNode {
  return (
    <section
      className={cn(
        "relative flex flex-col rounded-[26px] border border-solid bg-[#FDFCFA]",
        "shadow-[0_1px_2px_rgba(31,30,29,0.05),0_12px_32px_rgba(31,30,29,0.06)]",
        "transition-shadow duration-300 hover:shadow-[0_2px_4px_rgba(31,30,29,0.06),0_18px_44px_rgba(31,30,29,0.10)]",
        className
      )}
      style={{ borderColor: CARD_BORDER }}
    >
      {children}
    </section>
  );
}

function CardHeading({ title, description, beta }: { title: string; description: string; beta?: boolean }): React.ReactNode {
  return (
    <>
      <div className="flex items-center gap-2.5 mb-3">
        <h2 className="m-0 text-[22px] font-semibold tracking-[-0.01em]" style={{ color: INK }}>{title}</h2>
        {beta && <BetaBadge />}
      </div>
      <p className="m-0 text-[15px] leading-relaxed" style={{ color: MUTED }}>{description}</p>
    </>
  );
}

/** Tinted panel that frames a product mockup, fully contained inside the card. */
function MockStage({ children, tint, className }: {
  children: React.ReactNode;
  tint: string;
  className?: string;
}): React.ReactNode {
  return (
    <div
      className={cn("relative rounded-2xl border border-solid border-[#E5E2D9] p-5", className)}
      style={{ background: tint }}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

// ─── Product mockups (the screenshots in the reference) ──────────────────────

function PromptChip({ text, className }: { text: string; className?: string }): React.ReactNode {
  return (
    <div className={cn("flex items-start gap-2 z-10", className)}>
      <div className="rounded-2xl rounded-br-md bg-[#FDFCFA] border border-solid border-[#DDD9CE] shadow-[0_6px_20px_rgba(31,30,29,0.12)] px-4 py-3 text-[13px] leading-snug max-w-[230px]" style={{ color: INK }}>
        {text}
      </div>
      <span className="size-7 rounded-full bg-[#FDFCFA] border border-solid border-[#DDD9CE] shadow-[0_4px_12px_rgba(31,30,29,0.12)] flex items-center justify-center shrink-0 -mt-2">
        <Play size={11} weight="fill" style={{ color: INK }} />
      </span>
    </div>
  );
}

function DesignCollage(): React.ReactNode {
  return (
    <div className="relative h-full p-8 pl-4 flex items-center">
      <PromptChip text="Show me 2 concepts for a journaling app" className="absolute left-[-8px] top-6" />
      <div className="w-full rounded-2xl border border-solid border-[#E5E2D9] bg-[#F2F0E9] shadow-[0_10px_40px_rgba(31,30,29,0.10)] overflow-hidden" aria-hidden="true">
        <div className="flex items-center gap-2 px-4 py-2.5 border-0 border-b border-solid border-[#E5E2D9] bg-[#FAF8F3]">
          <span className="text-[#B4B0A5] text-[11px]">←&ensp;→&ensp;⟳</span>
          <span className="flex-1 max-w-[220px] rounded-md bg-[#EFEDE5] px-3 py-1 text-[11px] text-[#8A867C]">ai.allternit.com/design</span>
        </div>
        <div className="flex justify-center gap-4 px-6 py-5">
          <div className="w-[150px]">
            <div className="text-[10px] font-semibold mb-1.5" style={{ color: MUTED }}>
              <span className="inline-flex size-4 items-center justify-center rounded bg-[#E5E2D9] mr-1 text-[9px]" style={{ color: INK }}>1</span>
              Focus timer
            </div>
            <div className="rounded-[16px] bg-[#141312] p-3 h-[170px] shadow-[0_8px_24px_rgba(31,30,29,0.18)]">
              <div className="text-[8px] text-[#8A867C] mb-1.5">9:41</div>
              <div className="text-[10px] text-[#F2F0E9] leading-snug mb-2.5">Write down what's weighing on you, then let it go.</div>
              <div className="rounded-lg bg-[#2A2826] h-[56px] mb-2 flex items-end px-2 pb-2 gap-[3px]">
                {[12, 22, 15, 28, 18, 34, 25, 38].map((h, i) => (
                  <span key={`flame-${i}`} className="flex-1 rounded-sm bg-gradient-to-t from-[#C15F3C] to-[#E8A87C]" style={{ height: h }} />
                ))}
              </div>
              <div className="h-1.5 rounded-full bg-[#2A2826] w-4/5 mb-1.5" />
              <div className="h-1.5 rounded-full bg-[#2A2826] w-3/5" />
            </div>
          </div>
          <div className="w-[160px]">
            <div className="text-[10px] font-semibold mb-1.5" style={{ color: MUTED }}>
              <span className="inline-flex size-4 items-center justify-center rounded bg-[#E5E2D9] mr-1 text-[9px]" style={{ color: INK }}>2</span>
              Daily journal
            </div>
            <div className="rounded-[16px] bg-[#FDFCFA] border border-solid border-[#E5E2D9] p-3 h-[170px] shadow-[0_8px_24px_rgba(31,30,29,0.10)]">
              <div className="text-[8px] text-[#B4B0A5] mb-1">9:41</div>
              <div className="text-[12px] font-bold mb-0.5" style={{ color: INK }}>Journal</div>
              <div className="text-[8px] text-[#B4B0A5] mb-2">Tuesday, Jun 3</div>
              <div className="grid grid-cols-7 gap-[3px] mb-2.5">
                {['26', '27', '28', '29', '30', '1', '2'].map((day, i) => (
                  <span
                    key={`day-${day}`}
                    className={cn(
                      "h-[14px] rounded-full text-center text-[7px] leading-[14px]",
                      i === 2 ? "bg-[#1F1E1D] text-[#FDFCFA]" : "text-[#8A867C]"
                    )}
                  >
                    {day}
                  </span>
                ))}
              </div>
              <div className="rounded-lg border border-solid border-[#EFEDE5] p-2">
                <div className="h-1.5 rounded-full bg-[#EFEDE5] w-3/4 mb-1.5" />
                <div className="h-1.5 rounded-full bg-[#EFEDE5] w-1/2" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpreadsheetMock(): React.ReactNode {
  const rows: Array<[string, string, string, string]> = [
    ['NVEX', 'Novex Technologies', 'Technology', '$312.45'],
    ['SLRP', 'SolarPeak Energy', 'Energy', '$87.30'],
    ['MDVR', 'MedVera Health', 'Healthcare', '$198.60'],
    ['CLDX', 'CloudAxis Software', 'Technology', '$245.88'],
    ['VRTX', 'Vortex Logistics', 'Industrials', '$128.90'],
    ['ZPAY', 'ZenPay Financial', 'Financials', '$165.20'],
  ];
  return (
    <div className="relative mt-10">
      <PromptChip text="Which names are the top movers in my portfolio and why?" className="absolute left-2 -top-6" />
      <MockStage tint="linear-gradient(135deg, #EDF1E8, #F7F6F1)" className="pt-9">
        <div className="rounded-xl border border-solid border-[#E5E2D9] bg-white overflow-hidden shadow-[0_8px_28px_rgba(31,30,29,0.08)]">
          <div className="px-3 py-1.5 text-[9px] font-semibold text-[#8A867C] border-0 border-b border-solid border-[#EFEDE5]">
            Portfolio Monitoring
          </div>
          <table className="w-full border-collapse text-[10px]" style={{ color: INK }}>
            <thead>
              <tr className="bg-[#35526E] text-white">
                {['Ticker', 'Company', 'Sector', 'Price ($)'].map((h, i) => (
                  <th key={h} className={cn("px-2.5 py-1 font-semibold", i === 3 ? "text-right" : "text-left")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([ticker, company, sector, price], i) => (
                <tr key={ticker} className={i % 2 ? 'bg-[#F7F6F1]' : 'bg-white'}>
                  <td className="px-2.5 py-1 font-bold text-left">{ticker}</td>
                  <td className="px-2.5 py-1 text-left">{company}</td>
                  <td className="px-2.5 py-1 text-left">{sector}</td>
                  <td className="px-2.5 py-1 tabular-nums text-right">{price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MockStage>
    </div>
  );
}

function MiniAppsMock(): React.ReactNode {
  const apps: Array<[string, string]> = [
    ['Runtime probe', '#6EBE71'],
    ['Sheets bridge', '#E5B255'],
    ['Ticket triage', '#6EBE71'],
  ];
  return (
    <div className="relative mt-10">
      <PromptChip text="Pin the runtime probe next to my code sessions." className="absolute right-2 -top-6 flex-row-reverse" />
      <MockStage tint="linear-gradient(135deg, #E8EEF2, #F7F6F1)" className="pt-9">
        <div className="flex flex-col gap-2.5">
          {apps.map(([name, dot]) => (
            <div key={name} className="flex items-center gap-3 rounded-xl border border-solid border-[#E5E2D9] bg-white px-3.5 py-2.5 shadow-[0_4px_14px_rgba(31,30,29,0.06)]">
              <span className="size-8 rounded-lg bg-[#F2F0E9] flex items-center justify-center">
                <AppWindow size={16} weight="duotone" style={{ color: MUTED }} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold" style={{ color: INK }}>{name}</div>
                <div className="h-1.5 rounded-full bg-[#EFEDE5] w-2/3 mt-1.5" />
              </div>
              <span className="size-2 rounded-full shrink-0" style={{ background: dot }} />
            </div>
          ))}
        </div>
      </MockStage>
    </div>
  );
}

function LabsCoursesMock(): React.ReactNode {
  const courses: Array<[string, string, 'CORE' | 'OPS', string]> = [
    ['ALABS-CORE-COPILOT', 'Build AI-Assisted Software with Copilot & Cursor', 'CORE', '7 modules'],
    ['ALABS-CORE-PROMPTS', 'Prompt Engineering & Systematic LLM Reasoning', 'CORE', '7 modules'],
    ['ALABS-OPS-N8N', 'Orchestrate Agents & Automations with n8n', 'OPS', '8 modules'],
  ];
  const tierStyles: Record<'CORE' | 'OPS', { bg: string; fg: string }> = {
    CORE: { bg: '#DFE6F1', fg: '#3D4B63' },
    OPS: { bg: '#EFE4CE', fg: '#7A6234' },
  };
  return (
    <div className="relative mt-10">
      <PromptChip text="Turn my research notebook into a lesson plan." className="absolute left-2 -top-6" />
      <MockStage tint="linear-gradient(135deg, #F2EDDD, #F7F6F1)" className="pt-9">
        <div className="flex flex-col gap-2.5">
          {courses.map(([code, title, tier, modules]) => (
            <div key={code} className="flex items-center gap-3 rounded-xl border border-solid border-[#E5E2D9] bg-white px-3.5 py-2.5 shadow-[0_4px_14px_rgba(31,30,29,0.06)]">
              <span className="size-8 rounded-lg bg-[#F2F0E9] flex items-center justify-center shrink-0">
                <GraduationCap size={16} weight="duotone" style={{ color: MUTED }} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold truncate" style={{ color: INK }}>{title}</div>
                <div className="text-[9px] mt-0.5" style={{ color: MUTED }}>{code} · {modules}</div>
              </div>
              <span
                className="px-2 py-0.5 rounded-md text-[9px] font-bold shrink-0"
                style={{ background: tierStyles[tier].bg, color: tierStyles[tier].fg }}
              >
                {tier}
              </span>
            </div>
          ))}
        </div>
      </MockStage>
    </div>
  );
}

function ConnectorGridMock(): React.ReactNode {
  const tiles = ['GM', 'SL', 'NO', 'DR', 'HU', 'JI', 'AS', 'TR', 'ZE', 'ST', 'GH', 'LN'];
  const tints = ['#E7EEE1', '#F0E4D8', '#DFE8F2', '#F2EBDA', '#E6DFF0', '#DEF0EB'];
  return (
    <div className="relative mt-10">
      <PromptChip text="Pull yesterday's tickets and draft replies for the top three." className="absolute right-2 -top-6 flex-row-reverse" />
      <MockStage tint="linear-gradient(135deg, #ECEAF3, #F7F6F1)" className="pt-10">
        <div className="grid grid-cols-6 gap-3 justify-items-center">
          {tiles.map((t, i) => (
            <span
              key={t}
              className="size-[52px] rounded-2xl border border-solid border-[#E0DCD1] shadow-[0_4px_14px_rgba(31,30,29,0.07)] flex items-center justify-center text-[13px] font-bold"
              style={{ background: tints[i % tints.length], color: MUTED }}
            >
              {t}
            </span>
          ))}
        </div>
      </MockStage>
    </div>
  );
}

function BrowserFlowMock(): React.ReactNode {
  return (
    <div className="relative mt-10">
      <MockStage tint="linear-gradient(135deg, #F4ECE7, #F7F6F1)">
        <div className="relative rounded-xl border border-solid border-[#E5E2D9] bg-white overflow-hidden shadow-[0_8px_28px_rgba(31,30,29,0.08)]">
          <div className="flex items-center gap-2 px-3.5 py-2 bg-[#F2F0E9] border-0 border-b border-solid border-[#E5E2D9]">
            <span className="size-2 rounded-full bg-[#E0655A]" />
            <span className="size-2 rounded-full bg-[#E5B255]" />
            <span className="size-2 rounded-full bg-[#6EBE71]" />
            <span className="ml-2 flex items-center gap-1.5 rounded-t-lg bg-white px-3 py-1 text-[10px] font-medium" style={{ color: INK }}>
              <span className="size-3 rounded bg-[#1F1E1D] text-white text-[7px] font-bold flex items-center justify-center">A</span>
              Returns
              <span className="text-[#B4B0A5]">✕</span>
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 border-0 border-b border-solid border-[#EFEDE5]">
            <span className="text-[#B4B0A5] text-[10px]">←&ensp;→&ensp;⟳</span>
            <span className="flex-1 rounded-lg bg-[#F2F0E9] px-3 py-1 text-[10px] text-[#8A867C]">clawdshop.com/orders</span>
          </div>
          <div className="px-5 pt-4 pb-5">
            <div className="flex items-center gap-2 mb-4 text-[9px]" style={{ color: MUTED }}>
              <span className="size-4 rounded-full bg-[#1F1E1D] text-white flex items-center justify-center font-bold">1</span>
              <span className="font-semibold" style={{ color: INK }}>Start a return</span>
              <span className="flex-1 h-px bg-[#EFEDE5]" />
              <span className="size-4 rounded-full bg-[#EFEDE5] flex items-center justify-center font-bold">2</span>
              Select reason
              <span className="flex-1 h-px bg-[#EFEDE5]" />
              <span className="size-4 rounded-full bg-[#EFEDE5] flex items-center justify-center font-bold">3</span>
              Confirmation
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-solid border-[#EFEDE5] bg-[#FDFCFA] p-3 shadow-[0_4px_16px_rgba(31,30,29,0.05)]">
              <span className="size-11 rounded-lg bg-gradient-to-br from-[#F4D8CE] to-[#E8B4A4] flex items-center justify-center text-[16px]">🎧</span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold" style={{ color: INK }}>Wireless Headphones Pro</div>
                <div className="text-[9px]" style={{ color: MUTED }}>Order #8294-1847 · Delivered Jan 28</div>
                <div className="text-[10px] font-semibold mt-0.5" style={{ color: INK }}>$79.99</div>
              </div>
              <span className="rounded-lg bg-[#1F1E1D] text-white text-[10px] font-semibold px-3 py-1.5">Start return</span>
            </div>
          </div>
          {/* Cursor chips */}
          <span className="absolute right-[24%] top-[42%] rounded-full rounded-tl-none bg-[#3B6FDB] text-white text-[10px] font-bold px-2.5 py-1 shadow-[0_4px_12px_rgba(31,30,29,0.2)]">You</span>
          <span className="absolute right-[6%] bottom-[30%] rounded-full rounded-tl-none bg-[#C15F3C] text-white text-[10px] font-bold px-2.5 py-1 shadow-[0_4px_12px_rgba(31,30,29,0.2)]">Allternit</span>
        </div>
      </MockStage>
    </div>
  );
}

function TerminalMock(): React.ReactNode {
  return (
    <div className="relative mt-10">
      <MockStage
        tint="#F7F5EF"
        className="[background-image:radial-gradient(#DDD9CE_1px,transparent_1px)] [background-size:14px_14px]"
      >
        <div className="rounded-xl border border-solid border-[#E5E2D9] bg-[#FDFCFA] shadow-[0_8px_28px_rgba(31,30,29,0.08)]">
          <div className="flex items-center gap-2 px-4 py-2.5">
            <span className="size-2.5 rounded-full bg-[#E0655A]" />
            <span className="size-2.5 rounded-full bg-[#E5B255]" />
            <span className="size-2.5 rounded-full bg-[#6EBE71]" />
          </div>
          <div className="px-5 pb-5 pt-1 font-mono text-[13px] leading-7">
            <div style={{ color: INK }}><span className="text-[#C15F3C]">&gt;</span> Fix the auth bug in signup flow</div>
            <div className="text-[#C15F3C]">✳ Contemplating…</div>
          </div>
        </div>
      </MockStage>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function AppsExtensionsView(): React.ReactNode {
  return (
    <div className="h-full overflow-y-auto bg-[#F5F4EF]">
      <div className="w-full max-w-6xl mx-auto px-8 pt-10 pb-12 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1
              className="text-3xl font-medium tracking-tight m-0"
              style={{ color: INK, fontFamily: 'var(--font-serif)' }}
            >
              Apps and extensions
            </h1>
            <p className="m-0 mt-1 text-sm" style={{ color: MUTED }}>
              Do more with Allternit, everywhere you work
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => switchMode('chat')}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-solid border-[#E5E2D9] bg-[#FAF9F5] text-sm hover:border-[#D8D4C8] transition-colors cursor-pointer"
              style={{ color: MUTED }}
            >
              <ArrowLeft size={14} weight="bold" />
              Back
            </button>
          </div>
        </div>

        <div className="mt-10">

        {/* Featured: Allternit Design */}
        <Card className="mb-8 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="p-10 md:p-12 flex flex-col items-start">
              <div className="flex items-center gap-2.5 mb-4">
                <h2 className="m-0 text-[24px] font-semibold tracking-[-0.01em]" style={{ color: INK }}>Allternit Design</h2>
                <BetaBadge />
              </div>
              <p className="m-0 mb-1 text-[16px]" style={{ color: MUTED }}>
                Build something you can click, share, or present:
              </p>
              <ul className="m-0 mb-10 pl-5 flex flex-col gap-2 text-[16px] list-disc" style={{ color: MUTED }}>
                <li><strong className="font-semibold" style={{ color: INK }}>Prototypes</strong> you can click</li>
                <li><strong className="font-semibold" style={{ color: INK }}>Wireframes</strong> from a sketch</li>
                <li><strong className="font-semibold" style={{ color: INK }}>Slides</strong> from your documents</li>
                <li><strong className="font-semibold" style={{ color: INK }}>Anything else</strong> you can describe</li>
              </ul>
              <div className="mt-auto">
                <PillButton label="Open" dark onClick={() => switchMode('design')} />
              </div>
            </div>
            <div className="bg-gradient-to-br from-[#F0EDE4] to-[#F7F5EF] border-0 md:border-l border-solid border-[#E5E2D9]">
              <DesignCollage />
            </div>
          </div>
        </Card>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          <Card className="p-10">
            <CardHeading
              title="Microsoft 365"
              description="Analyze data, build presentations, and draft documents — each Office host gets its own Allternit companion."
            />
            <div className="mt-5">
              <InstallRow
                icon={MicrosoftExcelLogo}
                iconColor="#217346"
                label="Excel"
                action={<PillButton label="Open" onClick={() => openView('addin-excel')} />}
              />
              <InstallRow
                icon={MicrosoftPowerpointLogo}
                iconColor="#D24726"
                label="PowerPoint"
                action={<PillButton label="Open" onClick={() => openView('addin-ppt')} />}
              />
              <InstallRow
                icon={MicrosoftWordLogo}
                iconColor="#2B579A"
                label="Word"
                action={<PillButton label="Open" onClick={() => openView('addin-word')} />}
              />
            </div>
            <div className="mt-auto">
              <SpreadsheetMock />
            </div>
          </Card>

          <Card className="p-10">
            <CardHeading
              title="Mini-apps"
              description="Discovered runtimes and connectors that open inside the browser surface. Pin favorites to your rail."
            />
            <div className="mt-5">
              <InstallRow
                icon={AppWindow}
                label="Mini-apps store"
                action={<PillButton label="Open" onClick={() => openView('mini-apps-store')} />}
              />
              <InstallRow
                icon={SquaresFour}
                label="Office & extensions manager"
                action={<PillButton label="Open" onClick={() => openView('browser-extensions')} />}
              />
            </div>
            <div className="mt-auto">
              <MiniAppsMock />
            </div>
          </Card>

          <Card className="p-10">
            <CardHeading
              title="Allternit for Web"
              description="Allternit navigates, clicks buttons, and fills forms in your browser. Works in Cowork."
            />
            <div className="mt-5">
              <InstallRow
                icon={PuzzlePiece}
                label="Allternit Extension"
                action={<PillButton label="Install" external onClick={() => openExternal('https://allternit.com/extension')} />}
              />
              <InstallRow
                icon={Globe}
                label="Browser surface"
                action={<PillButton label="Open" onClick={() => switchMode('browser')} />}
              />
            </div>
            <div className="mt-auto">
              <BrowserFlowMock />
            </div>
          </Card>

          <Card className="p-10">
            <CardHeading
              title="Gizzi Code"
              description="Build, debug, and ship from your terminal or IDE."
            />
            <div className="mt-5">
              <InstallRow
                icon={TerminalWindow}
                label="Terminal"
                action={<PillButton label="Install" external onClick={() => openExternal('https://allternit.com/cli')} />}
              />
              <InstallRow
                icon={Desktop}
                label="Desktop app"
                action={<PillButton label="Download" external onClick={() => openExternal('https://allternit.com/download')} />}
              />
              <InstallRow
                icon={Cpu}
                label="Code mode"
                action={<PillButton label="Open" onClick={() => switchMode('code')} />}
              />
            </div>
            <div className="mt-auto">
              <TerminalMock />
            </div>
          </Card>

          <Card className="p-10">
            <CardHeading
              title="A://Labs"
              description="The Allternit learning portal — a discovery feed, guided course tracks, classroom lessons, and certifications."
            />
            <div className="mt-5">
              <InstallRow
                icon={GraduationCap}
                label="Learning portal"
                action={<PillButton label="Open" onClick={() => window.dispatchEvent(new CustomEvent('allternit:open-labs'))} />}
              />
            </div>
            <div className="mt-auto">
              <LabsCoursesMock />
            </div>
          </Card>

          <Card className="p-10">
            <CardHeading
              title="Connectors & marketplace"
              description="Connect Allternit to a thousand-plus apps and services, and extend it with skills and plugins."
            />
            <div className="mt-5">
              <InstallRow
                icon={PlugsConnected}
                label="Connector catalog"
                action={<PillButton label="Open" onClick={() => openSettings('connectors')} />}
              />
              <InstallRow
                icon={Storefront}
                label="Marketplace"
                action={<PillButton label="Open" onClick={() => openView('marketplace')} />}
              />
              <InstallRow
                icon={GraduationCap}
                label="Skills"
                action={<PillButton label="Open" onClick={() => openSettings('skills')} />}
              />
              <InstallRow
                icon={PuzzlePiece}
                label="Plugins"
                action={<PillButton label="Open" onClick={() => openView('plugins')} />}
              />
            </div>
            <div className="mt-auto">
              <ConnectorGridMock />
            </div>
          </Card>
        </div>
        </div>
      </div>
    </div>
  );
}
