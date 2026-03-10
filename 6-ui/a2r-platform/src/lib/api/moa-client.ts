/**
 * MoA API Client
 * 
 * Frontend client for MoA Orchestrator backend.
 */

import { autopilot } from '../../services/autopilot';

const API_BASE = '/api/moa';

export interface MoAJob {
  id: string;
  status: 'queued' | 'running' | 'complete' | 'error' | 'cancelled';
  progress: number;
  task_count: number;
  completed_count: number;
  created_at: number;
  updated_at: number;
  result?: any;
}

export interface MoATask {
  id: string;
  status: 'pending' | 'running' | 'complete' | 'error' | 'skipped';
  progress?: number;
  type: string;
  title: string;
}

export interface MoAProgressEvent {
  job_id: string;
  progress: number;
  status: string;
  tasks: MoATaskStatus[];
}

export interface MoATaskStatus {
  id: string;
  status: string;
  progress?: number;
}

export class MoAClient {
  /**
   * Submit a new MoA job
   */
  static async submit(prompt: string): Promise<string> {
    const response = await fetch(`${API_BASE}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MoA submit failed: ${error}`);
    }

    const data = await response.json();
    return data.job_id;
  }

  /**
   * Get job status
   */
  static async getJob(jobId: string): Promise<MoAJob> {
    const response = await fetch(`${API_BASE}/job/${jobId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get job: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Cancel a job
   */
  static async cancel(jobId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/job/${jobId}/cancel`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to cancel job: ${response.statusText}`);
    }
  }

  /**
   * List all jobs
   */
  static async listJobs(): Promise<MoAJob[]> {
    const response = await fetch(`${API_BASE}/jobs`);
    
    if (!response.ok) {
      throw new Error(`Failed to list jobs: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Stream job progress via SSE
   */
  static streamProgress(
    jobId: string,
    onProgress: (event: MoAProgressEvent) => void
  ): () => void {
    const eventSource = new EventSource(`${API_BASE}/job/${jobId}/stream`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onProgress(data);
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    // Return cleanup function
    return () => {
      eventSource.close();
    };
  }

  /**
   * Submit as autopilot job (background execution)
   */
  static async submitAutopilot(
    prompt: string,
    onProgress?: (progress: number, message?: string) => void
  ): Promise<string> {
    // Submit to autopilot service
    const jobId = await autopilot.submit({
      type: 'generation',
      prompt,
      notifyOnComplete: true,
      metadata: {
        moa: true,
      },
    });

    // Listen for progress
    if (onProgress) {
      autopilot.on('job-progress', (event: { jobId: string; progress: number; message?: string }) => {
        if (event.jobId === jobId) {
          onProgress(event.progress, event.message);
        }
      });
    }

    return jobId;
  }
}

/**
 * Hook for using MoA in React components
 */
export function useMoA() {
  const submitJob = async (prompt: string) => {
    return await MoAClient.submit(prompt);
  };

  const getJobStatus = async (jobId: string) => {
    return await MoAClient.getJob(jobId);
  };

  const cancelJob = async (jobId: string) => {
    await MoAClient.cancel(jobId);
  };

  return {
    submitJob,
    getJobStatus,
    cancelJob,
  };
}
