// apps/shell/src/proof/ProofRecorder.ts

interface ProofEvent {
  timestamp: number;
  eventName: string;
  payload?: any;
}

interface DomSnapshot {
  timestamp: number;
  selector: string;
  outerHTML: string | null;
}

interface ProofBundle {
  events: ProofEvent[];
  domSnapshots: DomSnapshot[];
}

class ProofRecorder {
  private events: ProofEvent[] = [];
  private domSnapshots: DomSnapshot[] = [];

  constructor() {
    this.events = [];
    this.domSnapshots = [];
    this.initGlobal();
  }

  private initGlobal() {
    if (typeof window !== 'undefined') {
      (window as any).__A2_PROOF__ = {
        mark: this.mark.bind(this),
        dump: this.dump.bind(this),
        takeDomSnapshot: this.takeDomSnapshot.bind(this),
      };
      console.log('[PROOF RECORDER] Initialized window.__A2_PROOF__');
    }
  }

  mark(eventName: string, payload?: any) {
    const timestamp = Date.now();
    this.events.push({ timestamp, eventName, payload });
    console.log(`[PROOF MARK] ${eventName}`, payload || '');
  }

  takeDomSnapshot(selector: string) {
    if (typeof document === 'undefined') return;

    const element = document.querySelector(selector);
    this.domSnapshots.push({
      timestamp: Date.now(),
      selector,
      outerHTML: element ? element.outerHTML : null,
    });
  }

  dump(): ProofBundle {
    // Ensure to take final DOM snapshots before dumping
    this.takeDomSnapshot('[data-testid="tab-strip-root"]');
    this.takeDomSnapshot('[data-testid="dock-bar-root"]');
    // Note: Active CapsuleWindowFrame snapshot will be more dynamic, might need
    // to be taken at specific event marks if its selector changes.
    // For now, rely on its presence in other snapshots.

    return {
      events: this.events,
      domSnapshots: this.domSnapshots,
    };
  }
}

// Instantiate and make globally accessible
export const proofRecorder = new ProofRecorder();
