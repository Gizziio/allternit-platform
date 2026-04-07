/**
 * Skill Creator Tool - AskUserQuestion Pattern
 * 
 * This module provides a tool-like interface for AI agents to create skills
 * by asking the user questions, similar to the AskUserQuestion tool.
 * 
 * Usage:
 * ```typescript
 * const result = await skillCreatorTool.execute({
 *   description: "I need a PDF processing skill"
 * })
 * ```
 */

import { createSkillWithAI, generateInterviewQuestions, type GeneratedSkill } from "./skill-generator"
import { SkillCreator } from "./creator"

export interface SkillCreatorToolInput {
  /** Initial description of what the skill should do */
  description: string
  
  /** Optional: skip interview and create immediately */
  skipInterview?: boolean
  
  /** Optional: target directory (default: ./.gizzi/skills) */
  targetPath?: string
}

export interface SkillCreatorToolOutput {
  /** Success status */
  success: boolean
  
  /** Path to created skill */
  skillPath?: string
  
  /** Generated skill details */
  skill?: GeneratedSkill
  
  /** Error message if failed */
  error?: string
}

/**
 * Ask user a question and get their response
 * This mimics the AskUserQuestion tool pattern
 */
type AskUserFunction = (question: string) => Promise<string>

/**
 * Skill Creator Tool - AI Agent Interface
 * 
 * Example:
 * ```typescript
 * // In an agent's tool execution
 * async function handleCreateSkill(args: { description: string }) {
 *   const result = await skillCreatorTool.execute(
 *     { description: args.description },
 *     async (question) => {
 *       // This is where the AI asks the user
 *       return await askUserQuestion({ question })
 *     }
 *   )
 *   return result
 * }
 * ```
 */
export class SkillCreatorTool {
  /**
   * Execute the skill creator with user interaction
   * 
   * @param input - Initial description and options
   * @param askUser - Function to ask user questions (like AskUserQuestion)
   * @returns Result of skill creation
   */
  static async execute(
    input: SkillCreatorToolInput,
    askUser: AskUserFunction
  ): Promise<SkillCreatorToolOutput> {
    try {
      // Step 1: Generate interview questions
      let interviewAnswers: { question: string; answer: string }[] = []

      if (!input.skipInterview) {
        const questions = await generateInterviewQuestions(input.description)
        
        // Ask up to 3 follow-up questions
        for (const question of questions.slice(0, 3)) {
          const answer = await askUser(question)
          if (answer && answer.trim()) {
            interviewAnswers.push({ question, answer })
          }
        }
      }

      // Step 2: Generate and create skill
      const targetPath = input.targetPath || "./.gizzi/skills"
      
      const { skillPath, generated } = await createSkillWithAI({
        description: input.description,
        interviewAnswers: interviewAnswers.length > 0 ? interviewAnswers : undefined,
        targetPath,
      })

      return {
        success: true,
        skillPath,
        skill: generated,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Quick create - no interview, just generate from description
   */
  static async quickCreate(
    description: string,
    targetPath: string = "./.gizzi/skills"
  ): Promise<SkillCreatorToolOutput> {
    return this.execute(
      { description, skipInterview: true, targetPath },
      async () => "" // No-op, won't be called
    )
  }

  /**
   * Interactive create with console prompts (for CLI use)
   */
  static async interactiveCreate(
    description: string,
    promptFn: (question: string) => Promise<string>
  ): Promise<SkillCreatorToolOutput> {
    return this.execute({ description }, promptFn)
  }
}

/**
 * Tool definition for AI agent tool registry
 * 
 * This can be registered as a tool that AI agents can call
 */
export const SkillCreatorToolDefinition = {
  name: "create_skill",
  description: "Create a new skill by interviewing the user about their needs. The AI will ask follow-up questions, then generate complete skill files including scripts and documentation.",
  parameters: {
    type: "object",
    properties: {
      description: {
        type: "string",
        description: "What the skill should do (e.g., 'Analyze GitHub PRs and summarize changes')",
      },
      skipInterview: {
        type: "boolean",
        description: "If true, skip follow-up questions and create skill immediately",
        default: false,
      },
    },
    required: ["description"],
  },
  returns: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      skillPath: { type: "string", description: "Path to created skill directory" },
      skillName: { type: "string" },
      error: { type: "string" },
    },
  },
  
  /**
   * Execute the tool
   * 
   * @param args - Tool arguments
   * @param context - Tool context with askUser function
   */
  async execute(
    args: { description: string; skipInterview?: boolean },
    context: { askUser: AskUserFunction }
  ): Promise<SkillCreatorToolOutput> {
    return SkillCreatorTool.execute(args, context.askUser)
  },
}

/**
 * Example usage in an AI agent:
 * 
 * ```typescript
 * // Agent decides to create a skill
 * const result = await SkillCreatorTool.execute(
 *   { description: "Process PDF invoices and extract data" },
 *   async (question) => {
 *     // This triggers the AskUserQuestion tool
 *     return await tools.askUserQuestion({ question })
 *   }
 * )
 * 
 * if (result.success) {
 *   await say(`Created skill "${result.skill!.name}" at ${result.skillPath}`)
 * } else {
 *   await say(`Failed to create skill: ${result.error}`)
 * }
 * ```
 */

/**
 * Simplified API for common use cases
 */
export const skillCreator = {
  /**
   * Create a skill with full interview
   */
  async create(description: string, askUser: AskUserFunction): Promise<SkillCreatorToolOutput> {
    return SkillCreatorTool.execute({ description }, askUser)
  },

  /**
   * Create a skill quickly without interview
   */
  async quickCreate(description: string, targetPath?: string): Promise<SkillCreatorToolOutput> {
    return SkillCreatorTool.quickCreate(description, targetPath)
  },

  /**
   * Tool definition for AI agents
   */
  tool: SkillCreatorToolDefinition,
}
