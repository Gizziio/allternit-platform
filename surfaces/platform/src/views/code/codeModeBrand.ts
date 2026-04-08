import type { GizziEmotion } from '@/components/ai-elements/GizziMascot';

export interface CodeModeGreeting {
  title: string;
  tagline: string;
  helper_locked: string;
  helper_ready: string;
  emotion: GizziEmotion;
}

export interface CodeModeGreetingSelection extends CodeModeGreeting {
  index: number;
  titleAnimation: number;
  taglineAnimation: number;
  helperAnimation: number;
}

const GREETING_STORAGE_KEY = 'allternit.code-mode.greeting-index';

export const CODE_MODE_GREETINGS: CodeModeGreeting[] = [
  {
    title: 'Build On Rails',
    tagline:
      'Gizzi keeps A2rchitech code sessions anchored to SYSTEM_LAW, contracts, and the smallest safe diff.',
    helper_locked:
      'Point Gizzi at the repo root and the first plan will stay on-rails from branch to preview.',
    helper_ready:
      'Workspace attached. Start with the outcome and Gizzi will thread the safest plan through this repo.',
    emotion: 'focused',
  },
  {
    title: 'Open The Worktree',
    tagline:
      'Choose the repo, isolate the branch, and let the Allternit runtime move with receipts instead of guesswork.',
    helper_locked:
      'Select the folder you actually want to operate on so Gizzi can map the right worktree and history.',
    helper_ready:
      'This repo is attached. Ask for a branch-safe move and Gizzi can start tracing the delta.',
    emotion: 'curious',
  },
  {
    title: 'Spec Before Patch',
    tagline:
      'In A2rchitech, prompts start the motion, but specs, WIHs, and acceptance gates shape the actual code path.',
    helper_locked:
      'Give Gizzi the workspace first and it can cross-check the specs before a single edit lands.',
    helper_ready:
      'The workspace is live. Gizzi can inspect the law, the WIHs, and the current files before touching code.',
    emotion: 'skeptical',
  },
  {
    title: 'Low Noise, Full Trace',
    tagline:
      'This workspace stays quiet until Gizzi has a real plan, real files, or a real preview worth showing.',
    helper_locked:
      'Choose the folder and Gizzi will keep the surface calm until there is real state worth rendering.',
    helper_ready:
      'The repo is connected. Gizzi will keep the canvas light and surface heavier detail only when it matters.',
    emotion: 'steady',
  },
  {
    title: 'Receipts Beat Vibes',
    tagline:
      'From first instruction to final apply, every code move should be inspectable, replayable, and backed by evidence.',
    helper_locked:
      'Lock the workspace first so every action can point back to the correct branch, files, and receipts.',
    helper_ready:
      'Everything is anchored. Gizzi can now move with receipts instead of hand-wavy state.',
    emotion: 'proud',
  },
  {
    title: 'Preview Without Clutter',
    tagline:
      'Dock the live surface, keep the canvas clear, and let heavier detail appear only when the branch actually needs it.',
    helper_locked:
      'Pick the repo root and Gizzi will line up preview, worktree, and console without crowding the canvas.',
    helper_ready:
      'Preview can stay out of the way until the code path actually needs a live surface.',
    emotion: 'pleased',
  },
  {
    title: 'Plan. Diff. Approve.',
    tagline:
      'A2rchitech Code Mode is built for deliberate execution: inspect the change set, then move with confidence.',
    helper_locked:
      'Choose the workspace and Gizzi will line up the plan, diff, and approval path in the right order.',
    helper_ready:
      'The repo is ready. Start with the intended change and Gizzi will shape the plan before the diff.',
    emotion: 'alert',
  },
  {
    title: 'Architect The Delta',
    tagline:
      'Gizzi turns an A2rchitech request into a scoped delta, not a pile of unexplained edits.',
    helper_locked:
      'Point Gizzi at the right folder and it can turn your ask into a scoped delta instead of a blind patch.',
    helper_ready:
      'This workspace is attached. Ask for the delta you want and Gizzi will keep the edit set tight.',
    emotion: 'mischief',
  },
];

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function getCodeModeGreetingStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getNextCodeModeGreeting(storage: StorageLike | null): CodeModeGreetingSelection {
  const count = CODE_MODE_GREETINGS.length;
  const rawValue = storage?.getItem(GREETING_STORAGE_KEY) ?? '-1';
  const parsedValue = Number.parseInt(rawValue, 10);
  const previousIndex = Number.isFinite(parsedValue) ? parsedValue : -1;
  const index = (previousIndex + 1 + count) % count;

  storage?.setItem(GREETING_STORAGE_KEY, String(index));

  return {
    ...CODE_MODE_GREETINGS[index],
    index,
    titleAnimation: index % 8,
    taglineAnimation: (index * 3 + 1) % 6,
    helperAnimation: (index * 5 + 2) % 6,
  };
}
