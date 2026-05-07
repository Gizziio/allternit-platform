import { NextResponse } from 'next/server';

// Environment management UI uses the EnvironmentWizard component which
// calls environmentApi directly. This route is not wired to any UI.
export async function GET() {
  return NextResponse.json({ error: 'Use the EnvironmentWizard client API.' }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: 'Use the EnvironmentWizard client API.' }, { status: 410 });
}
