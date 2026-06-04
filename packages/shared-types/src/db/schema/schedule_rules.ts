import { pgTable, uuid, varchar, integer } from "drizzle-orm/pg-core";
import { scheduleLinks } from "./schedule_links";

export const scheduleRules = pgTable("schedule_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  scheduleLinkId: uuid("schedule_link_id")
    .references(() => scheduleLinks.id)
    .notNull(),
  ruleType: varchar("rule_type", { length: 32 }).notNull(),
  ruleValue: integer("rule_value").notNull(),
});
