-- bb web entities migration
-- Adds bb-compatible columns to Project/Chat and a UserPreference table.

ALTER TABLE "Project" ADD COLUMN "mode" text DEFAULT 'chat' NOT NULL;
ALTER TABLE "Project" ADD COLUMN "bbProjectId" text;

ALTER TABLE "Chat" ADD COLUMN "bbProjectId" text;
ALTER TABLE "Chat" ADD COLUMN "bbThreadId" text;

CREATE TABLE "UserPreference" (
	"userId" text NOT NULL,
	"key" text NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"scope" text DEFAULT 'global' NOT NULL,
	"updatedAt" integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY("userId", "key", "scope"),
	FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade
);
