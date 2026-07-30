import { queryLocalModelWithStreaming, isLocalProviderModel } from './src/cli/ui/ink-app/services/api/localModel.ts'

async function main() {
  console.log('isLocalProviderModel:', isLocalProviderModel('local-mlx/qwen3.6-35b-a3b-4bit'))
  const messages = [
    {
      type: 'user' as const,
      uuid: 'test-uuid',
      message: { role: 'user' as const, content: 'Say hello in one word.' },
      timestamp: new Date().toISOString(),
    },
  ]
  const systemPrompt = ['You are a helpful assistant.']
  const tools = []
  const abortController = new AbortController()
  const options = {
    model: 'local-mlx/qwen3.6-35b-a3b-4bit',
    isNonInteractiveSession: true,
    querySource: 'repl_main_thread' as const,
    getToolPermissionContext: async () => ({ mode: 'default' } as any),
    agents: [],
    hasAppendSystemPrompt: false,
    mcpTools: [],
  }
  for await (const event of queryLocalModelWithStreaming({
    messages,
    systemPrompt,
    tools,
    signal: abortController.signal,
    options,
  } as any)) {
    console.log('EVENT', JSON.stringify(event, null, 2).slice(0, 500))
  }
}

main().catch(console.error)
