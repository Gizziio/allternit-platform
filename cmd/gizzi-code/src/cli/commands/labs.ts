import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import {
  apiFetchJson,
  getAllternitApiConfig,
} from "@/runtime/services/api/allternitApi"

interface Course {
  id: string
  code: string
  title: string
  description: string
  tier: string
  canvas_url?: string
  modules: number
  capstone: string
}

interface Lesson {
  id: string
  course_id: string
  module_number: number
  lesson_number: number
  title: string
  description: string
  video_url?: string
  duration_minutes: number
  status: string
  course_code?: string
  course_title?: string
}

export const LabsCommand = cmd({
  command: "labs [action]",
  describe: "Browse A://Labs courses and lessons",
  builder: (yargs) =>
    yargs.positional("action", {
      type: "string",
      choices: ["courses", "lessons"],
      describe: "List courses or lessons",
      default: "courses",
    }),

  handler: async (args) => {
    const action = args.action as "courses" | "lessons"
    const config = getAllternitApiConfig()

    try {
      if (action === "courses") {
        const courses = await apiFetchJson<Course[]>(config, "/courses")
        if (courses.length === 0) {
          UI.println(UI.Style.TEXT_INFO + "No courses published yet." + UI.Style.RESET)
          return
        }

        UI.println(UI.Style.TEXT_INFO_BOLD + `A://Labs — ${courses.length} Course(s)` + UI.Style.RESET)
        UI.empty()
        for (const course of courses) {
          UI.println(`  ${UI.Style.TEXT_NORMAL_BOLD}${course.code}${UI.Style.RESET} · ${course.title}`)
          UI.println(`    ${UI.Style.TEXT_DIM}${course.description}${UI.Style.RESET}`)
          UI.println(`    ${UI.Style.TEXT_DIM}Tier:${UI.Style.RESET} ${course.tier}  ${UI.Style.TEXT_DIM}Modules:${UI.Style.RESET} ${course.modules}`)
          UI.println(`    ${UI.Style.TEXT_DIM}Capstone:${UI.Style.RESET} ${course.capstone}`)
          UI.empty()
        }
      } else {
        const lessons = await apiFetchJson<Lesson[]>(config, "/lessons?status=published")
        if (lessons.length === 0) {
          UI.println(UI.Style.TEXT_INFO + "No lessons published yet." + UI.Style.RESET)
          return
        }

        UI.println(UI.Style.TEXT_INFO_BOLD + `A://Labs — ${lessons.length} Lesson(s)` + UI.Style.RESET)
        UI.empty()
        for (const lesson of lessons) {
          const courseLabel = lesson.course_code
            ? `${lesson.course_code} · ${lesson.course_title ?? ""}`
            : "Unknown course"
          const duration = lesson.duration_minutes > 0 ? ` · ${lesson.duration_minutes}m` : ""
          UI.println(`  ${UI.Style.TEXT_NORMAL_BOLD}M${lesson.module_number}.${lesson.lesson_number}${UI.Style.RESET} ${lesson.title}${duration}`)
          UI.println(`    ${UI.Style.TEXT_DIM}${courseLabel}${UI.Style.RESET}`)
          UI.println(`    ${UI.Style.TEXT_DIM}${lesson.description}${UI.Style.RESET}`)
          UI.empty()
        }
      }
    } catch (err: any) {
      UI.println(UI.Style.TEXT_ERROR + `❌ Failed to load A://Labs: ${err.message}` + UI.Style.RESET)
      process.exitCode = 1
    }
  },
})
