const OFFICE_PATH = '/office';

/** Open Allternit Office in a separate window instead of the main app shell. */
export function openOfficeWindow(): void {
  if (window.allternit?.shell?.openOfficeWindow) {
    void window.allternit.shell.openOfficeWindow();
    return;
  }

  const url = new URL(OFFICE_PATH, window.location.origin).toString();
  window.open(url, '_blank', 'noopener,noreferrer');
}
