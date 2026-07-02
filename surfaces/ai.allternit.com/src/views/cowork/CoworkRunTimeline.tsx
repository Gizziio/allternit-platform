import React from 'react';
import { CheckCircle, XCircle, PlayCircle, Clock } from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';

interface Job {
  id: string;
  job_type: string;
  state: string;
  updated_at: string;
}

interface CoworkRunTimelineProps {
  jobs: Job[];
}

export const CoworkRunTimeline: React.FC<CoworkRunTimelineProps> = ({ jobs }) => {
  const getStatusIcon = (state: Job['state']) => {
    switch (state) {
      case 'completed':
        return <CheckCircle size={18} style={{ color: 'var(--status-success)' }} weight="fill" />;
      case 'failed':
      case 'cancelled':
        return <XCircle size={18} style={{ color: 'var(--status-error)' }} weight="fill" />;
      case 'running':
        return <PlayCircle size={18} className="animate-spin-slow" style={{ color: 'var(--accent-cowork)' }} weight="fill" />;
      default:
        return <Clock size={18} style={{ color: 'var(--text-tertiary)' }} />;
    }
  };

  const getStatusBg = (state: Job['state']) => {
    switch (state) {
      case 'completed':
        return 'rgba(16, 185, 129, 0.1)';
      case 'failed':
      case 'cancelled':
        return 'rgba(239, 68, 68, 0.1)';
      case 'running':
        return 'rgba(167, 139, 250, 0.15)';
      default:
        return 'var(--bg-secondary)';
    }
  };

  return (
    <div className="flex flex-col gap-4 py-3">
      <h4 style={{ color: 'var(--text-tertiary)' }} className="text-xs font-semibold uppercase tracking-wider">
        Execution Timeline
      </h4>
      <div className="relative flex flex-col gap-6 pl-4 border-l border-[var(--border-subtle)]">
        {jobs.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)' }} className="text-xs italic">No steps logged for this run yet.</p>
        ) : (
          jobs.map((job, idx) => (
            <div key={job.id} className="relative flex items-start gap-3">
              {/* Timeline Connector Indicator */}
              <div
                className="absolute -left-[25px] top-1.5 flex items-center justify-center w-5 h-5 rounded-full"
                style={{ backgroundColor: 'var(--bg-primary)' }}
              >
                {getStatusIcon(job.state)}
              </div>

              {/* Step Card */}
              <GlassSurface
                style={{ backgroundColor: getStatusBg(job.state) }}
                className="flex-1 p-3 rounded-lg flex justify-between items-center"
              >
                <div>
                  <p style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold capitalize">
                    {job.job_type.replace('_', ' ')}
                  </p>
                  <p style={{ color: 'var(--text-secondary)' }} className="text-xs mt-0.5 font-mono">
                    ID: {job.id.slice(0, 8)}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {job.state}
                  </span>
                  <p style={{ color: 'var(--text-tertiary)' }} className="text-[10px] mt-1">
                    {new Date(job.updated_at).toLocaleTimeString()}
                  </p>
                </div>
              </GlassSurface>
            </div>
          ))
        )}
      </div>

      <style>{`
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default CoworkRunTimeline;
