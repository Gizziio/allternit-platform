export class HITLCapability {
    eventEmitter;
    constructor(eventEmitter) {
        this.eventEmitter = eventEmitter;
    }
    getTool() {
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
            execute: async (args, context) => {
                return new Promise((resolve) => {
                    // Emit event for the UI/SDK user to handle
                    this.eventEmitter.emit('reply_requested', {
                        id: context.callId,
                        type: 'question',
                        payload: args.questions,
                        submit: async (outcome) => {
                            resolve(outcome.answers);
                        }
                    });
                });
            }
        };
    }
}
