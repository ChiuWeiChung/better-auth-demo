ALTER TABLE `session` DROP COLUMN `impersonatedBy`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `banned`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `banReason`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `banExpires`;