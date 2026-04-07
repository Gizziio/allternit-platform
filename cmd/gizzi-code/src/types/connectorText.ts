/**
 * Connector text types
 */

export interface ConnectorText {
  id: string
  content: string
  connector: string
}

export interface ConnectorTextBlock {
  type: 'connector_text'
  id: string
  content: string
  connector: string
  connector_text?: string
  signature?: string
}

export interface ConnectorTextDelta {
  type: 'connector_text_delta' | 'text_delta' | 'thinking_delta' | 'signature_delta' | 'input_json_delta'
  id?: string
  content?: string
  connector?: string
  text?: string
  thinking?: string
  signature?: string
  partial_json?: string
}

// Type guard for connector text blocks
export function isConnectorTextBlock(content: unknown): content is ConnectorTextBlock {
  return (
    typeof content === 'object' &&
    content !== null &&
    'type' in content &&
    (content as { type: string }).type === 'connector_text'
  )
}
