import type { KernelJournalEvent } from '../../../types/capsule-spec';

export function summarizeJournalEvent(event: KernelJournalEvent): string {
  switch (event.type) {
    case 'evidence_added':
      return `Added ${event.title || 'evidence'}`;
    case 'evidence_removed':
      return `Removed ${event.title || 'evidence'}`;
    case 'dataModel_patched':
      if (event.path && event.diff) {
        const section = event.path.split('.').pop() || 'data';
        const count = typeof event.diff === 'number' ? event.diff : (event.diff as any[])?.length || 0;
        return `Updated ${section}: +${count} item${count !== 1 ? 's' : ''}${event.evidenceId ? ` (${event.evidenceId.slice(0, 8)}...)` : ''}`;
      }
      return 'Updated data model';
    case 'section_added':
      return `Added ${event.sectionTitle || 'section'}`;
    case 'capsule_compiled':
      return `Created ${event.capsuleTitle || 'capsule'}`;
    case 'capsule_patched':
      return 'Capsule updated';
    default:
      return `${event.type}`;
  }
}
