const DESIGN_PATH = '/design';

/** Open Design Studio in a separate window instead of the main app shell. */
export function openDesignWindow(): void {
  if (window.allternit?.shell?.openDesign) {
    void window.allternit.shell.openDesign();
    return;
  }

  const url = new URL(DESIGN_PATH, window.location.origin).toString();
  window.open(url, '_blank', 'noopener,noreferrer');
}
