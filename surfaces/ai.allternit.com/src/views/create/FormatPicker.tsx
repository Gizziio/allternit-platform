"use client";

import React, { useMemo, useState } from 'react';
import { Check, CaretDown, Ruler } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  MODE_FORMAT_CONFIGS,
  type FormatSelection,
  type ModeFormatConfig,
  type FormatTab,
  type FormatOption,
} from './presets';

interface FormatPickerProps {
  modeId: string;
  value: FormatSelection | null | undefined;
  onChange: (selection: FormatSelection) => void;
  color?: string;
  disabled?: boolean;
}

export function FormatPicker({ modeId, value, onChange, color, disabled }: FormatPickerProps) {
  const [open, setOpen] = useState(false);
  const config = MODE_FORMAT_CONFIGS[modeId];
  if (!config) return null;

  const selection = value ?? {
    modeId,
    tabId: config.defaultTab,
    optionId: config.defaultOption,
    custom: null,
  };

  const activeTab = config.tabs.find((t) => t.id === selection.tabId) ?? config.tabs[0];
  const activeOption = activeTab.options.find((o) => o.id === selection.optionId);

  const displayLabel = activeOption?.label ?? activeTab.label;
  const displayDetail = activeOption?.detail;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={`Format: ${activeTab.label} · ${displayLabel}`}
          className={cn(
            'inline-flex items-center gap-1.5 h-7 pl-2.5 pr-2 rounded-full text-[11px] font-bold transition-all border',
            'bg-composer-soft border-composer-border text-secondary hover:text-primary hover:bg-composer-hover'
          )}
        >
          <Ruler size={12} weight="bold" />
          <span>{activeTab.label}</span>
          <span className="text-composer-muted">·</span>
          <span className="text-primary">{displayLabel}</span>
          <CaretDown size={10} className={cn('transition-transform opacity-70', open && 'rotate-180')} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-[360px] p-0 bg-[#1c1c1e] backdrop-blur-[20px] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden"
        style={{ boxShadow: '0 18px 50px rgba(0,0,0,0.45)' }}
      >
        <div className="flex items-center border-b border-white/[0.08]">
          {config.tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                const firstOption = tab.options[0];
                if (firstOption) {
                  onChange({ ...selection, tabId: tab.id, optionId: firstOption.id, custom: null });
                }
              }}
              className={cn(
                'flex-1 py-2.5 text-[11px] font-semibold transition-colors relative',
                selection.tabId === tab.id ? 'text-white' : 'text-composer-muted hover:text-secondary'
              )}
            >
              {tab.label}
              {selection.tabId === tab.id && (
                <span
                  className="absolute bottom-0 left-3 right-3 h-[2px] rounded-t-full"
                  style={{ background: color ?? 'var(--accent-chat)' }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="p-3">
          <OptionGrid
            tab={activeTab}
            selection={selection}
            onSelect={(option) => {
              onChange({ ...selection, optionId: option.id, custom: null });
              if (!activeTab.allowCustom) setOpen(false);
            }}
            accent={color}
          />

          {activeTab.allowCustom && (
            <CustomSize
              selection={selection}
              onChange={onChange}
              onApply={() => setOpen(false)}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function OptionGrid({
  tab,
  selection,
  onSelect,
  accent,
}: {
  tab: FormatTab;
  selection: FormatSelection;
  onSelect: (option: FormatOption) => void;
  accent?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {tab.options.map((option) => {
        const selected = selection.optionId === option.id && !selection.custom;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option)}
            className={cn(
              'relative flex flex-col items-start gap-0.5 p-2.5 rounded-xl text-left transition-all border',
              selected
                ? 'bg-white/[0.08] border-white/[0.18]'
                : 'bg-transparent border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.12]'
            )}
          >
            <span className="text-[12px] font-semibold text-primary">{option.label}</span>
            {option.detail && (
              <span className="text-[10px] text-composer-muted leading-tight">{option.detail}</span>
            )}
            {selected && (
              <span
                className="absolute top-2 right-2 size-4 rounded-full flex items-center justify-center"
                style={{ background: accent ?? 'var(--accent-chat)' }}
              >
                <Check size={9} weight="bold" className="text-white" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function CustomSize({
  selection,
  onChange,
  onApply,
}: {
  selection: FormatSelection;
  onChange: (selection: FormatSelection) => void;
  onApply: () => void;
}) {
  const custom = selection.custom ?? { width: 1080, height: 1080, unit: 'px' as const };
  const [width, setWidth] = useState(String(custom.width));
  const [height, setHeight] = useState(String(custom.height));
  const [unit, setUnit] = useState<'px' | 'cm'>(custom.unit);

  return (
    <div className="mt-3 pt-3 border-t border-white/[0.08]">
      <div className="text-[11px] font-semibold text-secondary mb-2">Custom Size</div>
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 rounded-lg bg-white/[0.05] border border-white/[0.08] px-2 py-1.5">
          <input
            type="number"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-[12px] text-primary text-center"
            placeholder="Width"
          />
          <span className="text-[10px] text-composer-muted uppercase">{unit}</span>
        </div>
        <span className="text-composer-muted">×</span>
        <div className="flex-1 flex items-center gap-2 rounded-lg bg-white/[0.05] border border-white/[0.08] px-2 py-1.5">
          <input
            type="number"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-[12px] text-primary text-center"
            placeholder="Height"
          />
          <span className="text-[10px] text-composer-muted uppercase">{unit}</span>
        </div>
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as 'px' | 'cm')}
          className="h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[11px] text-primary px-2 outline-none"
        >
          <option value="px">px</option>
          <option value="cm">cm</option>
        </select>
      </div>
      <button
        type="button"
        onClick={() => {
          const w = Number(width);
          const h = Number(height);
          if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
            onChange({
              ...selection,
              optionId: 'custom',
              custom: { width: w, height: h, unit },
            });
            onApply();
          }
        }}
        className="w-full mt-2 py-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-[11px] font-semibold text-primary transition-colors"
      >
        Apply Custom Size
      </button>
    </div>
  );
}
