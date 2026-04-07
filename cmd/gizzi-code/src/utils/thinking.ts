/**
 * Thinking/thought process utilities
 */

export interface Thought {
  id: string
  content: string
  timestamp: number
  category?: string
}

export class ThinkingSession {
  private thoughts: Thought[] = []
  private isActive = false

  start(): void {
    this.isActive = true
    this.thoughts = []
  }

  stop(): Thought[] {
    this.isActive = false
    return [...this.thoughts]
  }

  addThought(content: string, category?: string): void {
    if (!this.isActive) return
    this.thoughts.push({
      id: `thought_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      content,
      timestamp: Date.now(),
      category,
    })
  }

  getThoughts(): Thought[] {
    return [...this.thoughts]
  }

  clear(): void {
    this.thoughts = []
  }

  isThinking(): boolean {
    return this.isActive
  }
}

export function formatThought(thought: Thought): string {
  const time = new Date(thought.timestamp).toLocaleTimeString()
  const category = thought.category ? `[${thought.category}] ` : ''
  return `${time} ${category}${thought.content}`
}

export default {
  ThinkingSession,
  formatThought,
}
