"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { jobsApi, type CreateJobRequest, type JobRecord, type JobQueueStats } from '@/integration/api-client';

const API_BASE = '/api/v1';

export interface JobEvent {
  event_type: string;
  job_id: string;
  status?: string;
  progress?: number;
  message?: string;
  timestamp: string;
}

export function useJobs() {
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [stats, setStats] = useState<JobQueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await jobsApi.listJobs();
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();

    // Connect to job events WebSocket for real-time updates
    const wsUrl = `ws${window.location.protocol === 'https:' ? 's' : ''}://${window.location.host}/ws/jobs/events`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('Job events WebSocket connected');
    };

    wsRef.current.onmessage = (event) => {
      try {
        const jobEvent: JobEvent = JSON.parse(event.data);
        console.log('Job event received:', jobEvent);
        
        // Refresh jobs list on job events
        if (['job_started', 'job_completed', 'job_failed'].includes(jobEvent.event_type)) {
          fetchJobs();
        }
      } catch (err) {
        console.error('Failed to parse job event:', err);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('Job events WebSocket error:', error);
    };

    wsRef.current.onclose = () => {
      console.log('Job events WebSocket disconnected');
      // Attempt reconnect after 5 seconds
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.CLOSED) {
          wsRef.current = new WebSocket(wsUrl);
        }
      }, 5000);
    };

    // Poll every 5 seconds as fallback
    const interval = setInterval(fetchJobs, 5000);
    return () => {
      clearInterval(interval);
      wsRef.current?.close();
    };
  }, [fetchJobs]);

  const createJob = useCallback(async (job: CreateJobRequest) => {
    try {
      setError(null);
      const result = await jobsApi.createJob(job);
      // Refresh after creating
      await fetchJobs();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [fetchJobs]);

  const getJob = useCallback(async (jobId: string) => {
    try {
      setError(null);
      const data = await jobsApi.getJob(jobId);
      return data.job;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, []);

  const cancelJob = useCallback(async (jobId: string) => {
    try {
      setError(null);
      await jobsApi.cancelJob(jobId);
      // Refresh after canceling
      await fetchJobs();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchJobs]);

  const getStats = useCallback(async () => {
    try {
      setError(null);
      const data = await jobsApi.getStats();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, []);

  return {
    jobs,
    stats,
    loading,
    error,
    refresh: fetchJobs,
    createJob,
    getJob,
    cancelJob,
    getStats,
  };
}

export function useJob(jobId: string | null) {
  const [job, setJob] = useState<JobRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJob = useCallback(async () => {
    if (!jobId) {
      setJob(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await jobsApi.getJob(jobId);
      setJob(data.job);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();

    // Poll every 3 seconds for job status updates
    const interval = setInterval(fetchJob, 3000);
    return () => clearInterval(interval);
  }, [fetchJob]);

  const cancel = useCallback(async () => {
    if (!jobId) return false;

    try {
      setError(null);
      await jobsApi.cancelJob(jobId);
      await fetchJob();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [jobId, fetchJob]);

  return {
    job,
    loading,
    error,
    refresh: fetchJob,
    cancel,
  };
}
