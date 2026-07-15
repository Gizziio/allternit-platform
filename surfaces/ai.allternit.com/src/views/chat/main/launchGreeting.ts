import { getSession } from '@/lib/auth-browser';

/**
 * Rotating launch-screen greeting shared by the Chat and Cowork launch
 * screens. A greeting is picked at random once per renderer session and then
 * cached, so toggling Chat/Cowork shows the identical title/tagline instead
 * of re-rolling per screen. The entrance animation is likewise played only
 * on the first launch-header mount (see takeLaunchGreetingAnimation).
 */
export interface LaunchGreeting {
  title: string;
  tagline: string;
  effectType: 'typing' | 'reveal';
}

export const DEFAULT_LAUNCH_GREETING: LaunchGreeting = {
  title: 'Allternit & Coffee',
  tagline: 'The Intelligent Workspace',
  effectType: 'reveal',
};

const TAGLINES = [
  'The Intelligent Workspace',
  'Your Architecture, Amplified',
  'Coffee, Code, and Creativity',
  'Building the Future, One Block at a Time',
  'Where Logic Meets Elegance',
  'Precision in Every Interaction',
  'Designing Better Workflows',
  'Stay curious, stay creative.',
];

function titlesFor(userName: string): string[] {
  return [
    'Allternit & Coffee',
    `Welcome back, ${userName}`,
    'Ready to Build?',
    "The Architect's Den",
    'Allternit',
    'Good to see you, Architect',
    'Creative Control',
    'Morning Ritual',
  ];
}

let cached: LaunchGreeting | null = null;
let pending: Promise<LaunchGreeting> | null = null;
let animationPlayed = false;

/** Synchronous read of the session's greeting; null until the first
 * getLaunchGreeting() resolves. Lets remounts render without a flash of the
 * default greeting. */
export function peekLaunchGreeting(): LaunchGreeting | null {
  return cached;
}

export async function getLaunchGreeting(): Promise<LaunchGreeting> {
  if (cached) return cached;
  if (!pending) {
    pending = (async () => {
      const session = await getSession().catch(() => null);
      const userName = session?.name || 'Eoj';
      const titles = titlesFor(userName);
      cached = {
        title: titles[Math.floor(Math.random() * titles.length)],
        tagline: TAGLINES[Math.floor(Math.random() * TAGLINES.length)],
        effectType: Math.random() > 0.5 ? 'typing' : 'reveal',
      };
      return cached;
    })();
  }
  return pending;
}

/** True only for the first launch-header mount of the session, so the
 * typing/reveal intro doesn't replay every time the user toggles modes. */
export function takeLaunchGreetingAnimation(): boolean {
  if (animationPlayed) return false;
  animationPlayed = true;
  return true;
}
