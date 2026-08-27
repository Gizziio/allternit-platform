'use client';

import React from 'react';
import {
  Wrench,
  Factory,
  Cpu,
  Lightbulb,
  Gear,
  Cube,
  Flask,
  Rocket,
  ArrowRight,
  ArrowSquareOut,
  FileText,
} from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { openInBrowser } from '@/lib/openInBrowser';

const DIVISIONS = [
  {
    id: 'design-studio',
    title: 'Design Studio',
    icon: Lightbulb,
    description: 'Industrial design, CAD modeling, reverse engineering, and material selection.',
    examples: ['FreeCAD / Onshape', '3D scanning → CAD', 'DFM/DFA reviews'],
  },
  {
    id: 'prototype-lab',
    title: 'Prototype Lab',
    icon: Flask,
    description: 'Same-day iteration for Allternit hardware and customer projects.',
    examples: ['Compute box fits', 'Battery layouts', 'Cooling duct tests'],
  },
  {
    id: 'digital-manufacturing',
    title: 'Digital Manufacturing',
    icon: Factory,
    description: 'Material-specific print farms: PLA/PETG, ABS/ASA, engineering nylon, resin.',
    examples: ['Farm A: general purpose', 'Farm C: engineering materials', 'Farm D: precision resin'],
  },
  {
    id: 'product-manufacturing',
    title: 'Product Manufacturing',
    icon: Cube,
    description: 'Allternit’s own catalog of physical products.',
    examples: ['Compute enclosures', 'Rack accessories', 'Cable organizers'],
  },
  {
    id: 'manufacturing-services',
    title: 'Manufacturing Services',
    icon: Gear,
    description: 'B2B manufacturing: replacement parts, jigs, fixtures, low-volume runs.',
    examples: ['Machine shops', 'HVAC', 'Electricians', 'Universities'],
  },
  {
    id: 'hardware-rd',
    title: 'Hardware R&D',
    icon: Cpu,
    description: 'Supports the broader Allternit ecosystem.',
    examples: ['Portable AI stations', 'Edge servers', 'Robotics platforms'],
  },
];

const PHASES = [
  {
    phase: 'Phase 1 — Validate',
    timeframe: 'Months 1–3',
    goals: [
      '3 printers, 1 workstation, 1 shipping station',
      'First internal compute box prototype',
      '3–5 pilot B2B customers',
      '$2k–$5k monthly revenue',
    ],
  },
  {
    phase: 'Phase 2 — Scale',
    timeframe: 'Months 4–12',
    goals: [
      '10 printers + resin capability',
      'Standard service packages',
      'Internal manufacturing queue software',
      '$10k+ monthly revenue',
    ],
  },
  {
    phase: 'Phase 3 — Automate',
    timeframe: 'Year 2+',
    goals: [
      '40 printers across material farms',
      'AI scheduling and failure detection',
      'Customer portal live',
      '$30k+ monthly revenue',
    ],
  },
];

export function ManufacturingView() {
  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* Header */}
      <header className="border-b bg-card px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white">
              <Factory size={22} weight="fill" />
            </div>
            <div>
              <h1 className="font-semibold text-lg">Allternit Manufacturing</h1>
              <p className="text-sm text-muted-foreground">Digital microfactory for AI hardware and B2B production</p>
            </div>
          </div>
          <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10">
            Strategic Draft
          </Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-8">
        {/* Overview */}
        <section>
          <h2 className="text-xl font-semibold mb-3">Vision</h2>
          <p className="text-muted-foreground leading-relaxed">
            Allternit Manufacturing is the physical production arm of Allternit. It produces our own hardware
            (compute boxes, battery systems, racks, robotics parts), generates cash flow by selling excess
            manufacturing capacity to local businesses, and operates as a rapid prototyping lab for every future
            product. Over time it becomes an <strong>AI-driven manufacturing operating system</strong> and a
            <strong> distributed manufacturing network</strong>.
          </p>
        </section>

        {/* Divisions grid */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Six Divisions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DIVISIONS.map((d) => {
              const Icon = d.icon;
              return (
                <div
                  key={d.id}
                  className="rounded-xl border bg-card p-5 flex flex-col gap-3 hover:border-amber-500/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-md bg-amber-500/10 text-amber-500 flex items-center justify-center">
                      <Icon size={18} weight="fill" />
                    </div>
                    <h3 className="font-medium">{d.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{d.description}</p>
                  <ul className="text-xs text-muted-foreground space-y-1 mt-auto">
                    {d.examples.map((ex) => (
                      <li key={ex} className="flex items-center gap-1.5">
                        <Wrench size={11} className="text-amber-500" />
                        {ex}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* Build phases */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Build Phases</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PHASES.map((p) => (
              <div key={p.phase} className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Rocket size={16} className="text-amber-500" />
                  <h3 className="font-medium text-sm">{p.phase}</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{p.timeframe}</p>
                <ul className="text-sm text-muted-foreground space-y-2">
                  {p.goals.map((g) => (
                    <li key={g} className="flex items-start gap-2">
                      <ArrowRight size={12} className="mt-1 text-amber-500 shrink-0" />
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Revenue model */}
        <section>
          <h2 className="text-xl font-semibold mb-3">Target Revenue Mix</h2>
          <div className="rounded-xl border bg-card p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Internal product manufacturing</span>
                <span className="font-medium">30%</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">B2B industrial printing / MaaS</span>
                <span className="font-medium">30%</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Engineering & CAD services</span>
                <span className="font-medium">20%</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Consumer / catalog products</span>
                <span className="font-medium">10%</span>
              </div>
              <div className="flex justify-between sm:col-span-2">
                <span className="text-muted-foreground">Prototyping for startups</span>
                <span className="font-medium">10%</span>
              </div>
            </div>
          </div>
        </section>

        {/* Actions */}
        <section className="flex flex-wrap gap-3 pb-6">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => openInBrowser('https://github.com/allternit/allternit/blob/main/docs/ALLTERNIT_MANUFACTURING_MASTER_PLAN.md')}
          >
            <FileText size={16} />
            Read Master Plan
            <ArrowSquareOut size={14} />
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => openInBrowser('https://docs.allternit.com')}
          >
            Docs Portal
            <ArrowSquareOut size={14} />
          </Button>
        </section>
      </main>
    </div>
  );
}

export default ManufacturingView;
