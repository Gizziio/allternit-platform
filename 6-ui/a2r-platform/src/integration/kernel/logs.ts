import { getKernelBridge } from './index.js';
import { execEvents } from '../execution/exec.events.js';
export function subscribeToLogs() {
  // Listen to bridge audit logs and pipe to execEvents
  getKernelBridge().then(bridge => {
    // Audit logs are already piped in facade, but we can add more here
  });
}
