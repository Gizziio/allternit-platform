import { useState, useEffect, useCallback } from 'react';

interface WindowControls {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: boolean;
  isFullScreen: boolean;
}

export function useWindowControls(): WindowControls {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const checkMaximized = async (): Promise<void> => {
      const maximized = await window.electronAPI?.isWindowMaximized?.();
      if (maximized !== undefined) {
        setIsMaximized(maximized);
      }
    };

    checkMaximized();

    const handleMaximize = (maximized: boolean): void => {
      setIsMaximized(maximized);
    };

    const handleFullScreen = (fullScreen: boolean): void => {
      setIsFullScreen(fullScreen);
    };

    window.electronAPI?.onWindowMaximize?.(handleMaximize);
    window.electronAPI?.onWindowFullScreen?.(handleFullScreen);

    return (): void => {
      window.electronAPI?.removeWindowMaximizeListener?.(handleMaximize);
      window.electronAPI?.removeWindowFullScreenListener?.(handleFullScreen);
    };
  }, []);

  const minimize = useCallback((): void => {
    window.electronAPI?.minimizeWindow?.();
  }, []);

  const maximize = useCallback((): void => {
    window.electronAPI?.maximizeWindow?.();
  }, []);

  const close = useCallback((): void => {
    window.electronAPI?.closeWindow?.();
  }, []);

  return {
    minimize,
    maximize,
    close,
    isMaximized,
    isFullScreen,
  };
}

export function useWindowFocus(): boolean {
  const [isFocused, setIsFocused] = useState(true);

  useEffect(() => {
    const handleFocus = (): void => setIsFocused(true);
    const handleBlur = (): void => setIsFocused(false);

    window.electronAPI?.onWindowFocus?.(handleFocus);
    window.electronAPI?.onWindowBlur?.(handleBlur);

    return (): void => {
      window.electronAPI?.removeWindowFocusListener?.(handleFocus);
      window.electronAPI?.removeWindowBlurListener?.(handleBlur);
    };
  }, []);

  return isFocused;
}

export function useWindowVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleShow = (): void => setIsVisible(true);
    const handleHide = (): void => setIsVisible(false);

    window.electronAPI?.onWindowShow?.(handleShow);
    window.electronAPI?.onWindowHide?.(handleHide);

    return (): void => {
      window.electronAPI?.removeWindowShowListener?.(handleShow);
      window.electronAPI?.removeWindowHideListener?.(handleHide);
    };
  }, []);

  return isVisible;
}

interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function useWindowBounds(): WindowBounds | null {
  const [bounds, setBounds] = useState<WindowBounds | null>(null);

  useEffect(() => {
    const handleResize = (newBounds: WindowBounds): void => {
      setBounds(newBounds);
    };

    const handleMove = (newBounds: WindowBounds): void => {
      setBounds(newBounds);
    };

    window.electronAPI?.onWindowResize?.(handleResize);
    window.electronAPI?.onWindowMove?.(handleMove);

    window.electronAPI?.getWindowBounds?.().then((initialBounds) => {
      if (initialBounds) {
        setBounds(initialBounds);
      }
    });

    return (): void => {
      window.electronAPI?.removeWindowResizeListener?.(handleResize);
      window.electronAPI?.removeWindowMoveListener?.(handleMove);
    };
  }, []);

  return bounds;
}

interface UnsavedChangesOptions {
  message?: string;
}

export function useUnsavedChanges(
  hasUnsavedChanges: boolean,
  options: UnsavedChangesOptions = {}
): void {
  useEffect(() => {
    window.electronAPI?.setUnsavedChanges?.(
      hasUnsavedChanges,
      options.message
    );

    return (): void => {
      if (!hasUnsavedChanges) {
        window.electronAPI?.setUnsavedChanges?.(false);
      }
    };
  }, [hasUnsavedChanges, options.message]);
}

export function useConfirmClose(): {
  confirmClose: (options?: {
    title?: string;
    message?: string;
    detail?: string;
  }) => Promise<boolean>;
} {
  const confirmClose = useCallback(
    async (options: {
      title?: string;
      message?: string;
      detail?: string;
    } = {}): Promise<boolean> => {
      const result = await window.electronAPI?.confirmClose?.(options);
      return result === 0;
    },
    []
  );

  return { confirmClose };
}

export function useMultiWindow(): {
  sendMessage: (
    targetWindowId: string,
    channel: string,
    payload: unknown
  ) => Promise<boolean>;
  broadcast: (channel: string, payload: unknown) => Promise<void>;
  getWindows: () => Promise<
    Array<{ id: string; title: string; isFocused: boolean; isVisible: boolean }>
  >;
  focusWindow: (windowId: string) => Promise<boolean>;
  closeWindow: (windowId: string) => Promise<boolean>;
} {
  const sendMessage = useCallback(
    async (
      targetWindowId: string,
      channel: string,
      payload: unknown
    ): Promise<boolean> => {
      return (
        (await window.electronAPI?.sendWindowMessage?.(
          targetWindowId,
          channel,
          payload
        )) ?? false
      );
    },
    []
  );

  const broadcast = useCallback(
    async (channel: string, payload: unknown): Promise<void> => {
      await window.electronAPI?.broadcastMessage?.(channel, payload);
    },
    []
  );

  const getWindows = useCallback(async () => {
    return (await window.electronAPI?.getWindows?.()) ?? [];
  }, []);

  const focusWindow = useCallback(async (windowId: string) => {
    return (await window.electronAPI?.focusWindow?.(windowId)) ?? false;
  }, []);

  const closeWindow = useCallback(async (windowId: string) => {
    return (await window.electronAPI?.closeWindowById?.(windowId)) ?? false;
  }, []);

  return {
    sendMessage,
    broadcast,
    getWindows,
    focusWindow,
    closeWindow,
  };
}

export function useWindowMessages(
  handler: (message: {
    sourceWindowId: string;
    targetWindowId: string;
    channel: string;
    payload: unknown;
    timestamp: number;
  }) => void
): void {
  useEffect(() => {
    window.electronAPI?.onWindowMessage?.(handler);

    return (): void => {
      window.electronAPI?.removeWindowMessageListener?.(handler);
    };
  }, [handler]);
}

export default useWindowControls;
