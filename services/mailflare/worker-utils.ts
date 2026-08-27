import type { InboundQueueMessage } from "./src/lib/email/inbound";
import type { OutboundQueueMessage } from "./src/lib/email/send";
import type { WebhookDeliveryQueueMessage } from "./src/lib/email/webhooks";

export function isInboundQueueMessage(payload: unknown): payload is InboundQueueMessage {
	return (
		typeof payload === "object" &&
		payload !== null &&
		"rawR2Key" in payload &&
		"from" in payload &&
		"to" in payload
	);
}

export function isOutboundQueueMessage(payload: unknown): payload is OutboundQueueMessage {
	return (
		typeof payload === "object" &&
		payload !== null &&
		"jobId" in payload &&
		typeof (payload as { jobId: unknown }).jobId === "string"
	);
}

export function isWebhookDeliveryMessage(payload: unknown): payload is WebhookDeliveryQueueMessage {
	return (
		typeof payload === "object" &&
		payload !== null &&
		(payload as { type?: unknown }).type === "webhook_delivery" &&
		typeof (payload as { deliveryId?: unknown }).deliveryId === "string"
	);
}
