/**
 * generate-openapi.ts — Scaffold for auto-generating OpenAPI spec from Rust route files.
 *
 * This script scans `cmd/allternit-api/src/*_routes.rs` for route handler annotations
 * and produces an OpenAPI 3.0 spec. In Phase 1, it generates a scaffold with the known
 * route groups and endpoint patterns. In Phase 2, this will be replaced by utoipa-based
 * server-side generation.
 *
 * Usage:
 *   npx tsx scripts/generate-openapi.ts
 *
 * Output:
 *   surfaces/docs/api/openapi.json
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const API_SRC = join(__dirname, '..', 'cmd', 'allternit-api', 'src');
const OUTPUT = join(__dirname, '..', 'surfaces', 'docs', 'api', 'openapi.json');

interface RouteEntry {
  method: string;
  path: string;
  handler: string;
  summary: string;
  tags: string[];
}

/**
 * Extract route registrations from a Rust route file.
 * Looks for patterns like:
 *   .route("/path", get(handler))
 *   .route("/path", post(handler))
 */
function extractRoutes(filePath: string, fileName: string): RouteEntry[] {
  const content = readFileSync(filePath, 'utf-8');
  const routes: RouteEntry[] = [];
  const tag = fileName.replace('_routes.rs', '').replace(/_/g, ' ');

  // Match .route("/path", method(handler)) patterns
  const routePattern = /\.route\(\s*"([^"]+)"\s*,\s*(get|post|put|patch|delete)\((\w+)\)/g;
  let match;

  while ((match = routePattern.exec(content)) !== null) {
    const [, path, method, handler] = match;
    routes.push({
      method: method.toUpperCase(),
      path: path.startsWith('/') ? path : `/${path}`,
      handler,
      summary: `${handler.replace(/_/g, ' ')}`,
      tags: [tag],
    });
  }

  // Also match Router::new().route() chains
  const chainPattern = /\.route\(\s*"([^"]+)"\s*,\s*(get|post|put|patch|delete)\(([^)]+)\)/g;
  while ((match = chainPattern.exec(content)) !== null) {
    const [, path, method, handler] = match;
    if (!routes.find(r => r.path === path && r.method === method.toUpperCase())) {
      routes.push({
        method: method.toUpperCase(),
        path: path.startsWith('/') ? path : `/${path}`,
        handler: handler.split('::').pop() || handler,
        summary: `${handler.split('::').pop()?.replace(/_/g, ' ') || handler}`,
        tags: [tag],
      });
    }
  }

  return routes;
}

function buildOpenAPISpec(routes: RouteEntry[]) {
  const paths: Record<string, Record<string, any>> = {};

  for (const route of routes) {
    if (!paths[route.path]) {
      paths[route.path] = {};
    }

    paths[route.path][route.method.toLowerCase()] = {
      summary: route.summary,
      tags: route.tags,
      operationId: route.handler,
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: { type: 'object' },
            },
          },
        },
        '400': { description: 'Bad request' },
        '401': { description: 'Unauthorized' },
        '429': { description: 'Rate limited' },
        '500': { description: 'Internal server error' },
      },
    };
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'Allternit API',
      description: 'The Allternit platform API for agents, sessions, memory, tools, and more.',
      version: '1.0.0',
      contact: {
        name: 'Allternit Support',
        email: 'support@allternit.com',
      },
    },
    servers: [
      {
        url: 'https://api.allternit.com',
        description: 'Production',
      },
      {
        url: 'http://127.0.0.1:8013',
        description: 'Local development',
      },
    ],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Allternit API key or Clerk JWT',
        },
        virtualKey: {
          type: 'apiKey',
          in: 'header',
          name: 'Authorization',
          description: 'Virtual LLM key (ak-... prefix)',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  };
}

function main() {
  console.log('Scanning route files in', API_SRC);

  const routeFiles = readdirSync(API_SRC)
    .filter(f => f.endsWith('_routes.rs'))
    .sort();

  console.log(`Found ${routeFiles.length} route files`);

  const allRoutes: RouteEntry[] = [];

  for (const file of routeFiles) {
    const filePath = join(API_SRC, file);
    const routes = extractRoutes(filePath, file);
    if (routes.length > 0) {
      console.log(`  ${file}: ${routes.length} routes`);
      allRoutes.push(...routes);
    }
  }

  console.log(`\nExtracted ${allRoutes.length} total route entries`);

  const spec = buildOpenAPISpec(allRoutes);

  writeFileSync(OUTPUT, JSON.stringify(spec, null, 2));
  console.log(`\nOpenAPI spec written to ${OUTPUT}`);
  console.log(`Paths: ${Object.keys(spec.paths).length}`);
}

main();
