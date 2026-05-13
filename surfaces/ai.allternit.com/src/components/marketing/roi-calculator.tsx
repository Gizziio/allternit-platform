'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconCalculator,
  IconTrendingUp,
  IconClock,
  IconUsers,
  IconCurrencyDollar,
  IconRefresh,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';

export interface ROICalculatorProps {
  className?: string;
}

interface CalculatorInput {
  teamSize: number;
  hoursPerWeek: number;
  hourlyRate: number;
  aiSpeedup: number; // percentage (e.g., 40 = 40% faster)
  aiCostPerMonth: number;
}

const DEFAULT_INPUTS: CalculatorInput = {
  teamSize: 5,
  hoursPerWeek: 40,
  hourlyRate: 75,
  aiSpeedup: 40,
  aiCostPerMonth: 200,
};

export function ROICalculator({ className }: ROICalculatorProps) {
  const [inputs, setInputs] = useState<CalculatorInput>(DEFAULT_INPUTS);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleReset = useCallback(() => {
    setIsAnimating(true);
    setInputs(DEFAULT_INPUTS);
    setTimeout(() => setIsAnimating(false), 600);
  }, []);

  const results = useMemo(() => {
    const weeklyHoursSaved = inputs.teamSize * inputs.hoursPerWeek * (inputs.aiSpeedup / 100);
    const monthlyHoursSaved = weeklyHoursSaved * 4.33;
    const monthlyCostSaved = monthlyHoursSaved * inputs.hourlyRate;
    const monthlyNetSavings = monthlyCostSaved - inputs.aiCostPerMonth;
    const yearlySavings = monthlyNetSavings * 12;
    const roi = inputs.aiCostPerMonth > 0 ? (monthlyNetSavings / inputs.aiCostPerMonth) * 100 : 0;
    const paybackMonths = monthlyNetSavings > 0 ? inputs.aiCostPerMonth / monthlyNetSavings : 0;

    return {
      weeklyHoursSaved,
      monthlyHoursSaved,
      monthlyCostSaved,
      monthlyNetSavings,
      yearlySavings,
      roi,
      paybackMonths,
    };
  }, [inputs]);

  const updateInput = useCallback(<K extends keyof CalculatorInput>(
    key: K,
    value: CalculatorInput[K]
  ) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);

  const formatNumber = (value: number, decimals = 1) =>
    new Intl.NumberFormat('en-US', {
      maximumFractionDigits: decimals,
    }).format(value);

  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl border border-[var(--ui-border-muted)] bg-[var(--surface-panel)]',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--ui-border-muted)] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9  items-center justify-center rounded-lg bg-[var(--accent-primary)]/10">
            <IconCalculator className="size-5  text-[var(--accent-primary)]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">AI ROI Calculator</h3>
            <p className="text-xs text-[var(--text-muted)]">Estimate your team's savings with AI</p>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        >
          <IconRefresh className={cn('size-3.5 ', isAnimating && 'animate-spin')} />
          Reset
        </button>
      </div>

      <div className="grid gap-0 lg:grid-cols-2">
        {/* Inputs */}
        <div className="space-y-5 p-6">
          <InputField
            icon={<IconUsers className="size-4 " />}
            label="Team Size"
            value={inputs.teamSize}
            onChange={(v) => updateInput('teamSize', v)}
            min={1}
            max={100}
            step={1}
            suffix="people"
          />
          <InputField
            icon={<IconClock className="size-4 " />}
            label="Hours per Week"
            value={inputs.hoursPerWeek}
            onChange={(v) => updateInput('hoursPerWeek', v)}
            min={1}
            max={80}
            step={1}
            suffix="hrs/week"
          />
          <InputField
            icon={<IconCurrencyDollar className="size-4 " />}
            label="Hourly Rate"
            value={inputs.hourlyRate}
            onChange={(v) => updateInput('hourlyRate', v)}
            min={10}
            max={500}
            step={5}
            prefix="$"
            suffix="/hr"
          />
          <InputField
            icon={<IconTrendingUp className="size-4 " />}
            label="AI Speedup"
            value={inputs.aiSpeedup}
            onChange={(v) => updateInput('aiSpeedup', v)}
            min={5}
            max={90}
            step={5}
            suffix="%"
          />
          <InputField
            icon={<IconCurrencyDollar className="size-4 " />}
            label="AI Cost / Month"
            value={inputs.aiCostPerMonth}
            onChange={(v) => updateInput('aiCostPerMonth', v)}
            min={0}
            max={5000}
            step={50}
            prefix="$"
            suffix="/mo"
          />
        </div>

        {/* Results */}
        <div className="border-t border-[var(--ui-border-muted)] bg-[var(--surface-elevated)] p-6 lg:border-t-0 lg:border-l">
          <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Projected Savings
          </h4>

          <div className="space-y-3">
            <ResultCard
              label="Monthly Hours Saved"
              value={`${formatNumber(results.monthlyHoursSaved)} hrs`}
              subtitle={`${formatNumber(results.weeklyHoursSaved)} hrs/week × 4.33 weeks`}
              delay={0}
            />
            <ResultCard
              label="Monthly Cost Savings"
              value={formatCurrency(results.monthlyCostSaved)}
              subtitle="Before AI platform costs"
              delay={0.05}
            />
            <ResultCard
              label="Net Monthly Savings"
              value={formatCurrency(results.monthlyNetSavings)}
              subtitle={`After $${inputs.aiCostPerMonth}/mo AI cost`}
              highlight={results.monthlyNetSavings > 0 ? 'positive' : 'negative'}
              delay={0.1}
            />
            <ResultCard
              label="Yearly Savings"
              value={formatCurrency(results.yearlySavings)}
              subtitle="Annual projection"
              highlight={results.yearlySavings > 0 ? 'positive' : 'negative'}
              delay={0.15}
            />
          </div>

          {/* ROI Badge */}
          <AnimatePresence mode="wait">
            <motion.div
              key={results.roi}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                'mt-5 flex items-center justify-between rounded-xl border px-4 py-3',
                results.roi > 0
                  ? 'border-green-500/20 bg-green-500/5'
                  : 'border-red-500/20 bg-red-500/5'
              )}
            >
              <div>
                <div className="text-xs font-medium text-[var(--text-muted)]">ROI</div>
                <div
                  className={cn(
                    'text-xl font-bold',
                    results.roi > 0 ? 'text-green-400' : 'text-red-400'
                  )}
                >
                  {results.roi > 0 ? '+' : ''}
                  {formatNumber(results.roi, 0)}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-medium text-[var(--text-muted)]">Payback Period</div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  {results.paybackMonths > 0 && results.paybackMonths < 100
                    ? `${formatNumber(results.paybackMonths, 1)} months`
                    : 'N/A'}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────── */

