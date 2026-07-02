import React from "react";
import { Eye } from 'lucide-react';
import { Fade } from '@/design/animation/Fade';
import { GlassSurfaceThin } from '@/design/glass/GlassSurface';
import { Text } from '@/components/typography/Text';
import { L } from "./LabsView.constants";

interface LabsSettingsTabProps {
  canvasToken: string;
  canvasDomain: string;
  saveConfig: (config: { canvasToken?: string; canvasDomain?: string }) => void;
}

export const LabsSettingsTab: React.FC<LabsSettingsTabProps> = ({
  canvasToken,
  canvasDomain,
  saveConfig,
}) => {
  return (
    <Fade in direction="up" distance={20}>
      <div className="max-w-[520px]">
        <div className="mb-9">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-4 h-px bg-[var(--ui-text-secondary)] opacity-40" />
            <Text variant="label" className="text-[12.5px] font-bold tracking-widest uppercase text-[var(--ui-text-secondary)]">Configuration</Text>
          </div>
          <Text variant="researchHeading" as="h2" className="text-3xl font-black italic m-0 tracking-tight text-[var(--ui-text-primary)] leading-none">Settings</Text>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-5">
            <Text variant="label" className="text-[12px] font-extrabold tracking-widest uppercase text-[var(--accent-primary)]">Canvas LMS</Text>
            <div className="flex-1 h-px bg-[var(--ui-border-muted)]" />
          </div>
          <div className="flex flex-col gap-4.5">
            <div>
              <Text variant="label" as="label" className="block text-[12px] font-bold tracking-wider uppercase text-[var(--ui-text-secondary)] mb-2">API Token</Text>
              <input aria-label="Input" type="password" value={canvasToken}
                onChange={e => saveConfig({ canvasToken: e.target.value })}
                placeholder="Paste your Canvas API token here"
                className="w-full p-2.5 px-3.5 rounded-lg border border-solid border-white/10 bg-white/[0.04] text-[#f0f0f0] text-sm outline-none transition-colors focus:border-[rgba(167,139,250,0.4)] box-border"
              />
              <Text variant="caption" className="text-[12px] text-[var(--ui-text-muted)] mt-1.5 leading-relaxed block">Canvas → Account → Settings → Approved Integrations → New Access Token</Text>
            </div>
            <div>
              <Text variant="label" as="label" className="block text-[12px] font-bold tracking-wider uppercase text-[var(--ui-text-secondary)] mb-2">Domain</Text>
              <input aria-label="Input" type="text" value={canvasDomain}
                onChange={e => saveConfig({ canvasDomain: e.target.value })}
                placeholder="https://canvas.instructure.com"
                className="w-full p-2.5 px-3.5 rounded-lg border border-solid border-white/10 bg-white/[0.04] text-[#f0f0f0] text-sm outline-none transition-colors focus:border-[rgba(167,139,250,0.4)] box-border"
              />
            </div>
          </div>
        </div>

        <GlassSurfaceThin 
          className="p-4.5 px-5 rounded-[13px] border border-solid"
          style={{ background: L.accentDim, borderColor: L.accentBorder }}
        >
          <Text variant="label" className="m-0 mb-3 font-bold text-[12px] tracking-wider uppercase text-[var(--accent-primary)] flex items-center gap-1.5">
            <Eye size={12}/> Getting Your Canvas Token
          </Text>
          <ol className="m-0 pl-4.5 text-[var(--ui-text-secondary)] text-[12px] leading-[2]">
            <li>Log in to Canvas</li>
            <li>Go to Account → Settings</li>
            <li>Scroll to Approved Integrations</li>
            <li>Click <em className="italic">New Access Token</em> and copy the generated value</li>
          </ol>
        </GlassSurfaceThin>
      </div>
    </Fade>
  );
};
