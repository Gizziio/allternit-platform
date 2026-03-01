/**
 * useCapsules Hook
 * 
 * React hook for managing interactive capsules in ShellUI
 * Provides CRUD operations and real-time event streaming
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  InteractiveCapsule,
  CapsuleEvent,
  ToolUISurface,
} from '@a2r/mcp-apps-adapter';
import { capsuleService, type CreateCapsuleInput, type PostEventInput } from '../services/capsuleService';

export interface UseCapsulesReturn {
  /** List of all capsules */
  capsules: InteractiveCapsule[];
  /** Currently selected capsule */
  selectedCapsule: InteractiveCapsule | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Event logs for selected capsule */
  eventLogs: CapsuleEvent[];
  
  // Actions
  /** Load all capsules */
  loadCapsules: () => Promise<void>;
  /** Create a new capsule */
  createCapsule: (input: CreateCapsuleInput) => Promise<string>;
  /** Delete a capsule */
  deleteCapsule: (capsuleId: string) => Promise<void>;
  /** Select a capsule */
  selectCapsule: (capsule: InteractiveCapsule | null) => void;
  /** Post event to selected capsule */
  postEvent: (input: PostEventInput) => Promise<void>;
  /** Clear error */
  clearError: () => void;
  /** Clear event logs */
  clearLogs: () => void;
}

export function useCapsules(): UseCapsulesReturn {
  const [capsules, setCapsules] = useState<InteractiveCapsule[]>([]);
  const [selectedCapsule, setSelectedCapsule] = useState<InteractiveCapsule | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventLogs, setEventLogs] = useState<CapsuleEvent[]>([]);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Load all capsules
  const loadCapsules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await capsuleService.listCapsules();
      setCapsules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load capsules');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create a new capsule
  const createCapsule = useCallback(async (input: CreateCapsuleInput): Promise<string> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await capsuleService.createCapsule(input);
      await loadCapsules(); // Refresh list
      return response.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create capsule');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loadCapsules]);

  // Delete a capsule
  const deleteCapsule = useCallback(async (capsuleId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await capsuleService.deleteCapsule(capsuleId);
      
      // If deleted capsule was selected, clear selection
      if (selectedCapsule?.id === capsuleId) {
        setSelectedCapsule(null);
        setEventLogs([]);
      }
      
      await loadCapsules(); // Refresh list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete capsule');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loadCapsules, selectedCapsule]);

  // Select a capsule and subscribe to its events
  const selectCapsule = useCallback((capsule: InteractiveCapsule | null) => {
    // Unsubscribe from previous capsule
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    setSelectedCapsule(capsule);
    setEventLogs([]);
    
    // Subscribe to new capsule's events
    if (capsule) {
      const unsubscribe = capsuleService.subscribeToEvents(capsule.id, (event) => {
        setEventLogs((prev: CapsuleEvent[]) => [...prev, event]);
      });
      unsubscribeRef.current = unsubscribe;
    }
  }, []);

  // Post event to selected capsule
  const postEvent = useCallback(async (input: PostEventInput) => {
    if (!selectedCapsule) {
      throw new Error('No capsule selected');
    }
    
    setError(null);
    
    try {
      await capsuleService.postEvent(selectedCapsule.id, input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post event');
      throw err;
    }
  }, [selectedCapsule]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Clear logs
  const clearLogs = useCallback(() => {
    setEventLogs([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // Auto-load capsules on mount
  useEffect(() => {
    loadCapsules();
  }, [loadCapsules]);

  return {
    capsules,
    selectedCapsule,
    isLoading,
    error,
    eventLogs,
    loadCapsules,
    createCapsule,
    deleteCapsule,
    selectCapsule,
    postEvent,
    clearError,
    clearLogs,
  };
}

export default useCapsules;
