import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const members = pgTable("members", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phoneNumber: text("phone_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
