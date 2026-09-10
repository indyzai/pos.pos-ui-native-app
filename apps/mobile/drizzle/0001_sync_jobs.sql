CREATE TABLE `sync_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`operation` text NOT NULL,
	`entity_id` text,
	`status` text NOT NULL,
	`error_message` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sync_jobs_scope_updated_idx` ON `sync_jobs` (`scope`,`updated_at`);
