/**
 * Lease Management Module
 * 
 * Automatic lease renewal and lifecycle management.
 */

export { LeaseManager, createLeaseManager } from './manager';
export type {
  LeaseManagerConfig,
  ManagedLease,
  LeaseManagerEvents,
} from './manager';
