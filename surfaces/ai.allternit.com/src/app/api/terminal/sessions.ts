import type { IPty } from 'node-pty';

export const terminalSessions = new Map<string, IPty>();
