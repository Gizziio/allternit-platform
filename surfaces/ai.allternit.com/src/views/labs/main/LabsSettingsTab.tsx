import React from "react";
import { Fade } from '@/design/animation/Fade';
import { SettingsCard, SettingsCardRow } from '@/components/settings/SettingsCard';
import { Toggle } from '@/components/settings/Toggle';

interface LabsSettingsTabProps {
  canvasToken: string;
  canvasDomain: string;
  autoGenerateLessons: boolean;
  researchNotebookSync: boolean;
  saveConfig: (config: { canvasToken?: string; canvasDomain?: string; autoGenerateLessons?: boolean; researchNotebookSync?: boolean }) => void;
}

export const LabsSettingsTab: React.FC<LabsSettingsTabProps> = ({
  canvasToken,
  canvasDomain,
  autoGenerateLessons,
  researchNotebookSync,
  saveConfig,
}) => {
  const [showToken, setShowToken] = React.useState(false);

  return (
    <Fade in direction="up" distance={20}>
      <div className="max-w-[640px]">
        <div className="mb-8">
          <h2 className="text-[22px] font-semibold text-[var(--text-primary)] m-0">
            Labs Settings
          </h2>
          <p className="text-[14px] text-[var(--text-secondary)] m-0 mt-1 leading-relaxed">
            Connect your learning management system and configure the A://Labs portal.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <SettingsCard
            title="Canvas LMS"
            description="Sync courses, assignments, and enrollments from Canvas."
          >
            <SettingsCardRow
              label="API Token"
              description="Canvas → Account → Settings → Approved Integrations → New Access Token"
            >
              <div className="relative">
                <input
                  aria-label="Canvas API token"
                  type={showToken ? 'text' : 'password'}
                  value={canvasToken}
                  onChange={(e) => saveConfig({ canvasToken: e.target.value })}
                  placeholder="Paste your Canvas API token"
                  className="w-[260px] p-2.5 px-3.5 rounded-lg border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-panel)] text-[var(--ui-text-primary)] text-sm outline-none transition-colors focus:border-[var(--accent-primary)] box-border"
                />
              </div>
            </SettingsCardRow>

            <SettingsCardRow
              label="Domain"
              description="e.g. https://canvas.instructure.com"
            >
              <input
                aria-label="Canvas domain"
                type="text"
                value={canvasDomain}
                onChange={(e) => saveConfig({ canvasDomain: e.target.value })}
                placeholder="https://canvas.instructure.com"
                className="w-[260px] p-2.5 px-3.5 rounded-lg border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-panel)] text-[var(--ui-text-primary)] text-sm outline-none transition-colors focus:border-[var(--accent-primary)] box-border"
              />
            </SettingsCardRow>

            <SettingsCardRow
              label="Show token while typing"
              description="Temporarily reveal the API token so you can verify it."
            >
              <Toggle value={showToken} onChange={setShowToken} />
            </SettingsCardRow>
          </SettingsCard>

          <SettingsCard
            title="Getting started"
            description="New to Canvas integration? Follow these steps."
          >
            <ol className="m-0 pl-5 text-[var(--text-secondary)] text-[13px] leading-[2] list-decimal">
              <li>Log in to Canvas</li>
              <li>Go to Account → Settings</li>
              <li>Scroll to Approved Integrations</li>
              <li>Click <em className="italic">New Access Token</em> and copy the generated value</li>
            </ol>
          </SettingsCard>

          <SettingsCard
            title="Labs features"
            description="Toggle experimental learning features."
          >
            <SettingsCardRow
              label="Auto-generate lessons"
              description="Allow A://Labs to suggest new lessons from synced courses."
            >
              <Toggle value={autoGenerateLessons} onChange={(v) => saveConfig({ autoGenerateLessons: v })} />
            </SettingsCardRow>
            <SettingsCardRow
              label="Research notebook sync"
              description="Keep research notes in sync with your Canvas account."
            >
              <Toggle value={researchNotebookSync} onChange={(v) => saveConfig({ researchNotebookSync: v })} />
            </SettingsCardRow>
          </SettingsCard>
        </div>
      </div>
    </Fade>
  );
};
