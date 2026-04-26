-- Brain Memory Tables
-- Triple-store memory: episodic (events), semantic (facts), procedural (skills)

CREATE TABLE `brain_memory_chunk` (
	`id`		TEXT PRIMARY KEY,
	`tenant_id`	TEXT NOT NULL,
	`chunk_type`	TEXT NOT NULL,
	`source`	TEXT,
	`content`	TEXT NOT NULL,
	`metadata_json`	TEXT,
	`importance`	INTEGER NOT NULL DEFAULT 5,
	`access_count`	INTEGER NOT NULL DEFAULT 0,
	`last_accessed_at` INTEGER,
	`time_created`	INTEGER NOT NULL,
	`time_updated`	INTEGER NOT NULL
);

CREATE INDEX `brain_chunk_tenant_idx` ON `brain_memory_chunk` (`tenant_id`);
CREATE INDEX `brain_chunk_type_idx` ON `brain_memory_chunk` (`chunk_type`);
CREATE INDEX `brain_chunk_importance_idx` ON `brain_memory_chunk` (`importance`);

CREATE TABLE `brain_memory_embedding` (
	`chunk_id`	TEXT NOT NULL,
	`provider`	TEXT NOT NULL,
	`model`		TEXT NOT NULL,
	`vector_json`	TEXT,
	`dimensions`	INTEGER NOT NULL,
	`time_created`	INTEGER NOT NULL,
	`time_updated`	INTEGER NOT NULL,
	PRIMARY KEY (`chunk_id`, `provider`, `model`),
	FOREIGN KEY (`chunk_id`) REFERENCES `brain_memory_chunk`(`id`) ON DELETE cascade
);

CREATE INDEX `brain_embed_chunk_idx` ON `brain_memory_embedding` (`chunk_id`);

CREATE TABLE `brain_memory_entity` (
	`id`		TEXT PRIMARY KEY,
	`tenant_id`	TEXT NOT NULL,
	`entity_type`	TEXT NOT NULL,
	`name`		TEXT NOT NULL,
	`description`	TEXT,
	`canonical_json`	TEXT,
	`first_seen_at`	INTEGER NOT NULL,
	`last_seen_at`	INTEGER NOT NULL,
	`mention_count`	INTEGER NOT NULL DEFAULT 1,
	`time_created`	INTEGER NOT NULL,
	`time_updated`	INTEGER NOT NULL
);

CREATE INDEX `brain_entity_tenant_idx` ON `brain_memory_entity` (`tenant_id`);
CREATE INDEX `brain_entity_type_idx` ON `brain_memory_entity` (`entity_type`);
CREATE INDEX `brain_entity_name_idx` ON `brain_memory_entity` (`name`);

CREATE TABLE `brain_memory_relation` (
	`id`		TEXT PRIMARY KEY,
	`tenant_id`	TEXT NOT NULL,
	`subject_id`	TEXT NOT NULL,
	`predicate`	TEXT NOT NULL,
	`object_id`	TEXT NOT NULL,
	`confidence`	INTEGER NOT NULL DEFAULT 7,
	`evidence_chunk_id` TEXT,
	`time_created`	INTEGER NOT NULL,
	`time_updated`	INTEGER NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `brain_memory_entity`(`id`) ON DELETE cascade,
	FOREIGN KEY (`object_id`) REFERENCES `brain_memory_entity`(`id`) ON DELETE cascade,
	FOREIGN KEY (`evidence_chunk_id`) REFERENCES `brain_memory_chunk`(`id`) ON DELETE set null
);

CREATE INDEX `brain_rel_tenant_idx` ON `brain_memory_relation` (`tenant_id`);
CREATE INDEX `brain_rel_subject_idx` ON `brain_memory_relation` (`subject_id`);
CREATE INDEX `brain_rel_object_idx` ON `brain_memory_relation` (`object_id`);
