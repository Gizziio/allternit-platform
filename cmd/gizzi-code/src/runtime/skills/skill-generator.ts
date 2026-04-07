export interface GeneratedSkill {
  name: string
  description: string
  template: string
  skillMd: string
  examples: string[]
}

export interface SkillGenerationInput {
  userDescription: string
  interviewQa?: { question: string; answer: string }[]
  model?: { providerID: string; modelID: string }
}

export async function generateInterviewQuestions(): Promise<string[]> {
  return []
}

export async function generateSkill(input: SkillGenerationInput): Promise<GeneratedSkill> {
  return {
    name: "generated-skill",
    description: input.userDescription,
    template: "default",
    skillMd: "",
    examples: []
  }
}

export async function createSkillFromGenerated(generated: GeneratedSkill, targetPath: string): Promise<string> {
  return targetPath
}

export async function createSkillWithAI(options: {
  description: string
  interviewAnswers?: { question: string; answer: string }[]
  targetPath: string
  model?: { providerID: string; modelID: string }
  onProgress?: (step: string) => void
}): Promise<{ skillPath: string; generated: GeneratedSkill }> {
  options.onProgress?.("Creating skill...")
  
  const generated = await generateSkill({
    userDescription: options.description,
    interviewQa: options.interviewAnswers,
    model: options.model
  })
  
  const skillPath = await createSkillFromGenerated(generated, options.targetPath)
  
  options.onProgress?.("Skill created!")
  
  return { skillPath, generated }
}
