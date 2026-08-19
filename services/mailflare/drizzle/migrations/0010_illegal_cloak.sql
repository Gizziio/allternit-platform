ALTER TABLE `api_keys` ADD `mailbox_ids` text;--> statement-breakpoint
ALTER TABLE `api_keys` ADD `revoked_at` integer;--> statement-breakpoint
ALTER TABLE `outbound_jobs` ADD `idempotency_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `outbound_jobs_user_idempotency_idx` ON `outbound_jobs` (`user_id`,`idempotency_key`) WHERE "outbound_jobs"."idempotency_key" IS NOT NULL;
