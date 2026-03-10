"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('hooks:resumable-stream');

export interface StreamChunk {
  id: string;
  streamId: string;
  index: number;
  content: string;
  timestamp: number;
}

export interface StreamState {
  streamId: string;
  chatId: string;
  messageId: string;
  status: 'active' | 'paused' | 'completed' | 'error';
  lastChunkIndex: number;
  createdAt: number;
  updatedAt: number;
  metadata?: {
    model?: string;
    prompt?: string;
    error?: string;
  };
}

interface ResumeStreamResult {
  state: StreamState;
  chunks: StreamChunk[];
}

interface UseResumableStreamOptions {
  chatId: string;
  onResume?: (result: ResumeStreamResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for managing resumable streams
 * Checks for active streams on mount and provides resume functionality
 */
export function useResumableStream(options: UseResumableStreamOptions) {
  const { chatId, onResume, onError } = options;
  const [isChecking, setIsChecking] = useState(true);
  const [hasActiveStream, setHasActiveStream] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const [recoveredChunks, setRecoveredChunks] = useState<StreamChunk[]>([]);
  const checkPerformed = useRef(false);

  /**
   * Check for active streams on mount
   */
  useEffect(() => {
    if (checkPerformed.current) return;
    checkPerformed.current = true;

    const checkForActiveStream = async () => {
      try {
        // Check sessionStorage first for immediate recovery
        const storedStreamId = sessionStorage.getItem(`a2r:active-stream:${chatId}`);
        
        if (storedStreamId) {
          log.debug({ chatId, streamId: storedStreamId }, 'Found active stream in sessionStorage');
          setActiveStreamId(storedStreamId);
          setHasActiveStream(true);
        }

        // Also check with server for any streams we might have missed
        const response = await fetch(`/api/chat/stream/resume?chatId=${chatId}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.state.status === 'active') {
            log.info({ 
              chatId, 
              streamId: data.streamId,
              chunks: data.chunks.length 
            }, 'Active stream found on server');
            
            setActiveStreamId(data.streamId);
            setHasActiveStream(true);
            setRecoveredChunks(data.chunks);
            
            // Store in sessionStorage for recovery across refreshes
            sessionStorage.setItem(`a2r:active-stream:${chatId}`, data.streamId);
          }
        }
      } catch (error) {
        log.error({ error, chatId }, 'Failed to check for active streams');
      } finally {
        setIsChecking(false);
      }
    };

    checkForActiveStream();
  }, [chatId]);

  /**
   * Resume a stream by ID
   */
  const resumeStream = useCallback(async (streamId: string) => {
    try {
      setIsChecking(true);
      
      const response = await fetch(`/api/chat/stream/resume?streamId=${streamId}`);
      
      if (!response.ok) {
        throw new Error('Failed to resume stream');
      }

      const data: { success: boolean } & ResumeStreamResult = await response.json();
      
      if (!data.success) {
        throw new Error('Stream not found');
      }

      log.info({ 
        streamId, 
        chunkCount: data.chunks.length 
      }, 'Stream resumed successfully');

      setRecoveredChunks(data.chunks);
      setHasActiveStream(false); // Mark as recovered
      
      // Clear from sessionStorage
      sessionStorage.removeItem(`a2r:active-stream:${chatId}`);
      
      onResume?.(data);
      return data;
    } catch (error) {
      log.error({ error, streamId }, 'Failed to resume stream');
      onError?.(error instanceof Error ? error : new Error('Failed to resume stream'));
      throw error;
    } finally {
      setIsChecking(false);
    }
  }, [chatId, onResume, onError]);

  /**
   * Dismiss the active stream notification without resuming
   */
  const dismissActiveStream = useCallback(() => {
    setHasActiveStream(false);
    if (activeStreamId) {
      sessionStorage.removeItem(`a2r:active-stream:${chatId}`);
    }
  }, [activeStreamId, chatId]);

  /**
   * Store active stream ID for potential recovery
   */
  const storeActiveStream = useCallback((streamId: string) => {
    sessionStorage.setItem(`a2r:active-stream:${chatId}`, streamId);
    setActiveStreamId(streamId);
    log.debug({ chatId, streamId }, 'Active stream stored');
  }, [chatId]);

  /**
   * Clear recovered chunks after they've been processed
   */
  const clearRecoveredChunks = useCallback(() => {
    setRecoveredChunks([]);
  }, []);

  return {
    isChecking,
    hasActiveStream,
    activeStreamId,
    recoveredChunks,
    resumeStream,
    dismissActiveStream,
    storeActiveStream,
    clearRecoveredChunks,
  };
}

/**
 * Generate a unique stream ID for new streams
 */
export function generateStreamId(): string {
  return `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