function InputField({
  icon,
  label,
  value,
  onChange,
  min,
  max,
  step,
  prefix,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
}) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
          {icon}
          {label}
        </label>
        <span className="text-xs font-semibold tabular-nums text-[var(--text-primary)]">
          {prefix}
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--ui-border-muted)] accent-[var(--accent-primary)]"
        style={{
          background: `linear-gradient(to right, var(--accent-primary) ${percentage}%, var(--ui-border-muted) ${percentage}%)`,
        }}
      />
    </div>
  );
}

function ResultCard({
  label,
  value,
  subtitle,
  highlight,
  delay,
}: {
  label: string;
  value: string;
  subtitle: string;
  highlight?: 'positive' | 'negative';
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay }}
      className={cn(
        'flex items-center justify-between rounded-lg border px-3.5 py-2.5',
        'border-[var(--ui-border-muted)] bg-[var(--surface-panel)]',
        highlight === 'positive' && 'border-green-500/15 bg-green-500/[0.03]',
        highlight === 'negative' && 'border-red-500/15 bg-red-500/[0.03]'
      )}
    >
      <div>
        <div className="text-[12px] font-medium text-[var(--text-muted)]">{label}</div>
        <div
          className={cn(
            'text-sm font-bold tabular-nums',
            highlight === 'positive' && 'text-green-400',
            highlight === 'negative' && 'text-red-400',
            !highlight && 'text-[var(--text-primary)]'
          )}
        >
          {value}
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs text-[var(--text-muted)]">{subtitle}</div>
      </div>
    </motion.div>
  );
}
