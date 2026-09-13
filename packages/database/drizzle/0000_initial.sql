CREATE TABLE `billing_metadata` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`session` text NOT NULL,
	`updated` text
);
--> statement-breakpoint
CREATE INDEX `billing_metadata_scope_idx` ON `billing_metadata` (`scope`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`remote_id` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customers_scope_idx` ON `customers` (`scope`);--> statement-breakpoint
CREATE TABLE `held_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`payload` text NOT NULL,
	`held_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `held_orders_scope_held_at_idx` ON `held_orders` (`scope`,`held_at`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`remote_id` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `orders_scope_idx` ON `orders` (`scope`);--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`remote_id` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `payment_methods_scope_idx` ON `payment_methods` (`scope`);--> statement-breakpoint
CREATE TABLE `print_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`payload` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `print_jobs_scope_status_idx` ON `print_jobs` (`scope`,`status`);--> statement-breakpoint
CREATE TABLE `printers` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`remote_id` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `printers_scope_idx` ON `printers` (`scope`);--> statement-breakpoint
CREATE TABLE `product_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`remote_id` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `product_batches_scope_product_idx` ON `product_batches` (`scope`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`remote_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`category_type` text,
	`price` integer NOT NULL,
	`stock` integer NOT NULL,
	`barcode` text,
	`sku` text,
	`image_url` text,
	`quick` integer DEFAULT false NOT NULL,
	`tax_rate` integer NOT NULL,
	`details` text
);
--> statement-breakpoint
CREATE INDEX `products_scope_idx` ON `products` (`scope`);--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`remote_id` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `refunds_scope_idx` ON `refunds` (`scope`);--> statement-breakpoint
CREATE TABLE `restaurant_tables` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`remote_id` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `restaurant_tables_scope_idx` ON `restaurant_tables` (`scope`);--> statement-breakpoint
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
CREATE INDEX `sales_scope_status_idx` ON `sales` (`scope`,`status`);--> statement-breakpoint
CREATE TABLE `scrap_purchase_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`remote_id` text NOT NULL,
	`payload` text NOT NULL,
	`status` text NOT NULL,
	`error_message` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `scrap_purchase_jobs_scope_status_idx` ON `scrap_purchase_jobs` (`scope`,`status`);--> statement-breakpoint
CREATE TABLE `service_users` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`remote_id` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `service_users_scope_idx` ON `service_users` (`scope`);--> statement-breakpoint
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
CREATE INDEX `sync_jobs_scope_updated_idx` ON `sync_jobs` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `tax_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`remote_id` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tax_rates_scope_idx` ON `tax_rates` (`scope`);--> statement-breakpoint
CREATE TABLE `waybill_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`sale_offline_id` text NOT NULL,
	`payload` text NOT NULL,
	`status` text NOT NULL,
	`error_message` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `waybill_jobs_scope_status_idx` ON `waybill_jobs` (`scope`,`status`);--> statement-breakpoint
