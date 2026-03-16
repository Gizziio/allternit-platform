declare global {
  interface Window {
    a2rUsageHost?: A2RUsageHost;
  }
}

interface A2RUsageHost {
  invoke?: (command: string, ...args: unknown[]) => Promise<unknown>;
  listen?: (event: string, handler: (payload: unknown) => void) => () => void;
  setWindowSize?: (width: number, height: number) => Promise<void>;
  getVersion?: () => Promise<string>;
  resolveResource?: (resourcePath: string) => Promise<string>;
  setTrayIcon?: (iconData: string) => Promise<void>;
  setTrayIconAsTemplate?: (value: boolean) => Promise<void>;
  currentMonitor?: () => Promise<{ size: { width: number; height: number } }>;
}

const host = window.a2rUsageHost ?? {} as A2RUsageHost;

export const invoke = async (command: string, ...args: unknown[]) => {
  if (host.invoke) {
    return host.invoke(command, ...args);
  }
  return null;
};

export const isTauri = () => false;

export const listen = async (event: string, handler: (payload: unknown) => void) => {
  if (!host.listen) {
    return () => {};
  }
  return host.listen(event, handler);
};

export function getCurrentWindow() {
  return {
    async setSize(size: PhysicalSize) {
      if (host.setWindowSize) {
        await host.setWindowSize(size.width, size.height);
      } else {
        window.resizeTo(size.width, size.height);
      }
    },
  };
}

export class PhysicalSize {
  constructor(public width: number, public height: number) {}
}

export async function currentMonitor() {
  if (host.currentMonitor) {
    return host.currentMonitor();
  }
  return { size: { width: window.screen?.availWidth || 0, height: window.screen?.availHeight || 0 } };
}

export const getVersion = async () => {
  if (host.getVersion) {
    return host.getVersion();
  }
  return "0.0.0";
};

export const resolveResource = async (resourcePath: string) => {
  if (host.resolveResource) {
    return host.resolveResource(resourcePath);
  }
  return resourcePath;
};

class TrayIconStub {
  constructor(public id: string) {}

  async setIcon(_img: unknown) {
    if (host.setTrayIcon && typeof _img === "string") {
      await host.setTrayIcon(_img);
    }
  }

  async setIconAsTemplate(_value: boolean = true) {
    if (host.setTrayIconAsTemplate) {
      await host.setTrayIconAsTemplate(_value);
    }
  }

  static async getById(id: string) {
    return new TrayIconStub(id);
  }
}

export const TrayIcon = TrayIconStub;
