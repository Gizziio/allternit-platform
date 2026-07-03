import { CronService } from '../../automation/cron/service.js'

let initializing = false

export function ensureCronService(): void {
  if (CronService.isRunning()) {
    return
  }
  if (initializing) {
    return
  }
  initializing = true
  try {
    CronService.initialize()
    CronService.start()
  } finally {
    initializing = false
  }
}
