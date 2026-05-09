import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client-sqlite";
import { alabsCourse } from "@/lib/db/schema-sqlite";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  try {
    const courses = await db
      .select()
      .from(alabsCourse)
      .where(eq(alabsCourse.published, true))
      .orderBy(asc(alabsCourse.sortOrder));
    return NextResponse.json(courses);
  } catch (error) {
    console.error("[GET /api/v1/courses] error:", error);
    return NextResponse.json({ error: "Failed to load courses" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const [course] = await db
      .insert(alabsCourse)
      .values({
        code: body.code,
        title: body.title,
        description: body.description,
        tier: body.tier,
        canvasUrl: body.canvasUrl,
        modules: body.modules,
        capstone: body.capstone,
        coverImage: body.coverImage,
        demosUrl: body.demosUrl,
        sortOrder: body.sortOrder,
        published: body.published ?? false,
      })
      .returning();
    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/courses] error:", error);
    return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }
}
