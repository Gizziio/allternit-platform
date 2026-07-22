import { randomUUID } from "node:crypto"
import { RuntimeTelemetryRegistry, type RuntimeTelemetryEvents, type TelemetryPrimitive } from "./events"
import { cleanTelemetryString, telemetryDisabled } from "./privacy"

export interface RuntimeTelemetryRecord {
  id: string
  event: keyof RuntimeTelemetryEvents
  timestamp: number
  properties: Record<string, TelemetryPrimitive>
}

type Sink = (record: RuntimeTelemetryRecord) => void | Promise<void>

export namespace RuntimeTelemetry {
  const queued: RuntimeTelemetryRecord[] = []
  let sink: Sink | undefined

  export function attach(next: Sink) {
    sink = next
    for (const record of queued.splice(0)) void next(record)
  }

  export function track<K extends keyof RuntimeTelemetryEvents>(event: K, input: RuntimeTelemetryEvents[K]) {
    if (telemetryDisabled()) return
    const allowed = RuntimeTelemetryRegistry[event].properties
    const properties: Record<string, TelemetryPrimitive> = {}
    for (const key of Object.keys(allowed)) {
      const value = input[key as keyof RuntimeTelemetryEvents[K]] as unknown
      if (value === undefined || value === null || typeof value === "boolean") properties[key] = value
      if (typeof value === "string") properties[key] = cleanTelemetryString(value)
      if (typeof value === "number" && Number.isFinite(value)) properties[key] = value
    }
    const record: RuntimeTelemetryRecord = { id: randomUUID(), event, timestamp: Date.now(), properties }
    if (sink) void sink(record)
    else {
      queued.push(record)
      if (queued.length > 500) queued.shift()
    }
  }
}

