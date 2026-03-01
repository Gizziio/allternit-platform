import z from "zod/v4"

export namespace CronTypes {
  export const CronJobStatus = z.enum(["active", "paused", "disabled"])
  export type CronJobStatus = z.infer<typeof CronJobStatus>

  export const CronJob = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    schedule: z.string(), // cron expression
    prompt: z.string(),
    agent: z.string().optional(),
    sessionID: z.string().optional(), // null = isolated run
    status: CronJobStatus,
    wakeMode: z.enum(["main", "isolated"]).default("main"),
    createdAt: z.number(),
    updatedAt: z.number(),
    lastRunAt: z.number().optional(),
    nextRunAt: z.number().optional(),
    runCount: z.number().default(0),
    failCount: z.number().default(0),
  })
  export type CronJob = z.infer<typeof CronJob>

  export const CronJobInput = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    schedule: z.string(), // cron expression
    prompt: z.string(),
    agent: z.string().optional(),
    sessionID: z.string().optional(),
    wakeMode: z.enum(["main", "isolated"]).default("main"),
  })
  export type CronJobInput = z.infer<typeof CronJobInput>

  export const CronJobUpdate = CronJobInput.partial()
  export type CronJobUpdate = z.infer<typeof CronJobUpdate>

  export const CronRunStatus = z.enum([
    "pending",
    "running",
    "completed",
    "failed",
    "aborted",
  ])
  export type CronRunStatus = z.infer<typeof CronRunStatus>

  export const CronRun = z.object({
    id: z.string(),
    jobId: z.string(),
    runId: z.string().optional(), // links to RunRegistry if applicable
    sessionID: z.string().optional(),
    status: CronRunStatus,
    startedAt: z.number(),
    finishedAt: z.number().optional(),
    output: z.string().optional(),
    error: z.string().optional(),
  })
  export type CronRun = z.infer<typeof CronRun>

  export const CronWakeReason = z.enum([
    "schedule",
    "manual",
    "api",
    "startup",
  ])
  export type CronWakeReason = z.infer<typeof CronWakeReason>
}
