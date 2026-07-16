import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * `id`/FK columns are `text`, not native Postgres `uuid` - PowerSync requires every
 * synced table's primary key to be `text`-typed, see "Why client-generated UUID ids" in
 * docs/data-model.md.
 */
export const hosts = pgTable("hosts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  email: text("email").notNull(),
  timeZone: text("time_zone").notNull(),
  currency: text("currency").notNull(),
  businessType: text("business_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
