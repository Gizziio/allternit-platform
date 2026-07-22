ALTER TABLE `goal` ADD COLUMN `completion_criterion` text;
--> statement-breakpoint
ALTER TABLE `goal` ADD COLUMN `budget` text NOT NULL DEFAULT '{"turnBudget":null,"tokenBudget":null,"wallClockBudgetMs":null}';
--> statement-breakpoint
ALTER TABLE `goal` ADD COLUMN `usage` text NOT NULL DEFAULT '{"turnsUsed":0,"tokensUsed":0,"wallClockMs":0,"lastStartedAt":null}';
--> statement-breakpoint
ALTER TABLE `goal` ADD COLUMN `blocked_audit` text NOT NULL DEFAULT '{"fingerprint":null,"consecutiveTurns":0}';
--> statement-breakpoint
ALTER TABLE `goal` ADD COLUMN `terminal_reason` text;
--> statement-breakpoint
ALTER TABLE `goal` ADD COLUMN `queue_position` integer;
--> statement-breakpoint
ALTER TABLE `goal` ADD COLUMN `revision` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `goal` ADD COLUMN `time_started` integer;
--> statement-breakpoint
ALTER TABLE `goal` ADD COLUMN `time_finished` integer;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `goal_state_queue_idx` ON `goal` (`state`, `queue_position`);
