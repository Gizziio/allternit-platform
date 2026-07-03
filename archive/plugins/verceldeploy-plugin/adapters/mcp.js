const { execute, manifest } = require('../dist/index');

function registerMcp(server) {
  const fn = manifest.provides.functions[0];

  server.addTool({
    name: fn.name,
    description: fn.description,
    parameters: fn.parameters,
    execute: async (params) => {
      const host = {
        platform: 'mcp',
        version: '1.0.0',
        llm: {},
        tools: {},
        ui: {},
        storage: {},
        session: {},
        config: {
          get: (key) => process.env[key]
        },
        logger: {
          debug: () => {},
          info: () => {},
          warn: console.warn,
          error: console.error
        }
      };

      const result = await execute(host, params);

      if (!result.success) {
        throw new Error(result.error?.message || 'Execution failed');
      }

      return result.data || result.content;
    }
  });
}

module.exports = { registerMcp };
