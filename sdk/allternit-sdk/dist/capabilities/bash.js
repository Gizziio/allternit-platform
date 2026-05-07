export const BASH_TOOL = {
    name: 'bash',
    description: 'Execute shell commands inside the sandboxed environment.',
    input_schema: {
        type: 'object',
        properties: {
            command: { type: 'string', description: 'The shell command to execute' }
        },
        required: ['command']
    },
    metadata: {
        category: 'system',
        isDestructive: true
    }
};
export class BashCapability {
    environment;
    constructor(environment) {
        this.environment = environment;
    }
    getTool() {
        return {
            ...BASH_TOOL,
            execute: async (args) => {
                const result = await this.environment.execute('sh', ['-c', args.command]);
                return result.stdout + result.stderr;
            }
        };
    }
}
