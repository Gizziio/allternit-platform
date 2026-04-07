/**
 * Feedback Survey utilities
 */

export interface SurveyUtils {
  formatQuestion(question: string): string
  validateResponse(response: string): boolean
}

export type FeedbackSurveyResponse = 'bad' | 'good' | 'neutral' | 'dismissed' | 'fine'

export type FeedbackSurveyType = 
  | 'memory'
  | 'compact'
  | 'post_session'
  | 'frustration'
  | 'feature'
  | 'session'

export function formatQuestion(question: string): string {
  return question.trim()
}

export function validateResponse(response: string): boolean {
  return response.length > 0
}

export function calculateSurveyScore(responses: Record<string, number>): number {
  const values = Object.values(responses)
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}
