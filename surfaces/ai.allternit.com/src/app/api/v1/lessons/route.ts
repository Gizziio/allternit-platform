import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client-sqlite";
import { alabsLesson, alabsCourse } from "@/lib/db/schema-sqlite";
import { eq, asc, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    const status = searchParams.get("status") ?? "published";

    let query = db
      .select({
        id: alabsLesson.id,
        courseId: alabsLesson.courseId,
        moduleNumber: alabsLesson.moduleNumber,
        lessonNumber: alabsLesson.lessonNumber,
        title: alabsLesson.title,
        description: alabsLesson.description,
        sceneJson: alabsLesson.sceneJson,
        videoUrl: alabsLesson.videoUrl,
        durationMinutes: alabsLesson.durationMinutes,
        status: alabsLesson.status,
        publishedAt: alabsLesson.publishedAt,
        createdAt: alabsLesson.createdAt,
        courseCode: alabsCourse.code,
        courseTitle: alabsCourse.title,
      })
      .from(alabsLesson)
      .innerJoin(alabsCourse, eq(alabsLesson.courseId, alabsCourse.id))
      .where(eq(alabsLesson.status, status as "draft" | "published" | "archived"))
      .orderBy(asc(alabsLesson.moduleNumber), asc(alabsLesson.lessonNumber));

    if (courseId) {
      query = db
        .select({
          id: alabsLesson.id,
          courseId: alabsLesson.courseId,
          moduleNumber: alabsLesson.moduleNumber,
          lessonNumber: alabsLesson.lessonNumber,
          title: alabsLesson.title,
          description: alabsLesson.description,
          sceneJson: alabsLesson.sceneJson,
          videoUrl: alabsLesson.videoUrl,
          durationMinutes: alabsLesson.durationMinutes,
          status: alabsLesson.status,
          publishedAt: alabsLesson.publishedAt,
          createdAt: alabsLesson.createdAt,
          courseCode: alabsCourse.code,
          courseTitle: alabsCourse.title,
        })
        .from(alabsLesson)
        .innerJoin(alabsCourse, eq(alabsLesson.courseId, alabsCourse.id))
        .where(
          and(
            eq(alabsLesson.status, status as "draft" | "published" | "archived"),
            eq(alabsLesson.courseId, courseId)
          )
        )
        .orderBy(asc(alabsLesson.moduleNumber), asc(alabsLesson.lessonNumber));
    }

    const lessons = await query;
    return NextResponse.json(lessons);
  } catch (error) {
    console.error("[GET /api/v1/lessons] error:", error);
    return NextResponse.json({ error: "Failed to load lessons" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const [lesson] = await db
      .insert(alabsLesson)
      .values({
        courseId: body.courseId,
        moduleNumber: body.moduleNumber ?? 1,
        lessonNumber: body.lessonNumber ?? 1,
        title: body.title,
        description: body.description ?? "",
        contentMarkdown: body.contentMarkdown,
        contentHtml: body.contentHtml,
        videoUrl: body.videoUrl,
        durationMinutes: body.durationMinutes ?? 0,
        status: body.status ?? "draft",
        publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
      })
      .returning();
    return NextResponse.json(lesson, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/lessons] error:", error);
    return NextResponse.json({ error: "Failed to create lesson" }, { status: 500 });
  }
}
