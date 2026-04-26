-- Cowork Runtime tables
CREATE TABLE `cowork_run` (
	`id`		TEXT PRIMARY KEY,
	`name`		TEXT NOT NULL,
	`description`	TEXT,
	`mode`		TEXT NOT NULL,
	`status`	TEXT NOT NULL,
	`step_cursor`	TEXT,
	`total_steps`	INTEGER,
	`completed_steps`	INTEGER NOT NULL DEFAULT 0,
	`config`	TEXT,
	`started_at`	INTEGER,
	`completed_at`	INTEGER,
	`error_message`	TEXT,
	`time_created`	INTEGER NOT NULL,
	`time_updated`	INTEGER NOT NULL
);
CREATE INDEX `cowork_run_status_idx` ON `cowork_run` (`status`);
CREATE INDEX `cowork_run_mode_idx` ON `cowork_run` (`mode`);
CREATE INDEX `cowork_run_created_idx` ON `cowork_run` (`time_created`);

CREATE TABLE `cowork_run_event` (
	`id`		TEXT PRIMARY KEY,
	`run_id`	TEXT NOT NULL,
	`sequence`	INTEGER NOT NULL,
	`event_type`	TEXT NOT NULL,
	`payload`	TEXT,
	`time_created`	INTEGER NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `cowork_run`(`id`) ON DELETE cascade
);
CREATE INDEX `cowork_event_run_idx` ON `cowork_run_event` (`run_id`);
CREATE INDEX `cowork_event_sequence_idx` ON `cowork_run_event` (`sequence`);

CREATE TABLE `cowork_schedule` (
	`id`		TEXT PRIMARY KEY,
	`name`		TEXT NOT NULL,
	`enabled`	INTEGER NOT NULL DEFAULT 1,
	`cron_expr`	TEXT NOT NULL,
	`natural_lang`	TEXT,
	`next_run_at`	INTEGER,
	`run_count`	INTEGER NOT NULL DEFAULT 0,
	`mode`		TEXT NOT NULL DEFAULT 'local',
	`job_template`	TEXT,
	`time_created`	INTEGER NOT NULL,
	`time_updated`	INTEGER NOT NULL
);
CREATE INDEX `cowork_schedule_enabled_idx` ON `cowork_schedule` (`enabled`);
CREATE INDEX `cowork_schedule_next_run_idx` ON `cowork_schedule` (`next_run_at`);

CREATE TABLE `cowork_approval` (
	`id`		TEXT PRIMARY KEY,
	`run_id`	TEXT NOT NULL,
	`step_cursor`	TEXT,
	`status`	TEXT NOT NULL DEFAULT 'pending',
	`priority`	TEXT NOT NULL DEFAULT 'medium',
	`title`		TEXT NOT NULL,
	`description`	TEXT,
	`action_type`	TEXT,
	`action_params`	TEXT,
	`reasoning`	TEXT,
	`requested_by`	TEXT,
	`responded_by`	TEXT,
	`response_message`	TEXT,
	`time_responded`	INTEGER,
	`time_created`	INTEGER NOT NULL,
	`time_updated`	INTEGER NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `cowork_run`(`id`) ON DELETE cascade
);
CREATE INDEX `cowork_approval_run_idx` ON `cowork_approval` (`run_id`);
CREATE INDEX `cowork_approval_status_idx` ON `cowork_approval` (`status`);

CREATE TABLE `cowork_checkpoint` (
	`id`		TEXT PRIMARY KEY,
	`run_id`	TEXT NOT NULL,
	`name`		TEXT,
	`description`	TEXT,
	`step_cursor`	TEXT NOT NULL,
	`workspace_state`	TEXT,
	`approval_state`	TEXT,
	`context`	TEXT,
	`resumable`	INTEGER NOT NULL DEFAULT 1,
	`time_restored`	INTEGER,
	`time_created`	INTEGER NOT NULL,
	`time_updated`	INTEGER NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `cowork_run`(`id`) ON DELETE cascade
);
CREATE INDEX `cowork_checkpoint_run_idx` ON `cowork_checkpoint` (`run_id`);
