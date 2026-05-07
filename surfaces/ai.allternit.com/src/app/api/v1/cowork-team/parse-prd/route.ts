import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/server-auth';
import { parsePRDToTasks, PRIORITY_MAP } from '@/lib/ai/prd-parser';
import type { CreateBoardItemInput } from '@/stores/board.store';

interface ParsePRDBody {
  description: string;
  existingTitles?: string[];
  maxTasks?: number;
  modelId?: string;
}

function isValidBody(body: unknown): body is ParsePRDBody {
  const b = body as Record<string, unknown>;
  return typeof b.description === 'string' && b.description.trim().length >= 10;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await getAuth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as unknown;
    if (!isValidBody(body)) {
      return NextResponse.json({ error: 'description must be at least 10 characters' }, { status: 400 });
    }

    const parsed = await parsePRDToTasks({
      description: body.description.trim(),
      existingTitles: Array.isArray(body.existingTitles) ? body.existingTitles : undefined,
      maxTasks: typeof body.maxTasks === 'number' ? body.maxTasks : undefined,
      modelId: typeof body.modelId === 'string' ? body.modelId : undefined,
    });

    const items: Array<CreateBoardItemInput & { tempId: string; dependencyTempIds: string[] }> =
      parsed.tasks.map((task) => ({
        tempId: task.tempId,
        title: task.title,
        description: task.description,
        status: 'backlog' as const,
        priority: PRIORITY_MAP[task.priority],
        estimatedMinutes: task.estimatedMinutes,
        labels: task.labels,
        dependencies: [],
        dependencyTempIds: task.dependencies,
      }));

    return NextResponse.json({
      items,
      summary: parsed.summary,
      taskCount: items.length,
    });
  } catch (error) {
    console.error('[parse-prd]', error);
    return NextResponse.json({ error: 'Failed to parse PRD' }, { status: 500 });
  }
}
