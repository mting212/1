import { pgTable, uuid, smallint, time } from "drizzle-orm/pg-core";
import { users } from "./users";
import { scheduleLinks } from "./schedule_links";

export const availabilityRules = pgTable("availability_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  scheduleLinkId: uuid("schedule_link_id").references(
    () => scheduleLinks.id,
  ),
  dayOfWeek: smallint("day_of_week").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
});
