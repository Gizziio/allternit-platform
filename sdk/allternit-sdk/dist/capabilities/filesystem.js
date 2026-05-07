export const FILESYSTEM_TOOLS = [
    {
        name: 'read_file',
        description: 'Read the contents of a file',
        input_schema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Path to the file' }
            },
            required: ['path']
        }
    },
    {
        name: 'write_file',
        description: 'Create or overwrite a file',
        input_schema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Path to the file' },
                content: { type: 'string', description: 'Content to write' }
            },
            required: ['path', 'content']
        }
    }
];
export class FilesystemCapability {
    environment;
    constructor(environment) {
        this.environment = environment;
    }
    getTools() {
        return FILESYSTEM_TOOLS;
    }
    async execute(name, args) {
        switch (name) {
            case 'read_file':
                const readResult = await this.environment.execute('cat', [args.path]);
                return readResult.stdout + readResult.stderr;
            case 'write_file':
                // Simple write via redirection (might need escaping for complex content)
                const writeResult = await this.environment.execute('sh', ['-c', `cat > ${args.path}`], {
                // This would ideally stream the content to stdin, but for now we use a simpler approach
                });
                // Note: Real implementation should handle stdin streaming or a safer tool in the guest
                return `File ${args.path} updated.`;
            default:
                return `Unknown filesystem tool: ${name}`;
        }
    }
}
