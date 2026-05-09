import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client-sqlite";
import { alabsArticle } from "@/lib/db/schema-sqlite";
import { eq, desc, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const contentType = searchParams.get("contentType");
    const status = searchParams.get("status") ?? "published";

    let query = db
      .select()
      .from(alabsArticle)
      .where(eq(alabsArticle.status, status as "draft" | "published" | "archived"))
      .orderBy(desc(alabsArticle.publishedAt));

    if (contentType) {
      query = db
        .select()
        .from(alabsArticle)
        .where(
          and(
            eq(alabsArticle.status, status as "draft" | "published" | "archived"),
            eq(alabsArticle.contentType, contentType as "signal" | "feature" | "index" | "annual" | "course" | "lesson")
          )
        )
        .orderBy(desc(alabsArticle.publishedAt));
    }

    const articles = await query;
    return NextResponse.json(articles);
  } catch (error) {
    console.error("[GET /api/v1/articles] error:", error);
    return NextResponse.json({ error: "Failed to load articles" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const [article] = await db
      .insert(alabsArticle)
      .values({
        slug: body.slug,
        type: body.type,
        contentType: body.contentType,
        status: body.status ?? "draft",
        title: body.title,
        subtitle: body.subtitle,
        abstract: body.abstract,
        authors: JSON.stringify(body.authors ?? []),
        teams: JSON.stringify(body.teams ?? []),
        tags: JSON.stringify(body.tags ?? []),
        keywords: JSON.stringify(body.keywords ?? []),
        contentMarkdown: body.contentMarkdown,
        contentHtml: body.contentHtml,
        readingTime: body.readingTime,
        featured: body.featured ?? false,
        series: body.series,
        issueNumber: body.issueNumber,
        license: body.license ?? "CC BY 4.0",
        accessLevel: body.accessLevel ?? "public",
        publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
      })
      .returning();
    return NextResponse.json(article, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/articles] error:", error);
    return NextResponse.json({ error: "Failed to create article" }, { status: 500 });
  }
}
