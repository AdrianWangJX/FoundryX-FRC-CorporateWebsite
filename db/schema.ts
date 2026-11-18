import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const inquiries = sqliteTable('inquiries', {
  id: text('id').primaryKey(),
  submittedAt: text('submitted_at').notNull(),
  inquiryType: text('inquiry_type').notNull(),
  contactName: text('contact_name').notNull(),
  contactMethod: text('contact_method').notNull(),
  details: text('details').notNull(),
  payloadHash: text('payload_hash').notNull(),
  consentVersion: text('consent_version').notNull(),
  notificationStatus: text('notification_status').notNull().default('not_configured'),
  notificationError: text('notification_error'),
});
