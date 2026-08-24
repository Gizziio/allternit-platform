import React, { useState } from "react";
import { GizziMascot, type GizziAttention, type GizziEmotion } from "@/components/ai-elements/GizziMascot";
import { TypingText, StaggeredReveal } from "./ChatViewAnimations";
import { LAUNCH_HEADER_ZONE_HEIGHT, LAUNCH_SECTION_GAP } from "./launchScreenLayout";
import { type LaunchGreeting, takeLaunchGreetingAnimation } from "./launchGreeting";

type LaunchLogo = 'gizzi' | 'matrix' | 'allternit';

interface LaunchHeaderProps {
  greeting: LaunchGreeting;
  logo?: LaunchLogo;
  useMonolithLogo?: boolean;
  mascotEmotion?: GizziEmotion;
  mascotAttention?: GizziAttention | null;
}

/**
 * The launch-screen greeting header (logo + title + tagline), shared by the
 * Chat and Cowork launch screens so toggling modes shows the identical
 * header at the identical position (fixed zone from launchScreenLayout).
 * The typing/reveal intro only plays on the first mount of the session.
 */
export function LaunchHeader({
  greeting,
  logo = 'gizzi',
  useMonolithLogo = false,
  mascotEmotion = "steady",
  mascotAttention = null,
}: LaunchHeaderProps) {
  const [animate] = useState(() => takeLaunchGreetingAnimation());
  const effectiveLogo: LaunchLogo = useMonolithLogo ? 'matrix' : logo;

  return (
    <div
      className="text-center flex flex-col items-center justify-end"
      style={{ height: LAUNCH_HEADER_ZONE_HEIGHT, marginBottom: LAUNCH_SECTION_GAP }}
    >
      <div className="relative group cursor-pointer mb-12 inline-flex items-center justify-center p-5 transition-all duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)]">
        <div className="absolute inset-0 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-[color-mix(in_srgb,var(--accent-chat)_8%,transparent)]" />
        <div className="relative z-10 transition-transform duration-500 group-hover:scale-110">
          {effectiveLogo === 'matrix' || effectiveLogo === 'allternit' ? (
            <img
              src="/brand/matrix/matrix-logo.svg"
              alt="Allternit"
              style={{ width: 84, height: 84 }}
            />
          ) : (
            <GizziMascot size={76} emotion={mascotEmotion} attention={mascotAttention} />
          )}
        </div>
      </div>

      <h1 className="text-5xl font-medium text-[var(--ui-text-primary)] mb-6 mt-0 font-[var(--font-research)] tracking-tight min-h-[60px]">
        {!animate ? (
          greeting.title
        ) : greeting.effectType === "typing" ? (
          <TypingText text={greeting.title} speed={0.08} />
        ) : (
          <StaggeredReveal text={greeting.title} />
        )}
      </h1>

      <div className="flex items-center gap-4 justify-center">
        <div className="h-px w-8 bg-[var(--ui-border-muted)]" />
        <div className="text-[14px] text-[var(--ui-text-secondary)] uppercase tracking-[0.2em] font-semibold min-w-[200px]">
          {!animate ? (
            greeting.tagline
          ) : greeting.effectType === "typing" ? (
            <TypingText text={greeting.tagline} delay={1.5} speed={0.04} />
          ) : (
            <StaggeredReveal text={greeting.tagline} delay={0.8} />
          )}
        </div>
        <div className="h-px w-8 bg-[var(--ui-border-muted)]" />
      </div>
    </div>
  );
}
