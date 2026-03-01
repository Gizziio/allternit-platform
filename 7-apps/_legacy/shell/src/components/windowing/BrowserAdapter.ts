export const BROWSER_ACTION_IDS = {
  NAV_BACK: 'nav.back',
  NAV_FORWARD: 'nav.forward',
  NAV_RELOAD: 'nav.reload',
  NAV_GO: 'nav.go',
  MODE_TOGGLE: 'mode.toggle',
  VIEW_INSPECTOR: 'view.inspector',
  VIEW_AGENT_STEPS: 'view.agent_steps',
  DOCK_INSPECTOR: 'dock.inspector',
  DOCK_AGENT_STEPS: 'dock.agent_steps',
  TAB_ADD: 'tab.add',
  TAB_SWITCH: 'tab.switch',
  TAB_CLOSE: 'tab.close',
};

export class BrowserAdapter {
  renderChrome(state: any) {
    return {
      type: 'Container',
      props: {
        layout: 'row',
        padding: 'sm',
        gap: 'md',
        children: [
          // 1. Navigation & Tabs Row
          {
            type: 'Container',
            props: {
              layout: 'row',
              gap: 'sm',
              children: [
                // Navigation Buttons
                {
                  type: 'Button',
                  props: { label: '←', actionId: BROWSER_ACTION_IDS.NAV_BACK, variant: 'ghost' }
                },
                {
                  type: 'Button',
                  props: { label: '→', actionId: BROWSER_ACTION_IDS.NAV_FORWARD, variant: 'ghost' }
                },
                // Tab List
                {
                  type: 'Container',
                  props: {
                    layout: 'row',
                    gap: 'xs',
                    children: (state.tabs || []).map((tab: any) => ({
                      type: 'Button',
                      props: {
                        label: tab.title || 'New Tab',
                        actionId: BROWSER_ACTION_IDS.TAB_SWITCH,
                        variant: tab.id === state.tabId ? 'primary' : 'secondary',
                        // Store tabId in context for the action handler
                        id: tab.id 
                      }
                    }))
                  }
                },
                // Add Tab Button
                {
                  type: 'Button',
                  props: { label: '+', actionId: BROWSER_ACTION_IDS.TAB_ADD, variant: 'ghost' }
                }
              ]
            }
          },
          // 2. Omnibox (Pill)
          {
            type: 'Container',
            props: {
              layout: 'row',
              className: 'a2ui-grow',
              children: [
                {
                  type: 'TextField',
                  props: {
                    valuePath: 'url',
                    placeholder: 'Search or enter address...',
                    submitActionId: BROWSER_ACTION_IDS.NAV_GO,
                    className: 'a2ui-grow'
                  }
                }
              ]
            }
          },
          // 3. Right Side Controls
          {
            type: 'Container',
            props: {
              layout: 'row',
              gap: 'sm',
              children: [
                {
                  type: 'Button',
                  props: {
                    label: state.intent === 'agent' ? '🤖 Agent' : '👤 Human',
                    actionId: BROWSER_ACTION_IDS.MODE_TOGGLE,
                    variant: state.intent === 'agent' ? 'primary' : 'secondary'
                  }
                },
                {
                  type: 'Button',
                  props: { label: '🔍', actionId: BROWSER_ACTION_IDS.VIEW_INSPECTOR, variant: 'ghost' }
                },
                {
                  type: 'Button',
                  props: { label: '🤖', actionId: BROWSER_ACTION_IDS.VIEW_AGENT_STEPS, variant: 'ghost' }
                }
              ]
            }
          }
        ]
      }
    };
  }
}

export const browserAdapter = new BrowserAdapter();
