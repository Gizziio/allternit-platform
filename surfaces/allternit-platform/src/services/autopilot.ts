/**
 * Autopilot Service
 * 
 * Background job execution with persistence and notifications.
 * Allows long-running tasks to continue after UI closes.
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export interface AutopilotJob {
  id: string;
  type: JobType;
  status: JobStatus;
  prompt: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  progress: number;
  result?: any;
  error?: string;
  metadata: Record<string, any>;
  notifyOnComplete: boolean;
}

export type JobType = 
  | 'research'
  | 'generation'
  | 'download'
  | 'analysis'
  | 'automation';

export type JobStatus = 
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface JobProgress {
  jobId: string;
  progress: number;
  status: JobStatus;
  message?: string;
  data?: any;
}

// ============================================================================
// Storage (IndexedDB wrapper)
// ============================================================================

const DB_NAME = 'allternit-autopilot';
const DB_VERSION = 1;
const STORE_NAME = 'jobs';

class JobStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async save(job: AutopilotJob): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(job);
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async get(jobId: string): Promise<AutopilotJob | undefined> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(jobId);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(): Promise<AutopilotJob[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(jobId: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(jobId);
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async updateStatus(jobId: string, status: JobStatus, progress?: number): Promise<void> {
    const job = await this.get(jobId);
    if (!job) throw new Error('Job not found');
    
    job.status = status;
    job.updatedAt = Date.now();
    if (progress !== undefined) job.progress = progress;
    
    await this.save(job);
  }
}

// ============================================================================
// Autopilot Service
// ============================================================================

export class AutopilotService extends EventEmitter {
  private storage = new JobStorage();
  private runningJobs = new Map<string, any>();
  private isInitialized = false;
  private workerPort: MessagePort | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    await this.storage.init();
    this.isInitialized = true;
    
    // Check for Service Worker support
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/autopilot-worker.js');
        if (registration.active) {
          // Use MessageChannel for service worker communication
          const channel = new MessageChannel();
          this.workerPort = channel.port1;
          registration.active.postMessage({ type: 'init' }, [channel.port2]);
        }
      } catch (error) {
        console.warn('Service Worker registration failed:', error);
      }
    }
    
    // Resume any running jobs
    await this.resumeJobs();
  }

  /**
   * Submit a new autopilot job
   */
  async submit(params: {
    type: JobType;
    prompt: string;
    notifyOnComplete?: boolean;
    metadata?: Record<string, any>;
  }): Promise<string> {
    const job: AutopilotJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: params.type,
      status: 'queued',
      prompt: params.prompt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      progress: 0,
      metadata: params.metadata || {},
      notifyOnComplete: params.notifyOnComplete ?? true,
    };
    
    await this.storage.save(job);
    
    // Start job execution
    this.executeJob(job);
    
    return job.id;
  }

  /**
   * Get job status
   */
  async getJob(jobId: string): Promise<AutopilotJob | undefined> {
    return await this.storage.get(jobId);
  }

  /**
   * Get all jobs
   */
  async getAllJobs(): Promise<AutopilotJob[]> {
    return await this.storage.getAll();
  }

  /**
   * Cancel a job
   */
  async cancel(jobId: string): Promise<void> {
    const job = await this.storage.get(jobId);
    if (!job) throw new Error('Job not found');
    
    if (job.status === 'running') {
      // Stop execution
      const controller = this.runningJobs.get(jobId);
      if (controller) {
        controller.abort();
        this.runningJobs.delete(jobId);
      }
    }
    
    await this.storage.updateStatus(jobId, 'cancelled');
    this.emit('job-cancelled', { jobId });
  }

  /**
   * Pause a job
   */
  async pause(jobId: string): Promise<void> {
    await this.storage.updateStatus(jobId, 'paused');
    this.emit('job-paused', { jobId });
  }

  /**
   * Resume a job
   */
  async resume(jobId: string): Promise<void> {
    const job = await this.storage.get(jobId);
    if (!job) throw new Error('Job not found');
    
    await this.storage.updateStatus(jobId, 'running');
    this.executeJob(job);
  }

  /**
   * Resume all pending jobs
   */
  private async resumeJobs(): Promise<void> {
    const jobs = await this.getAllJobs();
    const pendingJobs = jobs.filter(
      j => j.status === 'running' || j.status === 'queued'
    );
    
    for (const job of pendingJobs) {
      this.executeJob(job);
    }
  }

  /**
   * Execute a job
   */
  private async executeJob(job: AutopilotJob): Promise<void> {
    // Create abort controller for cancellation
    const controller = new AbortController();
    this.runningJobs.set(job.id, controller);
    
    await this.storage.updateStatus(job.id, 'running');
    this.emit('job-started', { jobId: job.id });
    
    try {
      // Execute based on job type
      switch (job.type) {
        case 'research':
          await this.executeResearch(job, controller.signal);
          break;
        case 'generation':
          await this.executeGeneration(job, controller.signal);
          break;
        case 'download':
          await this.executeDownload(job, controller.signal);
          break;
        case 'analysis':
          await this.executeAnalysis(job, controller.signal);
          break;
        case 'automation':
          await this.executeAutomation(job, controller.signal);
          break;
      }
      
      // Mark as completed
      await this.storage.updateStatus(job.id, 'completed', 100);
      job.completedAt = Date.now();
      await this.storage.save(job);
      
      this.emit('job-completed', { jobId: job.id, result: job.result });
      
      // Send notification
      if (job.notifyOnComplete && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('A2r Autopilot Complete', {
            body: `Job "${job.prompt.slice(0, 50)}..." completed`,
          });
        }
      }
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Job was cancelled
        return;
      }
      
      // Mark as failed
      await this.storage.updateStatus(job.id, 'failed');
      const storedJob = await this.storage.get(job.id);
      if (storedJob) {
        storedJob.error = error.message;
        await this.storage.save(storedJob);
      }
      
      this.emit('job-failed', { jobId: job.id, error: error.message });
    } finally {
      this.runningJobs.delete(job.id);
    }
  }

  /**
   * Execute research job
   */
  private async executeResearch(
    job: AutopilotJob,
    signal: AbortSignal
  ): Promise<void> {
    // Simulate research progress
    for (let i = 0; i <= 100; i += 10) {
      if (signal.aborted) return;
      
      await this.updateProgress(job.id, i, `Researching... ${i}%`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Store result
    const storedJob = await this.storage.get(job.id);
    if (storedJob) {
      storedJob.result = {
        findings: [],
        sources: [],
      };
      await this.storage.save(storedJob);
    }
  }

  /**
   * Execute generation job
   */
  private async executeGeneration(
    job: AutopilotJob,
    signal: AbortSignal
  ): Promise<void> {
    for (let i = 0; i <= 100; i += 5) {
      if (signal.aborted) return;
      
      await this.updateProgress(job.id, i, `Generating... ${i}%`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  /**
   * Execute download job
   */
  private async executeDownload(
    job: AutopilotJob,
    signal: AbortSignal
  ): Promise<void> {
    for (let i = 0; i <= 100; i += 10) {
      if (signal.aborted) return;
      
      await this.updateProgress(job.id, i, `Downloading... ${i}%`);
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }

  /**
   * Execute analysis job
   */
  private async executeAnalysis(
    job: AutopilotJob,
    signal: AbortSignal
  ): Promise<void> {
    for (let i = 0; i <= 100; i += 10) {
      if (signal.aborted) return;
      
      await this.updateProgress(job.id, i, `Analyzing... ${i}%`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Execute automation job
   */
  private async executeAutomation(
    job: AutopilotJob,
    signal: AbortSignal
  ): Promise<void> {
    for (let i = 0; i <= 100; i += 5) {
      if (signal.aborted) return;
      
      await this.updateProgress(job.id, i, `Automating... ${i}%`);
      await new Promise(resolve => setTimeout(resolve, 600));
    }
  }

  /**
   * Update job progress
   */
  private async updateProgress(
    jobId: string,
    progress: number,
    message?: string
  ): Promise<void> {
    const job = await this.storage.get(jobId);
    if (!job) return;
    
    job.progress = progress;
    job.updatedAt = Date.now();
    job.metadata.lastMessage = message;
    
    await this.storage.save(job);
    
    this.emit('job-progress', {
      jobId,
      progress,
      status: job.status,
      message,
    } as JobProgress);
  }

  /**
   * Request notification permission
   */
  static async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    
    if (Notification.permission === 'granted') return true;
    
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    
    return false;
  }
}

// ============================================================================
// Singleton instance
// ============================================================================

export const autopilot = new AutopilotService();
