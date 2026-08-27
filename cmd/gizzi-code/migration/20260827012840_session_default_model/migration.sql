CREATE TABLE `runtime_cli` (
	`id` text PRIMARY KEY,
	`runtime_id` text NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`version` text NOT NULL,
	`provider_id` text,
	`icon` text NOT NULL,
	`discovered_at` integer NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `fk_runtime_cli_runtime_id_runtime_id_fk` FOREIGN KEY (`runtime_id`) REFERENCES `runtime`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `runtime_execution_log` (
	`id` text PRIMARY KEY,
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
	CONSTRAINT `fk_runtime_execution_log_runtime_id_runtime_id_fk` FOREIGN KEY (`runtime_id`) REFERENCES `runtime`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `runtime` (
	`id` text PRIMARY KEY,
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
CREATE TABLE `background_task` (
	`id` text PRIMARY KEY,
	`parent_session_id` text NOT NULL,
	`child_session_id` text,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`description` text NOT NULL,
	`output` text,
	`error` text,
	`time_finished` integer,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `fk_background_task_parent_session_id_session_id_fk` FOREIGN KEY (`parent_session_id`) REFERENCES `session`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_background_task_child_session_id_session_id_fk` FOREIGN KEY (`child_session_id`) REFERENCES `session`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `goal` (
	`id` text PRIMARY KEY,
	`agent_id` text,
	`objective` text NOT NULL,
	`completion_criterion` text,
	`milestones` text NOT NULL,
	`validations` text NOT NULL,
	`budget` text NOT NULL,
	`usage` text NOT NULL,
	`blocked_audit` text NOT NULL,
	`terminal_reason` text,
	`queue_position` integer,
	`revision` integer DEFAULT 1 NOT NULL,
	`state` text DEFAULT 'planning' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`time_started` integer,
	`time_finished` integer,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loop` (
	`id` text PRIMARY KEY,
	`agent_id` text,
	`command` text NOT NULL,
	`exit_condition` text,
	`max_iterations` integer DEFAULT 10 NOT NULL,
	`iteration_log` text NOT NULL,
	`state` text DEFAULT 'running' NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `routine` (
	`id` text PRIMARY KEY,
	`agent_id` text,
	`name` text NOT NULL,
	`steps` text NOT NULL,
	`trigger` text,
	`schedule` text,
	`state` text DEFAULT 'defined' NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session_trace` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT,
	`session_id` text NOT NULL,
	`kind` text NOT NULL,
	`message_id` text,
	`part_id` text,
	`data` text NOT NULL,
	`time_created` integer NOT NULL,
	CONSTRAINT `fk_session_trace_session_id_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `session` ADD `permission_mode` text;--> statement-breakpoint
ALTER TABLE `session` ADD `surface` text;--> statement-breakpoint
ALTER TABLE `session` ADD `harness` text;--> statement-breakpoint
ALTER TABLE `session` ADD `pinned` integer;--> statement-breakpoint
ALTER TABLE `session` ADD `default_model` text;--> statement-breakpoint
CREATE INDEX `runtime_cli_runtime_idx` ON `runtime_cli` (`runtime_id`);--> statement-breakpoint
CREATE INDEX `runtime_cli_name_idx` ON `runtime_cli` (`name`);--> statement-breakpoint
CREATE INDEX `runtime_execution_log_task_idx` ON `runtime_execution_log` (`task_id`);--> statement-breakpoint
CREATE INDEX `runtime_execution_log_runtime_idx` ON `runtime_execution_log` (`runtime_id`);--> statement-breakpoint
CREATE INDEX `runtime_execution_log_status_idx` ON `runtime_execution_log` (`status`);--> statement-breakpoint
CREATE INDEX `runtime_status_idx` ON `runtime` (`status`);--> statement-breakpoint
CREATE INDEX `runtime_host_idx` ON `runtime` (`host`);--> statement-breakpoint
CREATE INDEX `runtime_workspace_idx` ON `runtime` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `runtime_created_idx` ON `runtime` (`time_created`);--> statement-breakpoint
CREATE INDEX `background_task_parent_idx` ON `background_task` (`parent_session_id`,`status`);--> statement-breakpoint
CREATE INDEX `background_task_child_idx` ON `background_task` (`child_session_id`);--> statement-breakpoint
CREATE INDEX `goal_agent_idx` ON `goal` (`agent_id`);--> statement-breakpoint
CREATE INDEX `goal_state_queue_idx` ON `goal` (`state`,`queue_position`);--> statement-breakpoint
CREATE INDEX `loop_agent_idx` ON `loop` (`agent_id`);--> statement-breakpoint
CREATE INDEX `routine_agent_idx` ON `routine` (`agent_id`);--> statement-breakpoint
CREATE INDEX `session_surface_idx` ON `session` (`surface`);--> statement-breakpoint
CREATE INDEX `session_pinned_idx` ON `session` (`pinned`);--> statement-breakpoint
CREATE INDEX `session_trace_cursor_idx` ON `session_trace` (`session_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `session_trace_message_idx` ON `session_trace` (`message_id`);