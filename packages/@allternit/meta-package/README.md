# Allternit SDK

Complete AI platform SDK for building intelligent applications.

## Installation

```bash
npm install @allternit/sdk
```

This installs the entire Allternit SDK including:
- Types and contracts
- Adapters and providers
- Workflow engine
- Form surfaces
- Visual state management
- Browser tools
- Plugin SDK
- API client

## Quick Start

```javascript
import { AllternitClient } from '@allternit/sdk';

const client = new AllternitClient({
  apiKey: 'your-api-key'
});

// List workspaces
const workspaces = await client.workspaces.list();

// Execute a plugin
const result = await client.execute('market-research', {
  topic: 'AI assistants'
});
```

## Individual Packages

You can also install individual packages:

```bash
# Just the API client
npm install @allternit/api-client

# Just the plugin SDK
npm install @allternit/plugin-sdk

# Just types
npm install @allternit/types
```

## CLI Tool

Install the CLI separately:

```bash
npm install -g @allternit/gizzi-code

# Then use it
gizzi
```

## Documentation

- [API Client](https://www.npmjs.com/package/@allternit/api-client)
- [Plugin SDK](https://www.npmjs.com/package/@allternit/plugin-sdk)
- [Workflow Engine](https://www.npmjs.com/package/@allternit/workflow-engine)

## License

MIT
