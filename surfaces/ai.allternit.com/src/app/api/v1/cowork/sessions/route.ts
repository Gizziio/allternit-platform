import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const { userId } = await getAuth();
  const projectId = searchParams.get("projectId");
  const status = searchParams.get("status");
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const where: any = { userId };
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    const sessions = await prisma.coworkSession.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ sessions });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { userId?: string; projectId?: string; title?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId } = await getAuth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const session = await prisma.coworkSession.create({
      data: {
        userId,
        projectId: body.projectId ?? null,
        title: body.title ?? "New Session",
        status: "idle",
        mode: (body.mode as any) ?? "agent",
        startedAt: new Date(),
      },
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
