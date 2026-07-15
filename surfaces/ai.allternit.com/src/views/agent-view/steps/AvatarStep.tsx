import React from "react";
import { Palette } from "@phosphor-icons/react";
import { AgentAvatarPicker, type AvatarPickerConfig } from "../components/AgentAvatarPicker";

interface AvatarConfig {
  primary: string;
  secondary: string;
  pattern: string;
}

interface AvatarStepProps {
  name?: string;
  avatarPickerConfig: AvatarPickerConfig;
  setAvatarPickerConfig: React.Dispatch<React.SetStateAction<AvatarPickerConfig>>;
  setAvatarConfig: React.Dispatch<React.SetStateAction<AvatarConfig>>;
}

export function AvatarStep({
  name,
  avatarPickerConfig,
  setAvatarPickerConfig,
  setAvatarConfig,
}: AvatarStepProps) {
  return (
    <section className="flex flex-col gap-6 flex-1 min-h-0">
      <div className="mb-6">
        <h2 className="text-[18px] font-semibold text-[var(--text-primary)] m-0 mb-4 font-research flex items-center gap-2">
          <Palette size={20} className="text-[var(--accent-primary)]" />
          Avatar
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)] m-0 mb-5">
          Choose a visual identity for your agent.
        </p>
      </div>

      <div className="max-w-[400px]">
        <AgentAvatarPicker
          name={name || 'Agent'}
          config={avatarPickerConfig}
          onChange={(config) => {
            setAvatarPickerConfig(config);
            setAvatarConfig(prev => ({
              ...prev,
              primary: config.bgColor,
              secondary: config.textColor,
            }));
          }}
        />
      </div>
    </section>
  );
}
