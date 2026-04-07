interface LaunchUltraplanOptions {
  blurb: string;
  getAppState: () => unknown;
  setAppState: React.Dispatch<React.SetStateAction<unknown>>;
  signal: AbortSignal;
  disconnectedBridge?: boolean;
  onSessionReady?: (msg: string) => void;
}

export async function launchUltraplan(_opts: LaunchUltraplanOptions): Promise<string> {
  return 'Ultraplan launched';
  }