CREATE TABLE `app_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `app_settings_scope_idx` ON `app_settings` (`scope`);--> statement-breakpoint
CREATE INDEX `app_settings_tenant_store_idx` ON `app_settings` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `app_settings_scope_updated_idx` ON `app_settings` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `brands` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `brands_scope_idx` ON `brands` (`scope`);--> statement-breakpoint
CREATE INDEX `brands_tenant_store_idx` ON `brands` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `brands_scope_updated_idx` ON `brands` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `cart_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`cart_id` text NOT NULL,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `cart_lines_scope_parent_idx` ON `cart_lines` (`scope`,`cart_id`);--> statement-breakpoint
CREATE INDEX `cart_lines_tenant_store_idx` ON `cart_lines` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE TABLE `carts` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `carts_scope_idx` ON `carts` (`scope`);--> statement-breakpoint
CREATE INDEX `carts_tenant_store_idx` ON `carts` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `carts_scope_updated_idx` ON `carts` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `cash_drawers` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `cash_drawers_scope_idx` ON `cash_drawers` (`scope`);--> statement-breakpoint
CREATE INDEX `cash_drawers_tenant_store_idx` ON `cash_drawers` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `cash_drawers_scope_updated_idx` ON `cash_drawers` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `cash_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `cash_transactions_scope_idx` ON `cash_transactions` (`scope`);--> statement-breakpoint
CREATE INDEX `cash_transactions_tenant_store_idx` ON `cash_transactions` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `cash_transactions_scope_updated_idx` ON `cash_transactions` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `categories_scope_idx` ON `categories` (`scope`);--> statement-breakpoint
CREATE INDEX `categories_tenant_store_idx` ON `categories` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `categories_scope_updated_idx` ON `categories` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `counters` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `counters_scope_idx` ON `counters` (`scope`);--> statement-breakpoint
CREATE INDEX `counters_tenant_store_idx` ON `counters` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `counters_scope_updated_idx` ON `counters` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `currency_denominations` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `currency_denominations_scope_idx` ON `currency_denominations` (`scope`);--> statement-breakpoint
CREATE INDEX `currency_denominations_tenant_store_idx` ON `currency_denominations` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `currency_denominations_scope_updated_idx` ON `currency_denominations` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `customer_addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`customer_id` text NOT NULL,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `customer_addresses_scope_parent_idx` ON `customer_addresses` (`scope`,`customer_id`);--> statement-breakpoint
CREATE INDEX `customer_addresses_tenant_store_idx` ON `customer_addresses` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE TABLE `customer_credit_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `customer_credit_summaries_scope_idx` ON `customer_credit_summaries` (`scope`);--> statement-breakpoint
CREATE INDEX `customer_credit_summaries_tenant_store_idx` ON `customer_credit_summaries` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `customer_credit_summaries_scope_updated_idx` ON `customer_credit_summaries` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `customer_loyalty_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `customer_loyalty_summaries_scope_idx` ON `customer_loyalty_summaries` (`scope`);--> statement-breakpoint
CREATE INDEX `customer_loyalty_summaries_tenant_store_idx` ON `customer_loyalty_summaries` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `customer_loyalty_summaries_scope_updated_idx` ON `customer_loyalty_summaries` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `devices_scope_idx` ON `devices` (`scope`);--> statement-breakpoint
CREATE INDEX `devices_tenant_store_idx` ON `devices` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `devices_scope_updated_idx` ON `devices` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `expense_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `expense_categories_scope_idx` ON `expense_categories` (`scope`);--> statement-breakpoint
CREATE INDEX `expense_categories_tenant_store_idx` ON `expense_categories` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `expense_categories_scope_updated_idx` ON `expense_categories` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `expenses_scope_idx` ON `expenses` (`scope`);--> statement-breakpoint
CREATE INDEX `expenses_tenant_store_idx` ON `expenses` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `expenses_scope_updated_idx` ON `expenses` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `feature_flags` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `feature_flags_scope_idx` ON `feature_flags` (`scope`);--> statement-breakpoint
CREATE INDEX `feature_flags_tenant_store_idx` ON `feature_flags` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `feature_flags_scope_updated_idx` ON `feature_flags` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `goods_receipt_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`goods_receipt_id` text NOT NULL,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `goods_receipt_lines_scope_parent_idx` ON `goods_receipt_lines` (`scope`,`goods_receipt_id`);--> statement-breakpoint
CREATE INDEX `goods_receipt_lines_tenant_store_idx` ON `goods_receipt_lines` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE TABLE `goods_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `goods_receipts_scope_idx` ON `goods_receipts` (`scope`);--> statement-breakpoint
CREATE INDEX `goods_receipts_tenant_store_idx` ON `goods_receipts` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `goods_receipts_scope_updated_idx` ON `goods_receipts` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `held_order_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`held_order_id` text NOT NULL,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `held_order_lines_scope_parent_idx` ON `held_order_lines` (`scope`,`held_order_id`);--> statement-breakpoint
CREATE INDEX `held_order_lines_tenant_store_idx` ON `held_order_lines` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE TABLE `modifier_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `modifier_groups_scope_idx` ON `modifier_groups` (`scope`);--> statement-breakpoint
CREATE INDEX `modifier_groups_tenant_store_idx` ON `modifier_groups` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `modifier_groups_scope_updated_idx` ON `modifier_groups` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `organizations_scope_idx` ON `organizations` (`scope`);--> statement-breakpoint
CREATE INDEX `organizations_tenant_store_idx` ON `organizations` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `organizations_scope_updated_idx` ON `organizations` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `payments_scope_idx` ON `payments` (`scope`);--> statement-breakpoint
CREATE INDEX `payments_tenant_store_idx` ON `payments` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `payments_scope_updated_idx` ON `payments` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `prescription_contexts` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `prescription_contexts_scope_idx` ON `prescription_contexts` (`scope`);--> statement-breakpoint
CREATE INDEX `prescription_contexts_tenant_store_idx` ON `prescription_contexts` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `prescription_contexts_scope_updated_idx` ON `prescription_contexts` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `price_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `price_lists_scope_idx` ON `price_lists` (`scope`);--> statement-breakpoint
CREATE INDEX `price_lists_tenant_store_idx` ON `price_lists` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `price_lists_scope_updated_idx` ON `price_lists` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `print_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `print_templates_scope_idx` ON `print_templates` (`scope`);--> statement-breakpoint
CREATE INDEX `print_templates_tenant_store_idx` ON `print_templates` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `print_templates_scope_updated_idx` ON `print_templates` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `product_barcodes` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`product_id` text NOT NULL,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `product_barcodes_scope_parent_idx` ON `product_barcodes` (`scope`,`product_id`);--> statement-breakpoint
CREATE INDEX `product_barcodes_tenant_store_idx` ON `product_barcodes` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE TABLE `product_modifiers` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`product_id` text NOT NULL,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `product_modifiers_scope_parent_idx` ON `product_modifiers` (`scope`,`product_id`);--> statement-breakpoint
CREATE INDEX `product_modifiers_tenant_store_idx` ON `product_modifiers` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE TABLE `product_prices` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`product_id` text NOT NULL,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `product_prices_scope_parent_idx` ON `product_prices` (`scope`,`product_id`);--> statement-breakpoint
CREATE INDEX `product_prices_tenant_store_idx` ON `product_prices` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE TABLE `product_uoms` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`product_id` text NOT NULL,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `product_uoms_scope_parent_idx` ON `product_uoms` (`scope`,`product_id`);--> statement-breakpoint
CREATE INDEX `product_uoms_tenant_store_idx` ON `product_uoms` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE TABLE `purchase_order_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`purchase_order_id` text NOT NULL,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `purchase_order_lines_scope_parent_idx` ON `purchase_order_lines` (`scope`,`purchase_order_id`);--> statement-breakpoint
CREATE INDEX `purchase_order_lines_tenant_store_idx` ON `purchase_order_lines` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `purchase_orders_scope_idx` ON `purchase_orders` (`scope`);--> statement-breakpoint
CREATE INDEX `purchase_orders_tenant_store_idx` ON `purchase_orders` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `purchase_orders_scope_updated_idx` ON `purchase_orders` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `refund_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`refund_id` text NOT NULL,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `refund_lines_scope_parent_idx` ON `refund_lines` (`scope`,`refund_id`);--> statement-breakpoint
CREATE INDEX `refund_lines_tenant_store_idx` ON `refund_lines` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `role_permissions_scope_idx` ON `role_permissions` (`scope`);--> statement-breakpoint
CREATE INDEX `role_permissions_tenant_store_idx` ON `role_permissions` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `role_permissions_scope_updated_idx` ON `role_permissions` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `sale_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`sale_id` text NOT NULL,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `sale_lines_scope_parent_idx` ON `sale_lines` (`scope`,`sale_id`);--> statement-breakpoint
CREATE INDEX `sale_lines_tenant_store_idx` ON `sale_lines` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE TABLE `schema_metadata` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `serialized_item_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `serialized_item_assignments_scope_idx` ON `serialized_item_assignments` (`scope`);--> statement-breakpoint
CREATE INDEX `serialized_item_assignments_tenant_store_idx` ON `serialized_item_assignments` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `serialized_item_assignments_scope_updated_idx` ON `serialized_item_assignments` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `shifts_scope_idx` ON `shifts` (`scope`);--> statement-breakpoint
CREATE INDEX `shifts_tenant_store_idx` ON `shifts` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `shifts_scope_updated_idx` ON `shifts` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `stock_balances` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `stock_balances_scope_idx` ON `stock_balances` (`scope`);--> statement-breakpoint
CREATE INDEX `stock_balances_tenant_store_idx` ON `stock_balances` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `stock_balances_scope_updated_idx` ON `stock_balances` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `stock_count_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`stock_count_id` text NOT NULL,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `stock_count_lines_scope_parent_idx` ON `stock_count_lines` (`scope`,`stock_count_id`);--> statement-breakpoint
CREATE INDEX `stock_count_lines_tenant_store_idx` ON `stock_count_lines` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE TABLE `stock_counts` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `stock_counts_scope_idx` ON `stock_counts` (`scope`);--> statement-breakpoint
CREATE INDEX `stock_counts_tenant_store_idx` ON `stock_counts` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `stock_counts_scope_updated_idx` ON `stock_counts` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `stock_locations` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `stock_locations_scope_idx` ON `stock_locations` (`scope`);--> statement-breakpoint
CREATE INDEX `stock_locations_tenant_store_idx` ON `stock_locations` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `stock_locations_scope_updated_idx` ON `stock_locations` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `stock_movements_scope_idx` ON `stock_movements` (`scope`);--> statement-breakpoint
CREATE INDEX `stock_movements_tenant_store_idx` ON `stock_movements` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `stock_movements_scope_updated_idx` ON `stock_movements` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `stores` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `stores_scope_idx` ON `stores` (`scope`);--> statement-breakpoint
CREATE INDEX `stores_tenant_store_idx` ON `stores` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `stores_scope_updated_idx` ON `stores` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `suppliers_scope_idx` ON `suppliers` (`scope`);--> statement-breakpoint
CREATE INDEX `suppliers_tenant_store_idx` ON `suppliers` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `suppliers_scope_updated_idx` ON `suppliers` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `sync_conflicts` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `sync_conflicts_scope_idx` ON `sync_conflicts` (`scope`);--> statement-breakpoint
CREATE INDEX `sync_conflicts_tenant_store_idx` ON `sync_conflicts` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `sync_conflicts_scope_updated_idx` ON `sync_conflicts` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `sync_dependencies` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`job_id` text NOT NULL,
	`depends_on_job_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sync_dependencies_job_idx` ON `sync_dependencies` (`scope`,`job_id`);--> statement-breakpoint
