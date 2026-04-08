/**
 * Plugin Export API
 * 
 * Exports any plugin to portable format for use outside the platform.
 * This makes plugins usable by any agent with LLM access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { exportToPortableFormat } from '@/lib/plugins/deterministic-executor';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const pluginId = params.id;
  
  try {
    const portable = await exportToPortableFormat(pluginId);
    
    if (!portable) {
      return NextResponse.json(
        { error: 'Plugin not found' },
        { status: 404 }
      );
    }
    
    // Set headers for download
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('Content-Disposition', `attachment; filename="${pluginId}-plugin.json"`);
    
    return NextResponse.json(portable, { headers });
    
  } catch (error) {
    console.error(`[Plugin Export] Failed to export ${pluginId}:`, error);
    return NextResponse.json(
      { error: 'Failed to export plugin' },
      { status: 500 }
    );
  }
}
