# @allternit/verceldeploy-plugin

Deploy projects to Vercel instantly via the Allternit plugin runtime.

## Features

- Deploy any local project directory to Vercel
- Supports production and preview deployments
- Falls back to helpful CLI instructions when `vercel` is not installed globally
- Works with `VERCEL_TOKEN` from host config or environment variables

## Installation

```bash
npm install @allternit/verceldeploy-plugin
```

## Configuration

Set your Vercel token before running:

```bash
export VERCEL_TOKEN="your_vercel_token_here"
```

Or configure it in your Allternit host settings.

## Usage

### Allternit Plugin Runtime

```json
{
  "path": "/path/to/your/project",
  "projectName": "my-app",
  "prod": false
}
```

### CLI Adapter

```bash
node ./adapters/cli.js --path ./my-project --prod
```

### HTTP Adapter

```bash
curl -X POST http://localhost:3000/deploy \
  -H "Content-Type: application/json" \
  -d '{"path":"./my-project","prod":true}'
```

## Parameters

| Parameter     | Type    | Required | Default | Description                          |
|---------------|---------|----------|---------|--------------------------------------|
| `path`        | string  | Yes      | —       | Absolute or relative path to project |
| `projectName` | string  | No       | —       | Optional Vercel project name         |
| `prod`        | boolean | No       | `false` | Deploy to production                 |

## License

MIT
