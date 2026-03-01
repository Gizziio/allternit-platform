CREATE TABLE `A2UICapsule` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`version` text DEFAULT '1.0.0' NOT NULL,
	`author` text,
	`manifest` text NOT NULL,
	`contentAddress` text,
	`content` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`installedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`lastUsedAt` integer,
	`favorite` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `A2UISession` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`chatId` text NOT NULL,
	`messageId` text,
	`agentId` text,
	`payload` text NOT NULL,
	`dataModel` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`source` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chatId`) REFERENCES `Chat`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`messageId`) REFERENCES `Message`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Chat` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`title` text NOT NULL,
	`userId` text NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`isPinned` integer DEFAULT false NOT NULL,
	`projectId` text,
	`kernelSessionId` text,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `Document` (
	`id` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`kind` text DEFAULT 'text' NOT NULL,
	`userId` text NOT NULL,
	`messageId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`messageId`) REFERENCES `Message`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `KernelSession` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`chatId` text,
	`config` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chatId`) REFERENCES `Chat`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `McpConnector` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text,
	`name` text NOT NULL,
	`nameId` text NOT NULL,
	`url` text NOT NULL,
	`type` text DEFAULT 'http' NOT NULL,
	`oauthClientId` text,
	`oauthClientSecret` text,
	`enabled` integer DEFAULT true NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Message` (
	`id` text PRIMARY KEY NOT NULL,
	`chatId` text NOT NULL,
	`parentMessageId` text,
	`role` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`attachments` text DEFAULT '[]' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`annotations` text,
	`selectedModel` text DEFAULT '',
	`selectedTool` text DEFAULT '',
	`lastContext` text,
	`activeStreamId` text,
	`canceledAt` integer,
	`kernelRunId` text,
	FOREIGN KEY (`chatId`) REFERENCES `Chat`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Part` (
	`id` text PRIMARY KEY NOT NULL,
	`messageId` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`type` text NOT NULL,
	`text_text` text,
	`reasoning_text` text,
	`file_mediaType` text,
	`file_filename` text,
	`file_url` text,
	`tool_name` text,
	`tool_toolCallId` text,
	`tool_state` text,
	`tool_input` text,
	`tool_output` text,
	`tool_errorText` text,
	`data_type` text,
	`data_blob` text,
	`providerMetadata` text,
	FOREIGN KEY (`messageId`) REFERENCES `Message`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Project` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`icon` text DEFAULT 'folder' NOT NULL,
	`iconColor` text DEFAULT 'gray' NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `UserCredit` (
	`userId` text PRIMARY KEY NOT NULL,
	`credits` integer DEFAULT 50 NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Vote` (
	`chatId` text NOT NULL,
	`messageId` text NOT NULL,
	`isUpvoted` integer NOT NULL,
	PRIMARY KEY(`chatId`, `messageId`),
	FOREIGN KEY (`chatId`) REFERENCES `Chat`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`messageId`) REFERENCES `Message`(`id`) ON UPDATE no action ON DELETE cascade
);
