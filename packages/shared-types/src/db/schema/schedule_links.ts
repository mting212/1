import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const scheduleLinks = pgTable("schedule_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  durationMinutes: integer("duration_minutes").notNull().default(30),
  customDomain: varchar("custom_domain", { length: 255 }),
  branding: jsonb("branding").default({}),
  isActive: boolean("is_active").default(true),
  meetingProvider: varchar("meeting_provider", { length: 32 }).default("zoom"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
