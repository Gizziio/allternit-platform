export const dynamic = 'force-dynamic';
/**
 * Certifications API
 *
 * GET  /api/v1/certifications - List user's certifications
 * POST /api/v1/certifications - Add or update a certification
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client-sqlite';
import { certification } from '@/lib/db/schema-sqlite';
import { eq, and } from 'drizzle-orm';
import { getAuth } from '@/lib/server-auth';
import { resolvePlatformUserId } from '@/lib/server-user';

// GET /api/v1/certifications
export async function GET() {
  try {
    const { userId: authUserId } = await getAuth();
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = await resolvePlatformUserId(authUserId);

    const certs = await db.query.certification.findMany({
      where: eq(certification.userId, userId),
      orderBy: (cert: { completedAt: unknown }, { desc }: { desc: (col: unknown) => unknown }) => [desc(cert.completedAt)],
    });

    return NextResponse.json(certs.map((c: { id: string; courseCode: string; courseTitle: string; tier: string; completedAt: unknown; capstoneUrl: string | null; score: number | null; verified: boolean }) => ({
      id: c.id,
      courseCode: c.courseCode,
      courseTitle: c.courseTitle,
      tier: c.tier,
      completedAt: c.completedAt,
      capstoneUrl: c.capstoneUrl,
      score: c.score,
      verified: c.verified,
    })));
  } catch (error) {
    console.error('Failed to list certifications:', error);
    return NextResponse.json({ error: 'Failed to list certifications' }, { status: 500 });
  }
}

// POST /api/v1/certifications
export async function POST(request: NextRequest) {
  try {
    const { userId: authUserId } = await getAuth();
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = await resolvePlatformUserId(authUserId);

    const body = await request.json();
    const { courseCode, courseTitle, tier, capstoneUrl, score, verified } = body;

    if (!courseCode || !courseTitle || !tier) {
      return NextResponse.json(
        { error: 'Missing required fields: courseCode, courseTitle, tier' },
        { status: 400 }
      );
    }

    // Upsert certification
    const existing = await db.query.certification.findFirst({
      where: and(
        eq(certification.userId, userId),
        eq(certification.courseCode, courseCode)
      ),
    });

    if (existing) {
      const updated = await db
        .update(certification)
        .set({
          courseTitle,
          tier,
          capstoneUrl: capstoneUrl ?? existing.capstoneUrl,
          score: score ?? existing.score,
          verified: verified ?? existing.verified,
          completedAt: new Date(),
        })
        .where(eq(certification.id, existing.id))
        .returning();
      return NextResponse.json(updated[0]);
    }

    const created = await db
      .insert(certification)
      .values({
        userId,
        courseCode,
        courseTitle,
        tier,
        capstoneUrl: capstoneUrl || null,
        score: score != null ? score : null,
        verified: verified ?? false,
        completedAt: new Date(),
      })
      .returning();

    return NextResponse.json(created[0], { status: 201 });
  } catch (error) {
    console.error('Failed to create certification:', error);
    return NextResponse.json({ error: 'Failed to create certification' }, { status: 500 });
  }
}
