// §A5 — Pacer (worker-enforced pacing): action gaps, task gaps, rolling caps,
// quiet hours. All time via injected clock/rng/sleep.
import type { Pacer, PacingProfile } from "@allternit/subscription-fabric-contracts";

export type PacingCap = "min_task_gap" | "tasks_per_hour" | "tasks_per_day" | "quiet_hours";

export class PacingCapExceeded extends Error {
  constructor(
    public readonly cap: PacingCap,
    public readonly retryAfterS: number | null = null
  ) {
    super(`pacing cap exceeded: ${cap}`);
    this.name = "PacingCapExceeded";
  }
}

export interface PacerOptions {
  now?: () => number;
  rng?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function inQuietHours(hour: number, [start, end]: [number, number]): boolean {
  return start <= end ? hour >= start && hour < end : hour >= start || hour < end;
}

export function createPacer(profile: PacingProfile, opts: PacerOptions = {}): Pacer {
  const now = opts.now ?? (() => Date.now());
  const rng = opts.rng ?? (() => Math.random());
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  const taskStarts: number[] = [];
  let lastTaskAt: number | null = null;

  return {
    async beforeAction(): Promise<void> {
      const [min, max] = profile.min_action_gap_ms;
      await sleep(min + rng() * Math.max(0, max - min));
    },
    async beforeTask(): Promise<void> {
      const t = now();

      if (profile.quiet_hours && inQuietHours(new Date(t).getHours(), profile.quiet_hours)) {
        throw new PacingCapExceeded("quiet_hours");
      }

      const hourCount = taskStarts.filter((ts) => t - ts < HOUR_MS).length;
      if (hourCount >= profile.max_tasks_per_hour) {
        const oldest = taskStarts.filter((ts) => t - ts < HOUR_MS).sort((a, b) => a - b)[0];
        throw new PacingCapExceeded(
          "tasks_per_hour",
          Math.ceil((oldest + HOUR_MS - t) / 1000)
        );
      }
      const dayCount = taskStarts.filter((ts) => t - ts < DAY_MS).length;
      if (dayCount >= profile.max_tasks_per_day) {
        const oldest = taskStarts.filter((ts) => t - ts < DAY_MS).sort((a, b) => a - b)[0];
        throw new PacingCapExceeded("tasks_per_day", Math.ceil((oldest + DAY_MS - t) / 1000));
      }

      if (lastTaskAt !== null) {
        const gapMs = profile.min_task_gap_s * 1000 - (now() - lastTaskAt);
        if (gapMs > 0) await sleep(gapMs);
      }

      lastTaskAt = now();
      taskStarts.push(lastTaskAt);
    },
  };
}
