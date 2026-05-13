/**
 * Canvas LMS Completion Sync
 *
 * Lightweight bidirectional sync: when an A://Labs lesson is completed,
 * optionally push a grade/submission to Canvas if the course is linked
 * and an assignment with a matching name exists.
 */

export interface CanvasConfig {
  token: string;
  domain: string;
  courseId: string;
}

function canvasUrl(domain: string, path: string) {
  const base = domain.replace(/\/$/, '');
  return `${base}/api/v1${path}`;
}

function canvasHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Find a Canvas assignment whose name contains the lesson title.
 * Returns the assignment ID or null.
 */
export async function findCanvasAssignment(
  config: CanvasConfig,
  lessonTitle: string
): Promise<string | null> {
  const res = await fetch(
    canvasUrl(config.domain, `/courses/${config.courseId}/assignments?per_page=100`),
    { headers: canvasHeaders(config.token) }
  );
  if (!res.ok) {
    console.error('[Canvas] Failed to fetch assignments:', res.status);
    return null;
  }
  const assignments = await res.json();
  const normalized = lessonTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
  const match = assignments.find((a: any) =>
    a.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalized) ||
    normalized.includes(a.name.toLowerCase().replace(/[^a-z0-9]/g, ''))
  );
  return match?.id?.toString() ?? null;
}

/**
 * Submit a grade/completion to a Canvas assignment.
 */
export async function submitCanvasCompletion(
  config: CanvasConfig,
  assignmentId: string,
  score?: number
): Promise<void> {
  const res = await fetch(
    canvasUrl(config.domain, `/courses/${config.courseId}/assignments/${assignmentId}/submissions/self`),
    {
      method: 'PUT',
      headers: canvasHeaders(config.token),
      body: JSON.stringify({
        submission: {
          posted_grade: score ?? 'complete',
        },
      }),
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Canvas submission failed: ${res.status} — ${JSON.stringify(body)}`);
  }
}

/**
 * High-level helper: try to mark a lesson as complete in Canvas.
 * Returns true if successful, false if no matching assignment found.
 */
export async function pushLessonCompletionToCanvas(
  config: CanvasConfig,
  lessonTitle: string,
  score?: number
): Promise<{ success: boolean; message: string }> {
  try {
    const assignmentId = await findCanvasAssignment(config, lessonTitle);
    if (!assignmentId) {
      return { success: false, message: 'No matching Canvas assignment found' };
    }
    await submitCanvasCompletion(config, assignmentId, score);
    return { success: true, message: 'Completion sent to Canvas' };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
