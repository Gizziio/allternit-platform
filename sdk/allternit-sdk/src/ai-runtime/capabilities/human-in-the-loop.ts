import type { ToolDefinition, Question } from '../tools/types.js';

type ReplyEventEmitter = {
  emit(event: string, payload: unknown): boolean;
};

export class HITLCapability {
  constructor(private eventEmitter: ReplyEventEmitter) {}

  public getTool(): ToolDefinition {
    return {
      name: 'ask_user_question',
      description: 'Asks the user multiple choice questions or text questions to gather information, clarify ambiguity, or get decisions.',
      input_schema: {
        type: 'object',
        properties: {
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                question: { type: 'string' },
                type: { type: 'string', enum: ['choice', 'text', 'yesno'] },
                header: { type: 'string' },
                options: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      label: { type: 'string' },
                      description: { type: 'string' },
                      preview: { type: 'string' }
                    }
                  }
                },
                multiSelect: { type: 'boolean' },
                placeholder: { type: 'string' }
              },
              required: ['id', 'question', 'type', 'header']
            }
          }
        },
        required: ['questions']
      },
      execute: async (args: { questions: Question[] }, context: any) => {
        return new Promise((resolve) => {
          // Emit event for the UI/SDK user to handle
          this.eventEmitter.emit('reply_requested', {
            id: context.callId,
            type: 'question',
            payload: args.questions,
            submit: async (outcome: any) => {
              resolve(outcome.answers);
            }
          });
        });
      }
    };
  }
}
