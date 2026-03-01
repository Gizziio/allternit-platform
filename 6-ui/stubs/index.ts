// 5-ui/stubs/platform.stub.ts
import type { ShellPlatform, View, ViewId, ViewType, ViewContext, Notification, ShellConfig, ShellState } from '../contracts/platform';

export class StubShellPlatform implements ShellPlatform {
  private config: ShellConfig = {
    theme: 'auto',
    language: 'en',
    compactMode: false,
    sidebarCollapsed: false
  };

  private views: Map<ViewId, View> = new Map();
  private notifications: Notification[] = [];

  async initialize(config: ShellConfig): Promise<void> {
    console.log('[STUB] Initializing shell platform with config:', config);
    this.config = { ...this.config, ...config };
  }

  async openView(viewType: ViewType, context?: ViewContext): Promise<ViewId> {
    console.log(`[STUB] Opening view: ${viewType}`, context);
    const viewId: ViewId = `view-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newView: View = {
      id: viewId,
      type: viewType,
      title: `${viewType} View`,
      component: () => ({ children: `[MOCK] ${viewType} View Content` }),
      props: context,
      closable: true,
      pinned: false
    };
    
    this.views.set(viewId, newView);
    return viewId;
  }

  async closeView(viewId: ViewId): Promise<boolean> {
    console.log(`[STUB] Closing view: ${viewId}`);
    return this.views.delete(viewId);
  }

  async updateView(viewId: ViewId, props: any): Promise<boolean> {
    console.log(`[STUB] Updating view: ${viewId} with props`, props);
    const view = this.views.get(viewId);
    if (view) {
      view.props = { ...view.props, ...props };
      return true;
    }
    return false;
  }

  showNotification(notification: Notification): void {
    console.log('[STUB] Showing notification:', notification.title);
    this.notifications.push(notification);
  }

  getShellState(): ShellState {
    return {
      config: this.config,
      activeView: 'home',
      openViews: Array.from(this.views.keys()),
      sidebarVisible: true,
      drawerOpen: false,
      notifications: this.notifications
    };
  }

  setShellConfig(config: ShellConfig): void {
    console.log('[STUB] Setting shell config:', config);
    this.config = { ...this.config, ...config };
  }
}

// 5-ui/stubs/components.stub.ts
export class StubUIComponents {
  static createButton(label: string, onClick?: () => void) {
    console.log(`[STUB] Creating button: ${label}`);
    return {
      type: 'button',
      label,
      onClick: onClick || (() => console.log(`[STUB] Button clicked: ${label}`))
    };
  }

  static createInput(placeholder: string, value?: string) {
    console.log(`[STUB] Creating input: ${placeholder}`);
    return {
      type: 'input',
      placeholder,
      value: value || ''
    };
  }

  static createModal(title: string, content: string) {
    console.log(`[STUB] Creating modal: ${title}`);
    return {
      type: 'modal',
      title,
      content,
      visible: false
    };
  }
}