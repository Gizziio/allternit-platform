export const dynamic = 'force-dynamic';
/**
 * Enrollments API
 *
 * GET  /api/v1/enrollments?courseId=xxx&lessonId=xxx - List user's enrollments
 * POST /api/v1/enrollments - Create or update an enrollment
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client-sqlite';
import { alabsEnrollment } from '@/lib/db/schema-sqlite';
import { eq, and } from 'drizzle-orm';
import { getAuth } from '@/lib/server-auth';
import { resolvePlatformUserId } from '@/lib/server-user';

// GET /api/v1/enrollments
export async function GET(req: NextRequest) {
  try {
    const { userId: authUserId } = await getAuth();
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = await resolvePlatformUserId(authUserId);

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId');
    const lessonId = searchParams.get('lessonId');

    let query = db.select().from(alabsEnrollment).where(eq(alabsEnrollment.userId, userId));

    if (courseId && lessonId) {
      query = db.select().from(alabsEnrollment).where(
        and(
          eq(alabsEnrollment.userId, userId),
          eq(alabsEnrollment.courseId, courseId),
          eq(alabsEnrollment.lessonId, lessonId)
        )
      );
    } else if (courseId) {
      query = db.select().from(alabsEnrollment).where(
        and(
          eq(alabsEnrollment.userId, userId),
          eq(alabsEnrollment.courseId, courseId)
        )
      );
    }

    const enrollments = await query;
    return NextResponse.json(enrollments);
  } catch (error) {
    console.error('Failed to list enrollments:', error);
    return NextResponse.json({ error: 'Failed to list enrollments' }, { status: 500 });
  }
}

// POST /api/v1/enrollments
export async function POST(request: NextRequest) {
  try {
    const { userId: authUserId } = await getAuth();
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = await resolvePlatformUserId(authUserId);

    const body = await request.json();
    const { courseId, lessonId, progress, status } = body;

    if (!courseId) {
      return NextResponse.json(
        { error: 'Missing required field: courseId' },
        { status: 400 }
      );
    }

    const whereClause = lessonId
      ? and(eq(alabsEnrollment.userId, userId), eq(alabsEnrollment.courseId, courseId), eq(alabsEnrollment.lessonId, lessonId))
      : and(eq(alabsEnrollment.userId, userId), eq(alabsEnrollment.courseId, courseId));

    const existing = await db.select().from(alabsEnrollment).where(whereClause).limit(1);

    if (existing.length > 0) {
      const updated = await db
        .update(alabsEnrollment)
        .set({
          progress: progress ?? existing[0].progress,
          status: status ?? existing[0].status,
          updatedAt: new Date(),
          ...(status === 'completed' ? { completedAt: new Date() } : {}),
        })
        .where(eq(alabsEnrollment.id, existing[0].id))
        .returning();
      return NextResponse.json(updated[0]);
    }

    const created = await db
      .insert(alabsEnrollment)
      .values({
        userId,
        courseId,
        lessonId: lessonId || null,
        progress: progress ?? 0,
        status: status || 'in_progress',
      })
      .returning();

    return NextResponse.json(created[0], { status: 201 });
  } catch (error) {
    console.error('Failed to create enrollment:', error);
    return NextResponse.json({ error: 'Failed to create enrollment' }, { status: 500 });
  }
}
