/**
 * Feedback Survey Utilities
 */

/**
 * A user's response to a feedback survey.
 *
 * Literals derived from the live consumers:
 * - `FeedbackSurveyView.tsx` maps digit inputs 0-3 to these values.
 * - `useSurveyState.tsx` previously defined this same union locally.
 * - `useFeedbackSurvey.tsx` treats 'bad' and 'good' as transcript-ask triggers.
 */
export type FeedbackSurveyResponse = 'dismissed' | 'bad' | 'fine' | 'good';

/**
 * Identifies which survey surfaced, recorded as `survey_type` in
 * `tengu_feedback_survey_event` analytics. 'session' is the generic
 * in-session survey; 'memory' and 'post_compact' are logged by
 * `useMemorySurvey.tsx` and `usePostCompactSurvey.tsx` respectively.
 */
export type FeedbackSurveyType = 'session' | 'memory' | 'post_compact';

export function formatSurveyData(data: Record<string, unknown>): string {
  return JSON.stringify(data)
}

export function validateSurveyResponse(response: unknown): boolean {
  return response !== null && response !== undefined
}

export default { formatSurveyData, validateSurveyResponse }
