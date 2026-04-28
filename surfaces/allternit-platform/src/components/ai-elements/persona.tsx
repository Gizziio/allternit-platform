"use client";

import type { RiveParameters } from "@rive-app/react-webgl2";
import type { FC, ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  useRive,
  useStateMachineInput,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceColor,
} from "@rive-app/react-webgl2";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { voiceService } from "@/services/voice";
import { RiveErrorBoundary } from "./rive-error-boundary";
import { MatrixLogo } from "./MatrixLogo";

export type PersonaState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "asleep"
  | "compacting";

interface PersonaProps {
  /**
   * Visual state of the persona.
   * Use "auto" to sync with voice service (listening/speaking states)
   */
  state: PersonaState | "auto";
  onLoad?: RiveParameters["onLoad"];
  onLoadError?: RiveParameters["onLoadError"];
  onReady?: () => void;
  onPause?: RiveParameters["onPause"];
  onPlay?: RiveParameters["onPlay"];
  onStop?: RiveParameters["onStop"];
  className?: string;
  size?: number;
  variant?: keyof typeof sources;
  /**
   * When true, animate speaking intensity based on audio energy level
   */
  animateWithEnergy?: boolean;
}

// The state machine name is always 'default' for Elements AI visuals
const stateMachine = "default";

const sources = {
  command: {
    dynamicColor: true,
    hasModel: true,
    source:
      "https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/command-2.0.riv",
  },
  glint: {
    dynamicColor: true,
    hasModel: true,
    source:
      "https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/glint-2.0.riv",
  },
  halo: {
    dynamicColor: true,
    hasModel: true,
    source:
      "https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/halo-2.0.riv",
  },
  mana: {
    dynamicColor: false,
    hasModel: true,
    source:
      "https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/mana-2.0.riv",
  },
  obsidian: {
    dynamicColor: true,
    hasModel: true,
    source:
      "https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/obsidian-2.0.riv",
  },
  opal: {
    dynamicColor: false,
    hasModel: false,
    source:
      "https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/orb-1.2.riv",
  },
  gizzi: {
    dynamicColor: false,
    hasModel: false,
    source: "css",
  },
};

const getCurrentTheme = (): "light" | "dark" => {
  if (typeof window !== "undefined") {
    if (document.documentElement.classList.contains("dark")) {
      return "dark";
    }
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  }
  return "light";
};

const useTheme = (enabled: boolean) => {
  const [theme, setTheme] = useState<"light" | "dark">(getCurrentTheme);

  useEffect(() => {
    if (!enabled) return;

    const observer = new MutationObserver(() => {
      setTheme(getCurrentTheme());
    });

    observer.observe(document.documentElement, {
      attributeFilter: ["class"],
      attributes: true,
    });

    let mql: MediaQueryList | null = null;
    const handleMediaChange = () => {
      setTheme(getCurrentTheme());
    };

    if (window.matchMedia) {
      mql = window.matchMedia("(prefers-color-scheme: dark)");
      mql.addEventListener("change", handleMediaChange);
    }

    return () => {
      observer.disconnect();
      if (mql) {
        mql.removeEventListener("change", handleMediaChange);
      }
    };
  }, [enabled]);

  return theme;
};

interface PersonaWithModelProps {
  rive: ReturnType<typeof useRive>["rive"];
  source: (typeof sources)[keyof typeof sources];
  children: React.ReactNode;
}

const PersonaWithModel = memo(
  ({ rive, source, children }: PersonaWithModelProps) => {
    const theme = useTheme(source.dynamicColor);
    const viewModel = useViewModel(rive, { useDefault: true });
    const viewModelInstance = useViewModelInstance(viewModel, {
      rive,
      useDefault: true,
    });
    
    const viewModelInstanceColor = useViewModelInstanceColor(
      "color",
      viewModelInstance
    );

    useEffect(() => {
      if (!(viewModelInstanceColor && source.dynamicColor)) {
        return;
      }

      const [r, g, b] = theme === "dark" ? [255, 255, 255] : [0, 0, 0];
      viewModelInstanceColor.setRgb(r, g, b);
    }, [viewModelInstanceColor, theme, source.dynamicColor]);

    return children;
  }
);

PersonaWithModel.displayName = "PersonaWithModel";

interface PersonaWithoutModelProps {
  children: ReactNode;
}

const PersonaWithoutModel = memo(
  ({ children }: PersonaWithoutModelProps) => children
);

PersonaWithoutModel.displayName = "PersonaWithoutModel";

// ============================================================================
// Rive-based Persona (Non-Gizzi)
// ============================================================================

