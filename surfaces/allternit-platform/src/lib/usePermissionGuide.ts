'use client';

import { useState, useEffect, useCallback } from 'react';

export interface PermissionGuideState {
  accessibility: 'granted' | 'denied' | 'unknown' | 'not-applicable';
  screenRecording: 'granted' | 'denied' | 'unknown' | 'not-applicable';
  isLoading: boolean;
  isSupported: boolean;
  allGranted: boolean;
  anyDenied: boolean;
}

export function usePermissionGuide() {
  const [state, setState] = useState<PermissionGuideState>({
    accessibility: 'unknown',
    screenRecording: 'unknown',
    isLoading: false,
    isSupported: false,
    allGranted: false,
    anyDenied: false,
  });

  const api = typeof window !== 'undefined' ? window.allternit?.permissionGuide : undefined;
  const isDesktop = typeof navigator !== 'undefined' &&
    (navigator.platform.toLowerCase().includes('mac') ||
     navigator.platform.toLowerCase().includes('win') ||
     navigator.platform.toLowerCase().includes('linux'));
  const isSupported = isDesktop && !!api;

  const refresh = useCallback(async () => {
    if (!api) return;
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const status = await api.check();
      setState({
        ...status,
        isLoading: false,
        isSupported: true,
        allGranted: status.accessibility === 'granted' && status.screenRecording === 'granted',
        anyDenied: status.accessibility === 'denied' || status.screenRecording === 'denied',
      });
    } catch {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, [api]);

  const presentGuide = useCallback(
    async (panel: PermissionPanel) => {
      if (!api) return { success: false, error: 'Not supported' };
      return api.present(panel);
    },
    [api]
  );

  const readyForCheck = useCallback(async () => {
    if (!api) return;
    try {
      const status = await api.readyForCheck();
      setState({
        ...status,
        isLoading: false,
        isSupported: true,
        allGranted: status.accessibility === 'granted' && status.screenRecording === 'granted',
        anyDenied: status.accessibility === 'denied' || status.screenRecording === 'denied',
      });
    } catch {
      // ignore
    }
  }, [api]);

  useEffect(() => {
    if (!api) {
      setState((s) => ({ ...s, isSupported: false }));
      return;
    }
    setState((s) => ({ ...s, isSupported: true }));
    const unsub = api.onStatusChanged((status) => {
      setState({
        ...status,
        isLoading: false,
        isSupported: true,
        allGranted: status.accessibility === 'granted' && status.screenRecording === 'granted',
        anyDenied: status.accessibility === 'denied' || status.screenRecording === 'denied',
      });
    });
    // Initial check
    api.check().then((status) => {
      setState({
        ...status,
        isLoading: false,
        isSupported: true,
        allGranted: status.accessibility === 'granted' && status.screenRecording === 'granted',
        anyDenied: status.accessibility === 'denied' || status.screenRecording === 'denied',
      });
    }).catch(() => {});
    return unsub;
  }, [api]);

  return {
    ...state,
    refresh,
    presentGuide,
    readyForCheck,
  };
}
