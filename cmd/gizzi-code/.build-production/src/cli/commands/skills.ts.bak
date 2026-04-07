import { cmd } from "@/cli/commands/cmd"
import * as prompts from "@clack/prompts"
import { UI } from "@/cli/ui"
import { Global } from "@/runtime/context/global"
import { Agent } from "@/runtime/loop/agent"
import { AgentManager } from "@/runtime/loop/manager"
import { Provider } from "@/runtime/providers/provider"
import path from "path"
import fs from "fs/promises"
import { Filesystem } from "@/shared/util/filesystem"
import matter from "gray-matter"
import { Instance } from "@/runtime/context/project/instance"
import { EOL } from "os"
import type { Argv } from "yargs"
import { createSkillWithAI, generateInterviewQuestions } from "@/runtime/skills/skill-generator"

type AgentMode = "all" | "primary" | "subagent"

const AVAILABLE_TOOLS = [
  "bash",
  "read",
  "write",
  "edit",
  "list",
  "glob",
  "grep",
  "webfetch",
  "task",
  "todowrite",
  "todoread",
]

const AgentCreateCommand = cmd({
  command: "create",
  describe: "create a new agent",
  builder: (yargs: Argv) =>
    yargs
      .option("path", {
        type: "string",
        describe: "directory path to generate the agent file",
      })
      .option("description", {
        type: "string",
        describe: "what the agent should do",
      })
      .option("mode", {
        type: "string",
        describe: "agent mode",
        choices: ["all", "primary", "subagent"] as const,
      })
      .option("tools", {
        type: "string",
        describe: `comma-separated list of tools to enable (default: all). Available: "${AVAILABLE_TOOLS.join(", ")}"`,
      })
      .option("model", {
        type: "string",
        alias: ["m"],
        describe: "model to use in the format of provider/model",
      }),
  async handler(args) {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        const cliPath = args.path
        const cliDescription = args.description
        const cliMode = args.mode as AgentMode | undefined
        const cliTools = args.tools

        const isFullyNonInteractive = cliPath && cliDescription && cliMode && cliTools !== undefined

        if (!isFullyNonInteractive) {
          UI.empty()
          prompts.intro("Create agent")
        }

        const project = Instance.project

        // Determine scope/path
        let targetPath: string
        if (cliPath) {
          targetPath = path.join(cliPath, "agent")
        } else {
          let scope: "global" | "project" = "global"
          if (project.vcs === "git") {
            const scopeResult = await prompts.select({
              message: "Location",
              options: [
                {
                  label: "Current project",
                  value: "project" as const,
                  hint: Instance.worktree,
                },
                {
                  label: "Global",
                  value: "global" as const,
                  hint: Global.Path.config,
                },
              ],
            })
            if (prompts.isCancel(scopeResult)) throw new UI.CancelledError()
            scope = scopeResult
          }
          targetPath = path.join(
            scope === "global" ? Global.Path.config : path.join(Instance.worktree, ".gizzi"),
            "agent",
          )
        }

        // Get description
        let description: string
        if (cliDescription) {
          description = cliDescription
        } else {
          const query = await prompts.text({
            message: "Description",
            placeholder: "What should this agent do?",
            validate: (x) => (x && x.length > 0 ? undefined : "Required"),
          })
          if (prompts.isCancel(query)) throw new UI.CancelledError()
          description = query
        }

        // Generate agent
        const spinner = prompts.spinner()
        spinner.start("Generating agent configuration...")
        const model = args.model ? Provider.parseModel(args.model) : undefined
        const generated = await Agent.generate({ description, model }).catch((error) => {
          spinner.stop(`LLM failed to generate agent: ${error.message}`, 1)
          if (isFullyNonInteractive) process.exit(1)
          throw new UI.CancelledError()
        })
        spinner.stop(`Agent ${generated.identifier} generated`)

        // Select tools
        let selectedTools: string[]
        if (cliTools !== undefined) {
          selectedTools = cliTools ? cliTools.split(",").map((t) => t.trim()) : AVAILABLE_TOOLS
        } else {
          const result = await prompts.multiselect({
            message: "Select tools to enable (Space to toggle)",
            options: AVAILABLE_TOOLS.map((tool) => ({
              label: tool,
              value: tool,
            })),
            initialValues: AVAILABLE_TOOLS,
          })
          if (prompts.isCancel(result)) throw new UI.CancelledError()
          selectedTools = result
        }

        // Get mode
        let mode: AgentMode
        if (cliMode) {
          mode = cliMode
        } else {
          const modeResult = await prompts.select({
            message: "Agent mode",
            options: [
              {
                label: "All",
                value: "all" as const,
                hint: "Can function in both primary and subagent roles",
              },
              {
                label: "Primary",
                value: "primary" as const,
                hint: "Acts as a primary/main agent",
              },
              {
                label: "Subagent",
                value: "subagent" as const,
                hint: "Can be used as a subagent by other agents",
              },
            ],
            initialValue: "all" as const,
          })
          if (prompts.isCancel(modeResult)) throw new UI.CancelledError()
          mode = modeResult
        }

        // Build tools config
        const tools: Record<string, boolean> = {}
        for (const tool of AVAILABLE_TOOLS) {
          if (!selectedTools.includes(tool)) {
            tools[tool] = false
          }
        }

        // Build frontmatter
        const frontmatter: {
          description: string
          mode: AgentMode
          tools?: Record<string, boolean>
        } = {
          description: generated.whenToUse,
          mode,
        }
        if (Object.keys(tools).length > 0) {
          frontmatter.tools = tools
        }

        // Write file
        const content = matter.stringify(generated.systemPrompt, frontmatter)
        const filePath = path.join(targetPath, `${generated.identifier}.md`)

        await fs.mkdir(targetPath, { recursive: true })

        if (await Filesystem.exists(filePath)) {
          if (isFullyNonInteractive) {
            process.stderr.write(`Error: Agent file already exists: ${filePath}${EOL}`)
            process.exit(1)
          }
          prompts.log.error(`Agent file already exists: ${filePath}`)
          throw new UI.CancelledError()
        }

        await Filesystem.write(filePath, content)

        if (isFullyNonInteractive) {
          process.stdout.write(filePath + EOL)
        } else {
          prompts.log.success(`Agent created: ${filePath}`)
          prompts.outro("Done")
        }
      },
    })
  },
})

