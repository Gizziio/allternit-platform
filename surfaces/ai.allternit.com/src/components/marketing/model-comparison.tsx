'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  IconCheck,
  IconX,
  IconArrowUp,
  IconArrowDown,
  IconStar,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface ModelSpec {
  speed: string;
  context: string;
  pricing: string;
}

export interface Model {
  name: string;
  provider: string;
  specs: ModelSpec;
  features: Record<string, boolean>;
  recommended?: boolean;
}

export interface ModelComparisonTableProps {
  models: Model[];
  className?: string;
}

type SortKey = 'name' | 'provider' | 'speed' | 'context' | 'pricing';
type SortDir = 'asc' | 'desc';

const SortIcon = ({ 
  column, 
  sortKey, 
  sortDir 
}: { 
  column: SortKey; 
  sortKey: SortKey; 
  sortDir: SortDir;
}) => {
  if (sortKey !== column)
    return (
      <span className="ml-1 inline-block size-4  opacity-0 transition-opacity group-hover:opacity-40">
        <IconArrowUp className="size-3 " />
      </span>
    );
  return sortDir === 'asc' ? (
    <IconArrowUp className="ml-1 inline-block size-3 " />
  ) : (
    <IconArrowDown className="ml-1 inline-block size-3 " />
  );
};

export function ModelComparisonTable({
  models,
  className,
}: ModelComparisonTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const featureKeys = useMemo(() => {
    const keys = new Set<string>();
    models.forEach((m) => Object.keys(m.features).forEach((k) => keys.add(k)));
    return Array.from(keys);
  }, [models]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedModels = useMemo(() => {
    const sorted = [...models];
    sorted.sort((a, b) => {
      let valA: string;
      let valB: string;

      if (sortKey === 'speed' || sortKey === 'context' || sortKey === 'pricing') {
        valA = a.specs[sortKey];
        valB = b.specs[sortKey];
      } else {
        valA = a[sortKey];
        valB = b[sortKey];
      }

      const cmp = valA.localeCompare(valB);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [models, sortKey, sortDir]);

  const headerBase =
    'cursor-pointer select-none whitespace-nowrap transition-colors hover:text-[var(--ui-text-primary)]';
  const headerText = 'inline-flex items-center text-xs font-semibold uppercase tracking-wider';

  return (
    <section className={cn('relative px-6 py-24', className)}>
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="mb-12 text-center"
        >
          <h2
            className="mb-3 text-3xl font-semibold tracking-tight text-[var(--ui-text-primary)] sm:text-4xl"
            style={{ fontFamily: 'var(--font-serif), Georgia, serif', lineHeight: 1.1 }}
          >
            Model Comparison
          </h2>
          <p className="mx-auto max-w-md text-base text-[var(--ui-text-muted)]">
            Compare AI models across speed, context window, pricing, and capabilities.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-x-auto rounded-2xl border border-[var(--ui-border-muted)]"
          style={{ background: 'var(--surface-panel)' }}
        >
          <Table>
            <TableHeader>
              <TableRow
                className="border-b-[var(--ui-border-muted)] hover:bg-transparent"
                style={{ borderBottomColor: 'var(--ui-border-muted)' }}
              >
                <TableHead
                  className={cn(headerBase, headerText)}
                  style={{ color: 'var(--ui-text-muted)' }}
                  onClick={() => handleSort('name')}
                >
                  Model
                  <SortIcon column="name" sortKey={sortKey} sortDir={sortDir} />
                </TableHead>
                <TableHead
                  className={cn(headerBase, headerText)}
                  style={{ color: 'var(--ui-text-muted)' }}
                  onClick={() => handleSort('provider')}
                >
                  Provider
                  <SortIcon column="provider" sortKey={sortKey} sortDir={sortDir} />
                </TableHead>
                <TableHead
                  className={cn(headerBase, headerText)}
                  style={{ color: 'var(--ui-text-muted)' }}
                  onClick={() => handleSort('speed')}
                >
                  Speed
                  <SortIcon column="speed" sortKey={sortKey} sortDir={sortDir} />
                </TableHead>
                <TableHead
                  className={cn(headerBase, headerText)}
                  style={{ color: 'var(--ui-text-muted)' }}
                  onClick={() => handleSort('context')}
                >
                  Context
                  <SortIcon column="context" sortKey={sortKey} sortDir={sortDir} />
                </TableHead>
                <TableHead
                  className={cn(headerBase, headerText)}
                  style={{ color: 'var(--ui-text-muted)' }}
                  onClick={() => handleSort('pricing')}
                >
                  Pricing
                  <SortIcon column="pricing" sortKey={sortKey} sortDir={sortDir} />
                </TableHead>
                {featureKeys.map((key) => (
                  <TableHead
                    key={key}
                    className={cn(headerBase, headerText)}
                    style={{ color: 'var(--ui-text-muted)' }}
                  >
                    {key}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedModels.map((model, index) => (
                <TableRow
                  key={model.name}
                  className={cn(
                    'transition-colors',
                    model.recommended
                      ? 'bg-[color-mix(in_srgb,var(--accent-primary)_6%,transparent)]'
                      : 'hover:bg-[color-mix(in_srgb,var(--surface-hover)_50%,transparent)]'
                  )}
                  style={{ borderBottomColor: 'var(--ui-border-muted)' }}
                >
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-semibold"
                        style={{ color: 'var(--ui-text-primary)' }}
                      >
                        {model.name}
                      </span>
                      {model.recommended && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[12px] font-medium"
                          style={{
                            background:
                              'color-mix(in srgb, var(--accent-chat) 16%, transparent)',
                            color: 'var(--accent-chat)',
                          }}
                        >
                          <IconStar className="size-3 " />
                          Best
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell
                    className="whitespace-nowrap text-sm"
                    style={{ color: 'var(--ui-text-secondary)' }}
                  >
                    {model.provider}
                  </TableCell>
                  <TableCell
                    className="whitespace-nowrap text-sm"
                    style={{ color: 'var(--ui-text-secondary)' }}
                  >
                    {model.specs.speed}
                  </TableCell>
                  <TableCell
                    className="whitespace-nowrap text-sm"
                    style={{ color: 'var(--ui-text-secondary)' }}
                  >
                    {model.specs.context}
                  </TableCell>
                  <TableCell
                    className="whitespace-nowrap text-sm"
                    style={{ color: 'var(--ui-text-secondary)' }}
                  >
                    {model.specs.pricing}
                  </TableCell>
                  {featureKeys.map((key) => (
                    <TableCell key={key} className="text-center">
                      {model.features[key] ? (
                        <IconCheck
                          className="mx-auto size-4 "
                          style={{ color: 'var(--status-success)' }}
                        />
                      ) : (
                        <IconX
                          className="mx-auto size-4 "
                          style={{ color: 'var(--ui-text-muted)', opacity: 0.4 }}
                        />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </motion.div>
      </div>
    </section>
  );
}
