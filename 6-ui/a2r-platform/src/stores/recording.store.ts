/**
 * Browser Recording Store
 * 
 * Manages recording state for agent-controlled browser sessions
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface RecordingState {
  // Recording status
  isRecording: boolean;
  recordingId: string | null;
  sessionId: string | null;
  
  // Recording stats
  duration: number; // seconds
  framesCaptured: number;
  format: string;
  
  // Actions
  startRecording: (sessionId?: string, format?: string, fps?: number) => Promise<void>;
  stopRecording: () => Promise<{ filePath?: string; duration?: number; frames?: number }>;
  getRecordingStatus: () => Promise<void>;
  resetRecording: () => void;
}

export const useRecordingStore = create<RecordingState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    isRecording: false,
    recordingId: null,
    sessionId: null,
    duration: 0,
    framesCaptured: 0,
    format: 'gif',

    startRecording: async (sessionId?: string, format: string = 'gif', fps: number = 10) => {
      try {
        const response = await fetch('/api/v1/tools/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tool_name: 'browser.start_recording',
            parameters: {
              session_id: sessionId,
              format,
              fps,
              quality: 80,
            },
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to start recording');
        }

        const result = await response.json();
        
        if (result.success && result.output?.recording_id) {
          set({
            isRecording: true,
            recordingId: result.output.recording_id,
            sessionId: sessionId || null,
            format,
            duration: 0,
            framesCaptured: 0,
          });

          // Start duration timer
          const timer = setInterval(() => {
            const currentDuration = get().duration;
            set({ duration: currentDuration + 1 });
          }, 1000);

          // Store timer ID for cleanup
          (get() as any)._durationTimer = timer;
        }
      } catch (error) {
        console.error('Failed to start recording:', error);
        throw error;
      }
    },

    stopRecording: async () => {
      const recordingId = get().recordingId;
      
      if (!recordingId) {
        throw new Error('No active recording');
      }

      try {
        // Clear duration timer
        const timer = (get() as any)._durationTimer;
        if (timer) {
          clearInterval(timer);
        }

        const response = await fetch('/api/v1/tools/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tool_name: 'browser.stop_recording',
            parameters: {
              recording_id: recordingId,
              save: true,
            },
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to stop recording');
        }

        const result = await response.json();
        
        const output = result.output || {};
        
        set({
          isRecording: false,
          recordingId: null,
          sessionId: null,
          duration: output.duration_secs || get().duration,
          framesCaptured: output.frames_captured || get().framesCaptured,
        });

        return {
          filePath: output.file_path,
          duration: output.duration_secs,
          frames: output.frames_captured,
        };
      } catch (error) {
        console.error('Failed to stop recording:', error);
        throw error;
      }
    },

    getRecordingStatus: async () => {
      const recordingId = get().recordingId;
      
      if (!recordingId) {
        return;
      }

      try {
        const response = await fetch('/api/v1/tools/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tool_name: 'browser.recording_status',
            parameters: {
              recording_id: recordingId,
            },
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get recording status');
        }

        const result = await response.json();
        
        if (result.success && result.output) {
          set({
            isRecording: result.output.is_recording,
            framesCaptured: result.output.frames_captured || 0,
            duration: result.output.duration_secs || 0,
          });
        }
      } catch (error) {
        console.error('Failed to get recording status:', error);
      }
    },

    resetRecording: () => {
      // Clear any running timer
      const timer = (get() as any)._durationTimer;
      if (timer) {
        clearInterval(timer);
      }

      set({
        isRecording: false,
        recordingId: null,
        sessionId: null,
        duration: 0,
        framesCaptured: 0,
        format: 'gif',
      });
    },
  }))
);

export default useRecordingStore;
