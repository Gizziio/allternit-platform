/**
 * Plugins API
 * 
 * Lists all available plugins with their execution capabilities.
 */

import { NextResponse } from 'next/server';
import { getBundledPlugins, getDownloadablePlugins } from '@/lib/plugins/marketplace-integration';
import { getAllVendorCommands } from '@/lib/plugins/vendor-integration';

export async function GET(): Promise<NextResponse> {
  try {
    const bundled = getBundledPlugins();
    const downloadable = getDownloadablePlugins();
    const commands = getAllVendorCommands();
    
    // Group commands by plugin
    const commandsByPlugin = commands.reduce((acc, cmd) => {
      if (!acc[cmd.pluginId]) acc[cmd.pluginId] = [];
      acc[cmd.pluginId].push({
        name: cmd.name,
        trigger: cmd.trigger,
        description: cmd.description,
      });
      return acc;
    }, {} as Record<string, Array<{ name: string; trigger: string; description: string }>>);
    
    return NextResponse.json({
      bundled: bundled.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        source: p.bundledSource,
        version: p.version,
        commands: commandsByPlugin[p.id] || [],
        exportUrl: `/api/plugins/${p.id}/export`,
      })),
      downloadable: downloadable.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        repository: p.repository,
        version: p.version,
      })),
      stats: {
        totalBundled: bundled.length,
        totalDownloadable: downloadable.length,
        totalCommands: commands.length,
      },
    });
    
  } catch (error) {
    console.error('[Plugins API] Failed to list plugins:', error);
    return NextResponse.json(
      { error: 'Failed to list plugins' },
      { status: 500 }
    );
  }
}
