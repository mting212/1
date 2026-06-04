import { pgTable, uuid, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const calendarAccounts = pgTable("calendar_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  provider: varchar("provider", { length: 32 }).notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  calendarId: varchar("calendar_id", { length: 255 }),
  syncEnabled: boolean("sync_enabled").default(true),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
});
