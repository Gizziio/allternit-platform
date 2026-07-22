CREATE TABLE `background_task` (
  `id` text PRIMARY KEY NOT NULL,
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
  FOREIGN KEY (`parent_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`child_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `background_task_parent_idx` ON `background_task` (`parent_session_id`,`status`);
--> statement-breakpoint
CREATE INDEX `background_task_child_idx` ON `background_task` (`child_session_id`);
