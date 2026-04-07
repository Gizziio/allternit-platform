import { readFile, writeFile, readdir } from 'fs/promises'
import { resolve } from 'path'

const ROOT = resolve('src/cli/ui/ink-app')

// Types that SHOULD come from @modelcontextprotocol/sdk (actual MCP types)
const MCP_TYPES = [
  'Tool', 'Resource', 'Prompt', 'CallToolResult', 'ReadResourceResult',
  'ServerCapabilities', 'JSONRPCMessage', 'Transport', 'Client',
  'SSEClientTransport', 'StdioClientTransport', 'StreamableHTTPClientTransport',
  'UnauthorizedError', 'JSONRPCRequest', 'JSONRPCNotification', 'JSONRPCResponse',
  'JSONRPCError', 'RequestId', 'FetchLike', 'McpError', 'ErrorCode',
  'ListToolsResult', 'ListResourcesResult', 'ListPromptsResult',
  'CallToolRequest', 'ReadResourceRequest', 'GetPromptRequest',
  'OAuthTokens', 'OAuthMetadata', 'OAuthClientMetadata',
  'ElicitRequest', 'ElicitResult', 'ElicitRequestFormParams', 'ElicitRequestURLParams',
  'PrimitiveSchemaDefinition', 'ServerResource', 'MCPServerConnection',
  'ScopedMcpServerConfig', 'McpHTTPServerConfig', 'McpSSEServerConfig',
  'ServerInfo', 'AgentMcpServerInfo', 'ClaudeAIServerInfo', 'HTTPServerInfo',
  'SSEServerInfo', 'StdioServerInfo', 'MCPViewState'
]

// Local type files that define their own types
const LOCAL_TYPE_SOURCES: Record<string, string> = {
  'keybindings': 'keybindings/types',
  'bridge': 'bridge/types',
  'tasks': 'tasks/types',
  'tools/FileEditTool': 'tools/FileEditTool/types',
  'components/tools/FileEditTool': 'components/tools/FileEditTool/types',
  'ink/termio': 'ink/termio/types',
  'services/tips': 'services/tips/types',
  'buddy': 'buddy/types',
  'components/buddy': 'components/buddy/types',
}

async function* walkDir(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const path = resolve(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'vendor') {
      yield* walkDir(path)
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) && !entry.name.endsWith('.bak')) {
      yield path
    }
  }
}

async function fixFile(filePath: string) {
  let content = await readFile(filePath, 'utf-8')
  let modified = false
  
  // Find imports from @modelcontextprotocol/sdk/types
  const importRegex = /import\s+(?:(?:type\s+)?\{([^}]+)\}|\*\s+as\s+\w+)\s+from\s+'@modelcontextprotocol\/sdk\/types'/g
  
  let match
  while ((match = importRegex.exec(content)) !== null) {
    const importedTypes = match[1]
    if (!importedTypes) continue
    
    // Check if any of these are NOT MCP types
    const types = importedTypes.split(',').map(t => t.trim().split(' ')[0])
    const nonMcpTypes = types.filter(t => !MCP_TYPES.includes(t))
    
    if (nonMcpTypes.length > 0) {
      // This file is importing non-MCP types from MCP SDK - needs fixing
      const relativePath = filePath.replace(ROOT + '/', '')
      const fileDir = relativePath.substring(0, relativePath.lastIndexOf('/'))
      
      // Find the correct local source
      let localSource: string | null = null
      for (const [prefix, source] of Object.entries(LOCAL_TYPE_SOURCES)) {
        if (fileDir.startsWith(prefix)) {
          // Calculate relative path
          const levels = fileDir.split('/').length
          localSource = '../'.repeat(levels) + source
          break
        }
      }
      
      if (localSource) {
        // Replace the import
        const fullMatch = match[0]
        const newImport = fullMatch.replace('@modelcontextprotocol/sdk/types', localSource)
        content = content.replace(fullMatch, newImport)
        modified = true
        console.log(`  Fixed ${relativePath}: ${fullMatch} -> ${newImport}`)
      }
    }
  }
  
  if (modified) {
    await writeFile(filePath, content)
  }
}

async function main() {
  console.log('Reverting incorrect local imports...')
  for await (const file of walkDir(ROOT)) {
    await fixFile(file)
  }
  console.log('Done!')
}

main().catch(console.error)
