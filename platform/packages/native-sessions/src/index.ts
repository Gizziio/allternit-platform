export type {
  CatalogOptions,
  Divergence,
  EventKind,
  HarnessId,
  NativeSession,
  NativeTranscript,
  NativeExport,
  OriginDelta,
  PortableEvent,
  ReaderKind,
  Role,
  SourceRef,
} from "./types.js"
export { HARNESSES, HARNESS_BY_ID, harnessHome, encodeClaudeCwd, encodeGrokCwd } from "./harness.js"
export { fingerprintPath, fingerprintPaths, divergenceOf } from "./fingerprint.js"
export { listHarnesses, listNativeSessions, getNativeSession } from "./catalog.js"
export { showNativeSession, eventsAfter } from "./project.js"
export { exportPortableSession, DIRECT_EXPORT_HARNESSES } from "./export.js"

import { getNativeSession } from "./catalog.js"
import { eventsAfter, showNativeSession } from "./project.js"
import { divergenceOf } from "./fingerprint.js"
import type { CatalogOptions, HarnessId, OriginDelta, SourceRef } from "./types.js"

/** Compare a stored snapshot to the live native file. Does not write anything. */
export function inspectOrigin(ref: SourceRef, opts: CatalogOptions = {}): OriginDelta {
  const live = getNativeSession(ref.harness, ref.sessionId, opts)
  if (!live) {
    return { source: { ...ref, nativeHash: undefined }, divergence: "missing", events: [] }
  }
  const nativeHash = live.fingerprint
  const divergence = divergenceOf(ref.snapshotHash, nativeHash, ref.fetchedHash)
  if (divergence !== "native_ahead") {
    return { source: { ...ref, nativeHash }, divergence, events: [] }
  }
  const transcript = showNativeSession(ref.harness, ref.sessionId, opts)
  return {
    source: { ...ref, nativeHash },
    divergence,
    events: eventsAfter(transcript, ref.eventId),
  }
}

export function snapshotRef(harness: HarnessId, sessionId: string, opts: CatalogOptions = {}): SourceRef | undefined {
  const live = getNativeSession(harness, sessionId, opts)
  if (!live) return undefined
  const transcript = showNativeSession(harness, sessionId, opts)
  const last = [...transcript.events].reverse().find((e) => e.sourceId)
  return {
    harness,
    sessionId: live.sessionId,
    path: live.path,
    snapshotHash: live.fingerprint,
    snapshotAt: Date.now(),
    eventId: last?.sourceId ?? live.lastEventId,
    nativeHash: live.fingerprint,
    fetchedHash: live.fingerprint,
  }
}
