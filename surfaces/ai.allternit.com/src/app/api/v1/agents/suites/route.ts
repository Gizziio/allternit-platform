import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');

  try {
    const suites = await prisma.testSuite.findMany({
      where: { userId, ...(agentId ? { agentId } : {}) },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(suites.map(s => ({
      id: s.id,
      agentId: s.agentId,
      name: s.name,
      description: s.description,
      caseCount: JSON.parse(s.cases || '[]').length,
      runCount: JSON.parse(s.runs || '[]').length,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch test suites' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const suite = await prisma.testSuite.create({
      data: {
        userId,
        agentId: body.agentId,
        name: body.name,
        description: body.description,
        cases: JSON.stringify(body.cases || []),
      },
    });

    return NextResponse.json({
      id: suite.id,
      name: suite.name,
      agentId: suite.agentId,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create test suite' }, { status: 500 });
  }
}
