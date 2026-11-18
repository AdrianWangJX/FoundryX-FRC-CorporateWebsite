CREATE TABLE `inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`submitted_at` text NOT NULL,
	`inquiry_type` text NOT NULL,
	`contact_name` text NOT NULL,
	`contact_method` text NOT NULL,
	`details` text NOT NULL,
	`payload_hash` text NOT NULL,
	`consent_version` text NOT NULL,
	`notification_status` text DEFAULT 'not_configured' NOT NULL
);