const AgentListCommand = cmd({
  command: "list",
  describe: "list all available agents",
  async handler() {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        const agents = await AgentManager.list()
        const sortedAgents = agents.sort((a, b) => {
          if (a.native !== b.native) {
            return a.native ? -1 : 1
          }
          return a.name.localeCompare(b.name)
        })

        for (const agent of sortedAgents) {
          process.stdout.write(`${agent.name} (${agent.mode})` + EOL)
          process.stdout.write(`  ${JSON.stringify(agent.permission, null, 2)}` + EOL)
        }
      },
    })
  },
})

/**
 * Create a new skill with AI assistance
 * Simple command: gizzi create-skill
 */
const CreateSkillCommand = cmd({
  command: "create-skill",
  describe: "create a new skill with AI assistance",
  builder: (yargs: Argv) =>
    yargs
      .option("description", {
        type: "string",
        alias: "d",
        describe: "what the skill should do",
      })
      .option("path", {
        type: "string",
        describe: "directory to create the skill in",
      })
      .option("model", {
        type: "string",
        alias: "m",
        describe: "model to use for generation",
      }),
  async handler(args) {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        const cliDescription = args.description
        const cliPath = args.path

        const isNonInteractive = !!cliDescription

        if (!isNonInteractive) {
          UI.empty()
          prompts.intro("Create Skill")
          prompts.log.message("Describe what you want, and I'll build it for you.")
          UI.empty()
        }

        // Get description
        let description: string
        if (cliDescription) {
          description = cliDescription
        } else {
          const result = await prompts.text({
            message: "What should this skill do?",
            placeholder: "e.g., Analyze GitHub PRs and summarize the changes",
            validate: (x) => {
              if (!x || x.length < 10) return "Please provide a more detailed description"
              return undefined
            },
          })
          if (prompts.isCancel(result)) throw new UI.CancelledError()
          description = result
        }

        // Determine target path
        const targetPath = cliPath || "./.gizzi/skills"

        // Optional: Interview questions
        let interviewAnswers: { question: string; answer: string }[] = []
        
        if (!isNonInteractive) {
          const spinner = prompts.spinner()
          spinner.start("Thinking of clarifying questions...")
          
          const questions = await generateInterviewQuestions(description).catch(() => [])
          spinner.stop()

          // Ask up to 3 follow-up questions
          for (let i = 0; i < Math.min(questions.length, 3); i++) {
            const answer = await prompts.text({
              message: questions[i],
              placeholder: "Your answer (or press Enter to skip)",
            })
            if (prompts.isCancel(answer)) throw new UI.CancelledError()
            if (answer && answer.trim()) {
              interviewAnswers.push({ question: questions[i], answer })
            }
          }
        }

        // Generate skill
        const spinner = prompts.spinner()
        spinner.start("Designing your skill...")

        try {
          const model = args.model ? Provider.parseModel(args.model) : undefined
          
          const { skillPath, generated } = await createSkillWithAI({
            description,
            interviewAnswers: interviewAnswers.length > 0 ? interviewAnswers : undefined,
            targetPath,
            model,
            onProgress: (msg) => {
              spinner.message(msg)
            },
          })

          spinner.stop(`Skill "${generated.name}" created!`)

          // Show summary
          if (!isNonInteractive) {
            UI.empty()
            prompts.log.success(`Created: ${skillPath}`)
            prompts.log.message(`Template: ${generated.template}`)
            
            if (generated.scripts && Object.keys(generated.scripts).length > 0) {
              prompts.log.message(`Scripts: ${Object.keys(generated.scripts).join(", ")}`)
            }
            
            if (generated.references && Object.keys(generated.references).length > 0) {
              prompts.log.message(`References: ${Object.keys(generated.references).join(", ")}`)
            }

            prompts.outro("Done! Edit the SKILL.md to customize further.")
          } else {
            process.stdout.write(skillPath + EOL)
          }
        } catch (error) {
          spinner.stop(`Failed to create skill: ${error instanceof Error ? error.message : String(error)}`, 1)
          if (isNonInteractive) process.exit(1)
          throw new UI.CancelledError()
        }
      },
    })
  },
})

export const SkillsCommand = cmd({
  command: "skills",
  describe: "manage skills and agents",
  builder: (yargs) => yargs
    .command(AgentCreateCommand)
    .command(AgentListCommand)
    .command(CreateSkillCommand)
    .demandCommand(),
  async handler() {},
})
