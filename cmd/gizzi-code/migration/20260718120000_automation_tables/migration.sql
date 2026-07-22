CREATE TABLE IF NOT EXISTS `routine` (
	`id` text PRIMARY KEY,
	`agent_id` text,
	`name` text NOT NULL,
	`steps` text NOT NULL,
	`trigger` text,
	`schedule` text,
	`state` text NOT NULL DEFAULT 'defined',
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `routine_agent_idx` ON `routine` (`agent_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `loop` (
	`id` text PRIMARY KEY,
	`agent_id` text,
	`command` text NOT NULL,
	`exit_condition` text,
	`max_iterations` integer NOT NULL DEFAULT 10,
	`iteration_log` text NOT NULL,
	`state` text NOT NULL DEFAULT 'running',
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `loop_agent_idx` ON `loop` (`agent_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `goal` (
	`id` text PRIMARY KEY,
	`agent_id` text,
	`objective` text NOT NULL,
	`milestones` text NOT NULL,
	`validations` text NOT NULL,
	`state` text NOT NULL DEFAULT 'planning',
	`progress` integer NOT NULL DEFAULT 0,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `goal_agent_idx` ON `goal` (`agent_id`);
