import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { scheduleLinks } from "./schedule_links";

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  scheduleLinkId: uuid("schedule_link_id")
    .references(() => scheduleLinks.id)
    .notNull(),
  organizerId: uuid("organizer_id")
    .references(() => users.id)
    .notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  status: varchar("status", { length: 32 }).default("confirmed").notNull(),
  attendeeName: varchar("attendee_name", { length: 255 }).notNull(),
  attendeeEmail: varchar("attendee_email", { length: 255 }).notNull(),
  attendeeTimezone: varchar("attendee_timezone", { length: 64 }),
  notes: text("notes"),
  meetingUrl: text("meeting_url"),
  calendarEventId: varchar("calendar_event_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
