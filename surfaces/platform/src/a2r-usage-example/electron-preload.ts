import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("a2rUsageBridge", {
  fetchTelemetrySnapshot: (sessionId: string) =>
    ipcRenderer.invoke("a2r-usage:telemetry:snapshot", sessionId),
  listProviders: () => ipcRenderer.invoke("a2r-usage:telemetry:providers"),
  onProbeEvent: (callback: (event: any) => void) => {
    const listener = (_event: any, payload: any) => callback(payload);
    ipcRenderer.on("a2r-usage:probe:event", listener);
    return () => ipcRenderer.removeListener("a2r-usage:probe:event", listener);
  },
});

// expose helper for renderer to notify the main process about focus/refresh
contextBridge.exposeInMainWorld("a2rUsageActions", {
  refreshTelemetry: () => ipcRenderer.send("a2r-usage:telemetry:refresh"),
});
