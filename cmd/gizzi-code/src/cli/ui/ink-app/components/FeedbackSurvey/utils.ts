/**
 * Feedback Survey Utilities
 * TEMPORARY SHIM
 */

export function formatSurveyData(data: Record<string, unknown>): string {
  return JSON.stringify(data)
}

export function validateSurveyResponse(response: unknown): boolean {
  return response !== null && response !== undefined
}

export default { formatSurveyData, validateSurveyResponse }
