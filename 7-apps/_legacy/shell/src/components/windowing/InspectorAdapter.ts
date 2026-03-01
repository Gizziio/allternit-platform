export class InspectorAdapter {
  render(state: any) {
    return {
      type: 'Container',
      props: {
        layout: 'column',
        gap: 'md',
        padding: 'md',
        children: [
          // Connection Card
          {
            type: 'Card',
            props: {
              title: 'Connection',
              children: [
                {
                  type: 'Container',
                  props: {
                    layout: 'row',
                    gap: 'sm',
                    children: [
                      {
                        type: 'Text',
                        props: { text: `Browser: ${state.connectedBrowserId ? state.connectedBrowserId.slice(0, 8) : 'Not connected'}`, style: 'subtle' }
                      },
                      {
                        type: 'Badge',
                        props: { 
                          text: state.intent === 'agent' ? '🤖 Agent' : '👤 Human',
                          tone: state.intent === 'agent' ? 'info' : 'neutral'
                        }
                      }
                    ]
                  }
                },
                {
                  type: 'Text',
                  props: { text: state.url, style: 'mono', truncate: true }
                }
              ]
            }
          },
          // Metrics
          {
            type: 'Card',
            props: {
              title: 'Performance',
              children: [
                {
                  type: 'Container',
                  props: {
                    layout: 'row',
                    gap: 'lg',
                    children: [
                      { type: 'Text', props: { text: `FPS: ${state.fps}` } },
                      { type: 'Text', props: { text: `Latency: ${state.latency}ms` } }
                    ]
                  }
                }
              ]
            }
          },
          // Agent Steps
          {
            type: 'Card',
            props: {
              title: 'Agent Activity',
              children: [
                {
                  type: 'List',
                  props: {
                    itemsPath: 'agentSteps',
                    itemTitlePath: 'description',
                    itemMetaPath: 'status',
                    emptyText: 'No agent activity yet'
                  }
                }
              ]
            }
          }
        ]
      }
    };
  }
}

export const inspectorAdapter = new InspectorAdapter();
