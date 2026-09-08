CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`remote_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`price` integer NOT NULL,
	`stock` integer NOT NULL,
	`barcode` text,
	`tax_rate` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `products_scope_idx` ON `products` (`scope`);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`offline_id` text NOT NULL,
	`payload` text NOT NULL,
	`status` text NOT NULL,
	`error_message` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sales_scope_status_idx` ON `sales` (`scope`,`status`);
--> statement-breakpoint
CREATE TABLE `billing_metadata` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`session` text NOT NULL,
	`updated` text
);
--> statement-breakpoint
CREATE INDEX `billing_metadata_scope_idx` ON `billing_metadata` (`scope`);
