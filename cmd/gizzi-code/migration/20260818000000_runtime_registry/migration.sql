CREATE TABLE `runtime` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`host` text NOT NULL,
	`transport` text NOT NULL,
	`status` text DEFAULT 'offline' NOT NULL,
	`last_heartbeat_at` integer,
	`registered_at` integer NOT NULL,
	`workspace_id` text,
	`metadata` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `runtime_cli` (
	`id` text PRIMARY KEY NOT NULL,
	`runtime_id` text NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`version` text NOT NULL,
	`provider_id` text,
	`icon` text NOT NULL,
	`discovered_at` integer NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	FOREIGN KEY (`runtime_id`) REFERENCES `runtime`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `runtime_execution_log` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`runtime_id` text NOT NULL,
	`cli_name` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`events` text,
	`usage` text,
	`exit_code` integer,
	`error_message` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	FOREIGN KEY (`runtime_id`) REFERENCES `runtime`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `runtime_status_idx` ON `runtime` (`status`);--> statement-breakpoint
CREATE INDEX `runtime_host_idx` ON `runtime` (`host`);--> statement-breakpoint
CREATE INDEX `runtime_workspace_idx` ON `runtime` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `runtime_created_idx` ON `runtime` (`time_created`);--> statement-breakpoint
CREATE INDEX `runtime_cli_runtime_idx` ON `runtime_cli` (`runtime_id`);--> statement-breakpoint
CREATE INDEX `runtime_cli_name_idx` ON `runtime_cli` (`name`);--> statement-breakpoint
CREATE INDEX `runtime_execution_log_task_idx` ON `runtime_execution_log` (`task_id`);--> statement-breakpoint
CREATE INDEX `runtime_execution_log_runtime_idx` ON `runtime_execution_log` (`runtime_id`);--> statement-breakpoint
CREATE INDEX `runtime_execution_log_status_idx` ON `runtime_execution_log` (`status`);
