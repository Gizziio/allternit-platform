import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Environment management is not yet implemented' },
    { status: 501 }
  );
}

export async function PUT(request: NextRequest) {
  return NextResponse.json(
    { error: 'Environment management is not yet implemented' },
    { status: 501 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Environment management is not yet implemented' },
    { status: 501 }
  );
}
