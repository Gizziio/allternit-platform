export interface Surface {
  id: string;
  type: 'browser' | 'terminal' | 'editor' | 'custom';
  title: string;
  isActive: boolean;
  data?: any;
}

export interface BrowserSurfaceState {
  url: string;
  tabs: { id: string; title: string; url: string }[];
  activeTabId: string;
  isVisible: boolean;
}
