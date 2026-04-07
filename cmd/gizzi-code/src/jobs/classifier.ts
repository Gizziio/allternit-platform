/**
 * Jobs Classifier
 * TEMPORARY SHIM
 */

export interface JobClassification {
  type: string
  priority: number
}

export function classifyJob(_job: unknown): JobClassification {
  return { type: 'default', priority: 0 }
}

export function classifyAndWriteState(_input: unknown): Promise<unknown> {
  return Promise.resolve({ type: 'default' })
}

export default { classifyJob, classifyAndWriteState }
