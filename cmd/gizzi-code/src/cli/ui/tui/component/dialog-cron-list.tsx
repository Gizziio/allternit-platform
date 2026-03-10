import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { DialogSelect } from "@/cli/ui/tui/ui/dialog-select"
import { useSync } from "@/cli/ui/tui/context/sync"
import { createMemo, createSignal } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { DialogPrompt } from "@/cli/ui/tui/ui/dialog-prompt"
import { CronParser } from "@/runtime/automation/cron/parser"
import { sanitizeBrandSurface } from "@/shared/brand"

export function DialogCronList() {
  const dialog = useDialog()
  const sync = useSync()
  const { theme } = useTheme()
  const sdk = useSDK()

  const [toDelete, setToDelete] = createSignal<string>()

  const jobs = createMemo(() => sync.data.cron_jobs)
  const runs = createMemo(() => sync.data.cron_runs)

  const formatSchedule = (schedule: string): string => {
    if (schedule === "*/5 * * * *") return "Every 5 minutes"
    if (schedule === "*/15 * * * *") return "Every 15 minutes"
    if (schedule === "0 * * * *") return "Every hour"
    if (schedule === "0 */6 * * *") return "Every 6 hours"
    if (schedule === "0 0 * * *") return "Daily at midnight"
    if (schedule === "0 9 * * *") return "Daily at 9 AM"
    if (schedule === "0 9 * * 1") return "Weekly on Monday at 9 AM"
    return schedule
  }

  const options = createMemo(() =>
    jobs().map((job) => {
      const isDeleting = toDelete() === job.id
      const statusIcon = job.status === "active" ? "●" : job.status === "paused" ? "⏸" : "○"
      
      return {
        title: isDeleting 
          ? `Press again to delete "${job.name}"` 
          : `${statusIcon} ${job.name}`,
        description: `${formatSchedule(job.schedule)} | ${job.prompt.slice(0, 50)}...`,
        value: job.id,
        bg: isDeleting ? theme.error : undefined,
        fg: job.status === "active" ? theme.success : theme.textMuted,
      }
    })
  )

  const handleCreate = async () => {
    // Step 1: Get job name
    const name = await DialogPrompt.show(dialog, "Job Name", {
      placeholder: "Daily standup report",
      description: () => (
        <text fg={theme.textMuted}>A descriptive name for this scheduled job</text>
      ),
    })
    
    if (!name) {
      dialog.replace(() => <DialogCronList />)
      return
    }

    // Step 2: Get cron schedule
    const schedule = await DialogPrompt.show(dialog, "Cron Schedule", {
      placeholder: "0 9 * * *",
      description: () => (
        <text fg={theme.textMuted}>
          Cron expression (e.g., */5 * * * * = every 5 min, 0 9 * * * = daily 9am)
        </text>
      ),
    })
    
    if (!schedule || !CronParser.isValid(schedule)) {
      dialog.replace(() => <DialogCronList />)
      return
    }

    // Step 3: Get prompt
    const prompt = await DialogPrompt.show(dialog, "Prompt to Execute", {
      placeholder: "Generate a summary of recent commits...",
      description: () => (
        <text fg={theme.textMuted}>The prompt that will be sent to the agent</text>
      ),
    })
    
    if (!prompt) {
      dialog.replace(() => <DialogCronList />)
      return
    }

    // Step 4: Select agent (optional)
    const agents = sync.data.agent
    const agentName = await new Promise<string | null>((resolve) => {
      dialog.replace(
        () => (
          <DialogSelect
            title="Select Agent (optional)"
            options={[
              { title: "Default agent", value: "" },
              ...agents.map((a) => ({ 
                title: a.name, 
                value: a.name,
                description: a.description ? sanitizeBrandSurface(a.description) : undefined
              })),
            ]}
            onSelect={(opt) => resolve(opt.value)}
          />
        ),
        () => resolve(null)
      )
    })

    if (agentName === null) {
      dialog.replace(() => <DialogCronList />)
      return
    }

    // Create the cron job
    try {
      await sdk.client.cron.create({
        name,
        schedule,
        prompt,
        agent: agentName || undefined,
        wakeMode: "main",
      })
    } catch (e) {
      // Error will be handled by SDK
    }

    dialog.replace(() => <DialogCronList />)
  }

  return (
    <DialogSelect
      title="Cron Jobs"
      options={[
        ...options(),
        {
          title: "+ Create new job",
          value: "__create__",
          description: "Schedule a new automated task",
        },
      ]}
      onMove={() => setToDelete(undefined)}
      onSelect={(option) => {
        if (option.value === "__create__") {
          handleCreate()
          return
        }
        // Run the job immediately
        sdk.client.cron.run({ id: option.value })
        dialog.clear()
      }}
    />
  )
}
