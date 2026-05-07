import { NextResponse } from 'next/server';

// Cloud provider UI (CloudCostPanel) uses cloudApi client directly.
// This route is not wired to any UI.
export async function GET() {
  return NextResponse.json({ error: 'Use the cloudApi client.' }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: 'Use the cloudApi client.' }, { status: 410 });
}
