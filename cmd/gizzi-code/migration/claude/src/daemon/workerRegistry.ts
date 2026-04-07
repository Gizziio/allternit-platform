/**
 * Daemon Worker Registry
 * TEMPORARY SHIM
 */

export interface WorkerInfo {
  id: string
  status: 'idle' | 'busy' | 'error'
}

export function registerWorker(_worker: WorkerInfo): void {
  // TODO: implement
}

export function getWorkers(): WorkerInfo[] {
  return []
}

export function runDaemonWorker(..._args: unknown[]): void {
  // TODO: implement
}

export default { registerWorker, getWorkers, runDaemonWorker }
