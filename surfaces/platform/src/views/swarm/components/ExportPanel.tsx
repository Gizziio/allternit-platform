/**
 * ExportPanel - Data export interface
 * 
 * Features:
 * - Export agents in CSV, JSON, Markdown
 * - Export metrics history
 * - Copy to clipboard
 * - Download files
 */

import React, { useState } from 'react';
import { X, FileCsv, FileCode, FileText, Clipboard } from '@phosphor-icons/react';
import { TEXT, BACKGROUND } from '@/design/a2r.tokens';
import { useAgents, useMetrics } from '../SwarmMonitor.store';
import { exportAndDownloadAgents, copyToClipboard, ExportFormat } from '../lib/export-utils';
import { metricsHistory } from '../lib/metrics-history';
import { toast } from '@/hooks/use-toast';

interface ExportPanelProps {
  modeColors: { accent: string };
  onClose: () => void;
}

export function ExportPanel({ modeColors, onClose }: ExportPanelProps) {
  const agents = useAgents();
  const metrics = useMetrics();
  const [activeTab, setActiveTab] = useState<'agents' | 'metrics'>('agents');
  const [isExporting, setIsExporting] = useState(false);

  const handleExportAgents = async (format: ExportFormat) => {
    setIsExporting(true);
    try {
      exportAndDownloadAgents(agents, format);
      toast({ title: 'Export Complete', description: `Agents exported as ${format.toUpperCase()}` });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportMetrics = async (format: 'csv' | 'json') => {
    setIsExporting(true);
    try {
      const data = metricsHistory.getHistory();
      if (data.length === 0) {
        toast({ title: 'No Data', description: 'No metrics history available', variant: 'destructive' });
        return;
      }
      
      if (format === 'csv') {
        const csv = metricsHistory.exportToCSV();
        await exportAndDownloadAgents(agents, 'csv'); // Reuse download
      } else {
        const json = metricsHistory.exportToJSON();
        await copyToClipboard(json);
        toast({ title: 'Copied', description: 'Metrics copied to clipboard' });
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopySnapshot = async () => {
    const snapshot = JSON.stringify({
      timestamp: new Date().toISOString(),
      agents,
      metrics,
    }, null, 2);
    
    const success = await copyToClipboard(snapshot);
    if (success) {
      toast({ title: 'Copied', description: 'Snapshot copied to clipboard' });
    }
  };

  return (
    <div 
      className="absolute top-14 right-4 w-72 rounded-xl border shadow-xl z-50"
      style={{ 
        background: BACKGROUND.primary,
        borderColor: 'rgba(255,255,255,0.1)',
      }}
    >
      {/* Header */}
      <div 
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <span className="text-sm font-medium" style={{ color: TEXT.primary }}>Export Data</span>
        <button 
          onClick={onClose}
          className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/5"
          style={{ color: TEXT.tertiary }}
        >
          <X size={12} weight="bold" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        {(['agents', 'metrics'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 text-xs font-medium capitalize transition-colors"
            style={{ 
              color: activeTab === tab ? modeColors.accent : TEXT.tertiary,
              borderBottom: activeTab === tab ? `2px solid ${modeColors.accent}` : '2px solid transparent',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'agents' ? (
          <div className="space-y-3">
            <p className="text-xs" style={{ color: TEXT.secondary }}>
              Export {agents.length} agents
            </p>
            
            <div className="grid grid-cols-3 gap-2">
              {(['csv', 'json', 'markdown'] as ExportFormat[]).map(format => (
                <button
                  key={format}
                  onClick={() => handleExportAgents(format)}
                  disabled={isExporting}
                  className="py-2 rounded-lg text-xs font-medium transition-all hover:bg-white/5 disabled:opacity-50"
                  style={{ background: 'rgba(255,255,255,0.03)', color: TEXT.secondary }}
                >
                  {format === 'csv' ? <FileCsv size={16} weight="duotone" style={{ margin: '0 auto 4px' }} /> : format === 'json' ? <FileCode size={16} weight="duotone" style={{ margin: '0 auto 4px' }} /> : <FileText size={16} weight="duotone" style={{ margin: '0 auto 4px' }} />}
                  {format.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              onClick={handleCopySnapshot}
              className="w-full py-2 rounded-lg text-xs font-medium transition-all hover:bg-white/5"
              style={{ background: 'rgba(255,255,255,0.03)', color: TEXT.secondary }}
            >
              <Clipboard size={12} weight="duotone" style={{ marginRight: 6 }} />
              Copy Snapshot
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs" style={{ color: TEXT.secondary }}>
              Metrics history ({metricsHistory.getHistory().length} data points)
            </p>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleExportMetrics('csv')}
                disabled={isExporting}
                className="py-2 rounded-lg text-xs font-medium transition-all hover:bg-white/5 disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.03)', color: TEXT.secondary }}
              >
                <FileCsv size={16} weight="duotone" style={{ margin: '0 auto 4px' }} />
                CSV
              </button>
              <button
                onClick={() => handleExportMetrics('json')}
                disabled={isExporting}
                className="py-2 rounded-lg text-xs font-medium transition-all hover:bg-white/5 disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.03)', color: TEXT.secondary }}
              >
                <FileCode size={16} weight="duotone" style={{ margin: '0 auto 4px' }} />
                JSON
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