const RivePersona = memo(({
  source,
  state,
  onLoad,
  onLoadError,
  onReady,
  onPause,
  onPlay,
  onStop,
  className,
  animateWithEnergy,
  energyLevel
}: any) => {
  const callbacksRef = useRef({ onLoad, onLoadError, onPause, onPlay, onReady, onStop });

  useEffect(() => {
    callbacksRef.current = { onLoad, onLoadError, onPause, onPlay, onReady, onStop };
  }, [onLoad, onLoadError, onPause, onPlay, onReady, onStop]);

  const stableCallbacks = useMemo(() => ({
    onLoad: ((loadedRive: any) => callbacksRef.current.onLoad?.(loadedRive)),
    onLoadError: ((err: any) => callbacksRef.current.onLoadError?.(err)),
    onPause: ((event: any) => callbacksRef.current.onPause?.(event)),
    onPlay: ((event: any) => callbacksRef.current.onPlay?.(event)),
    onReady: () => callbacksRef.current.onReady?.(),
    onStop: ((event: any) => callbacksRef.current.onStop?.(event)),
  }), []);

  const { rive, RiveComponent } = useRive({
    autoplay: true,
    onLoad: stableCallbacks.onLoad,
    onLoadError: stableCallbacks.onLoadError,
    onPause: stableCallbacks.onPause,
    onPlay: stableCallbacks.onPlay,
    onRiveReady: stableCallbacks.onReady,
    src: source.source,
    stateMachines: stateMachine,
  });

  const listeningInput = useStateMachineInput(rive, stateMachine, "listening");
  const thinkingInput = useStateMachineInput(rive, stateMachine, "thinking");
  const speakingInput = useStateMachineInput(rive, stateMachine, "speaking");
  const asleepInput = useStateMachineInput(rive, stateMachine, "asleep");

  useEffect(() => {
    if (!rive) return;
    if (listeningInput) listeningInput.value = state === "listening";
    if (thinkingInput) thinkingInput.value = state === "thinking";
    if (speakingInput) speakingInput.value = state === "speaking";
    if (asleepInput) asleepInput.value = state === "asleep";
  }, [rive, state, listeningInput, thinkingInput, speakingInput, asleepInput]);

  const Component = source.hasModel ? PersonaWithModel : PersonaWithoutModel;

  return (
    <Component rive={rive} source={source}>
      <RiveComponent 
        className={cn("size-16 shrink-0", className)} 
        style={animateWithEnergy ? {
          transform: `scale(${1 + energyLevel * 0.1})`,
          transition: 'transform 0.1s ease-out',
        } : undefined}
      />
    </Component>
  );
});

RivePersona.displayName = "RivePersona";

// ============================================================================
// Canvas-based Organic Persona (Gizzi)
// ============================================================================

const GizziPersona = memo(({
  state,
  className,
  energyLevel,
  size = 64
}: any) => {
  return (
    <div style={{ color: 'var(--accent-primary)' }} className={className}>
      <MatrixLogo 
        state={state} 
        energy={energyLevel}
        size={size} 
      />
    </div>
  );
});

GizziPersona.displayName = "GizziPersona";

// ============================================================================
// Main Persona Component
// ============================================================================

export const Persona: FC<PersonaProps> = memo(
  ({
    variant = "obsidian",
    state: stateProp = "idle",
    onLoad,
    onLoadError,
    onReady,
    onPause,
    onPlay,
    onStop,
    className,
    size = 64,
    animateWithEnergy = false,
  }) => {
    const source = sources[variant];
    const isAutoMode = stateProp === "auto";
    const isGizzi = variant === "gizzi";
    
    const [autoState, setAutoState] = useState<PersonaState>("idle");
    const [energyLevel, setEnergyLevel] = useState(0);

    if (!source) {
      throw new Error(`Invalid variant: ${variant}`);
    }

    useEffect(() => {
      if (!isAutoMode) return;

      const unsubscribePlayback = voiceService.onPlayback((event) => {
        if (event.type === 'play') setAutoState('speaking');
        else if (event.type === 'end' || event.type === 'error') setAutoState('idle');
      });

      const unsubscribeEnergy = animateWithEnergy 
        ? voiceService.onEnergy((energy) => setEnergyLevel(energy))
        : () => {};

      return () => {
        unsubscribePlayback();
        unsubscribeEnergy();
      };
    }, [isAutoMode, animateWithEnergy]);

    const state = isAutoMode ? autoState : stateProp as PersonaState;

    return (
      <RiveErrorBoundary fallback={<div className={cn("size-16 rounded-full bg-muted/20 border border-border/50", className)} />}>
        {isGizzi ? (
          <GizziPersona 
            state={state} 
            className={className} 
            energyLevel={energyLevel}
            size={size}
          />
        ) : (
          <RivePersona 
            source={source}
            state={state}
            onLoad={onLoad}
            onLoadError={onLoadError}
            onReady={onReady}
            onPause={onPause}
            onPlay={onPlay}
            onStop={onStop}
            className={className}
            animateWithEnergy={animateWithEnergy}
            energyLevel={energyLevel}
            size={size}
          />
        )}
      </RiveErrorBoundary>
    );
  }
);

Persona.displayName = "Persona";
