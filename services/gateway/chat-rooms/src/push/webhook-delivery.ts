/**
 * Webhook Delivery
 * 
 * Push notifications to bots via HTTP webhooks.
 * Pattern from Elphame.
 */

/**
 * Webhook delivery request
 */
export interface WebhookDeliveryRequest {
  /** Bot ID */
  botId: string;
  /** Webhook URL */
  webhookUrl: string;
  /** Payload */
  payload: WebhookPayload;
  /** Timeout in ms */
  timeout?: number;
}

/**
 * Webhook payload
 */
export interface WebhookPayload {
  /** User who triggered */
  user: {
    id: string;
    name: string;
  };
  /** Room context */
  room?: {
    id: string;
    name: string;
  };
  /** Message content */
  message: {
    id: string;
    content: string;
    mentions?: string[];
  };
  /** Timestamp */
  timestamp: string;
}

/**
 * Webhook delivery result
 */
export interface WebhookDeliveryResult {
  /** Success */
  success: boolean;
  /** HTTP status code */
  statusCode?: number;
  /** Response body */
  responseBody?: string;
  /** Error message */
  error?: string;
  /** Delivery time in ms */
  deliveryTime?: number;
}

/**
 * Deliver webhook to bot
 */
export async function deliverWebhook(
  request: WebhookDeliveryRequest
): Promise<WebhookDeliveryResult> {
  const startTime = Date.now();
  
  try {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch(request.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request.payload),
      timeout: request.timeout || 7000,
    });
    
    const responseBody = await response.text();
    const deliveryTime = Date.now() - startTime;
    
    return {
      success: response.ok,
      statusCode: response.status,
      responseBody,
      deliveryTime,
    };
  } catch (error) {
    const deliveryTime = Date.now() - startTime;
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      deliveryTime,
    };
  }
}

/**
 * Create webhook payload from message
 */
export function createWebhookPayload(
  userId: string,
  userName: string,
  roomId: string,
  roomName: string,
  messageId: string,
  content: string,
  mentions?: string[]
): WebhookPayload {
  return {
    user: {
      id: userId,
      name: userName,
    },
    room: {
      id: roomId,
      name: roomName,
    },
    message: {
      id: messageId,
      content,
      mentions,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Check if message mentions bot
 */
export function messageMentionsBot(content: string, botName: string): boolean {
  const mentionRegex = new RegExp(`\\B@(${botName})\\b`, 'i');
  return mentionRegex.test(content);
}

/**
 * Extract bot mentions from message
 */
export function extractBotMentions(content: string): string[] {
  const mentionRegex = /\B@([A-Za-z][A-Za-z0-9_-]*)/g;
  const matches = content.match(mentionRegex);
  
  if (!matches) {
    return [];
  }
  
  return matches.map(m => m.slice(1)); // Remove @ prefix
}
