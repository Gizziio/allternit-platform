import { NextResponse } from 'next/server';

export async function GET() {
  // TODO: proxy to Composio API using COMPOSIO_API_KEY from process.env
  // For now return empty — Orbit wires this up when ready
  return NextResponse.json([]);
}
