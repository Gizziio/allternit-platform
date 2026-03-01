export const AGENT_STEPS_ACTION_IDS = {
  CLEAR_STEPS: 'agent_steps.clear',
  EXPORT_STEPS: 'agent_steps.export',
};

export class AgentStepsAdapter {
  render(state: any) {
    // Reverse steps for timeline (newest at top)
    const reversedSteps = [...state.steps].reverse();

    return {
      type: 'Container',
      props: {
        layout: 'column',
        gap: 'md',
        padding: 'md',
        children: [
          // Summary Header
          {
            type: 'Container',
            props: {
              layout: 'row',
              gap: 'sm',
              children: [
                {
                  type: 'Text',
                  props: { text: `Total Steps: ${state.steps.length}`, style: 'subtle' }
                },
                {
                  type: 'Badge',
                  props: { 
                    text: state.steps.length > 0 ? 'Active' : 'Idle',
                    tone: state.steps.length > 0 ? 'info' : 'neutral'
                  }
                }
              ]
            }
          },
          // Steps List
          {
            type: 'Card',
            props: {
              title: 'Timeline',
              children: [
                {
                  type: 'List',
                  props: {
                    itemsPath: 'displaySteps', // We'll map this in the data model
                    itemTitlePath: 'description',
                    itemMetaPath: 'status',
                    emptyText: 'Waiting for agent activity...'
                  }
                }
              ]
            }
          },
          // Actions
          {
            type: 'Container',
            props: {
              layout: 'row',
              gap: 'sm',
              children: [
                {
                  type: 'Button',
                  props: { 
                    label: 'Clear', 
                    actionId: AGENT_STEPS_ACTION_IDS.CLEAR_STEPS, 
                    variant: 'secondary' 
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

export const agentStepsAdapter = new AgentStepsAdapter();