CREATE TABLE `sync_errors` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `sync_errors_scope_idx` ON `sync_errors` (`scope`);--> statement-breakpoint
CREATE INDEX `sync_errors_tenant_store_idx` ON `sync_errors` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `sync_errors_scope_updated_idx` ON `sync_errors` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `sync_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`offline_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`entity_type` text NOT NULL,
	`operation` text NOT NULL,
	`payload` text NOT NULL,
	`base_server_version` integer,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer,
	`lease_expires_at` integer,
	`error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sync_outbox_scope_status_idx` ON `sync_outbox` (`scope`,`status`);--> statement-breakpoint
CREATE INDEX `sync_outbox_scope_next_attempt_idx` ON `sync_outbox` (`scope`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `sync_outbox_idempotency_idx` ON `sync_outbox` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`collection` text NOT NULL,
	`cursor` text,
	`last_synced_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sync_state_scope_collection_idx` ON `sync_state` (`scope`,`collection`);--> statement-breakpoint
CREATE TABLE `tombstones` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `tombstones_scope_idx` ON `tombstones` (`scope`);--> statement-breakpoint
CREATE INDEX `tombstones_tenant_store_idx` ON `tombstones` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `tombstones_scope_updated_idx` ON `tombstones` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `transfer_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`transfer_id` text NOT NULL,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `transfer_lines_scope_parent_idx` ON `transfer_lines` (`scope`,`transfer_id`);--> statement-breakpoint
CREATE INDEX `transfer_lines_tenant_store_idx` ON `transfer_lines` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE TABLE `transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `transfers_scope_idx` ON `transfers` (`scope`);--> statement-breakpoint
CREATE INDEX `transfers_tenant_store_idx` ON `transfers` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `transfers_scope_updated_idx` ON `transfers` (`scope`,`updated_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text,
	`remote_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`server_version` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'API' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `users_scope_idx` ON `users` (`scope`);--> statement-breakpoint
CREATE INDEX `users_tenant_store_idx` ON `users` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `users_scope_updated_idx` ON `users` (`scope`,`updated_at`);