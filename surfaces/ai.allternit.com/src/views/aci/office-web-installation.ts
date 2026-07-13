import type { OfficeHost } from './AciAddinView';

const KEY = 'allternit.office-web-developer-installations.v1';

export interface OfficeWebInstallationReceipt {
  host: OfficeHost;
  verifiedAt: string;
  verification: 'user-confirmed-ribbon';
}

function read(): Partial<Record<OfficeHost, OfficeWebInstallationReceipt>> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

export function getOfficeWebInstallation(host: OfficeHost): OfficeWebInstallationReceipt | null {
  return read()[host] ?? null;
}

export function verifyOfficeWebInstallation(host: OfficeHost): OfficeWebInstallationReceipt {
  const receipt: OfficeWebInstallationReceipt = { host, verifiedAt: new Date().toISOString(), verification: 'user-confirmed-ribbon' };
  localStorage.setItem(KEY, JSON.stringify({ ...read(), [host]: receipt }));
  return receipt;
}

export function forgetOfficeWebInstallation(host: OfficeHost): void {
  const state = read();
  delete state[host];
  localStorage.setItem(KEY, JSON.stringify(state));
}
