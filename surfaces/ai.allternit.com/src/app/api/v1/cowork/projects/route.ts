import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100);

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const projects = await prisma.coworkProject.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ projects });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { userId?: string; title?: string; description?: string; instructions?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.userId || !body.title) {
    return NextResponse.json({ error: "userId and title are required" }, { status: 400 });
  }

  try {
    const project = await prisma.coworkProject.create({
      data: {
        userId: body.userId,
        title: body.title,
        description: body.description ?? null,
        instructions: body.instructions ?? null,
      },
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
