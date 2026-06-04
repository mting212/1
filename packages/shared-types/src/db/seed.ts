import "dotenv/config";
import { db } from "./connection";
import { users } from "./schema/users";
import { scheduleLinks } from "./schema/schedule_links";
import { availabilityRules } from "./schema/availability_rules";
import { scheduleRules } from "./schema/schedule_rules";
import { bookings } from "./schema/bookings";

async function clean() {
  // Delete in reverse foreign-key order
  await db.delete(bookings);
  await db.delete(scheduleRules);
  await db.delete(availabilityRules);
  await db.delete(scheduleLinks);
  await db.delete(users);
}

async function seed() {
  const shouldClean = process.argv.includes("--clean");

  if (shouldClean) {
    console.log("Cleaning existing data...");
    await clean();
  }

  // Create test user
  const [testUser] = await db
    .insert(users)
    .values({
      email: "test@meetflow.dev",
      name: "Test User",
      timezone: "Asia/Shanghai",
    })
    .returning();

  if (!testUser) {
    throw new Error("Failed to create test user");
  }

  console.log(`Created test user: ${testUser.id}`);

  // Create scheduling link
  const [link] = await db
    .insert(scheduleLinks)
    .values({
      userId: testUser.id,
      slug: "test/30min",
      name: "30 Minute Meeting",
      durationMinutes: 30,
    })
    .returning();

  if (!link) {
    throw new Error("Failed to create schedule link");
  }

  console.log(`Created schedule link: ${link.slug}`);

  // Create weekday availability (Mon-Fri, 9:00-17:00)
  const weekdays = [1, 2, 3, 4, 5]; // Monday=1 through Friday=5
  for (const day of weekdays) {
    await db.insert(availabilityRules).values({
      userId: testUser.id,
      scheduleLinkId: link.id,
      dayOfWeek: day,
      startTime: "09:00",
      endTime: "17:00",
    });
  }

  console.log(
    `Created availability rules: ${weekdays.length} days (Mon-Fri 9:00-17:00)`
  );

  // Create default schedule rules (buffer and limits)
  const defaultRules = [
    { scheduleLinkId: link.id, ruleType: "buffer_before", ruleValue: 15 },
    { scheduleLinkId: link.id, ruleType: "buffer_after", ruleValue: 10 },
    { scheduleLinkId: link.id, ruleType: "daily_limit", ruleValue: 8 },
    { scheduleLinkId: link.id, ruleType: "weekly_limit", ruleValue: 30 },
    { scheduleLinkId: link.id, ruleType: "min_notice_hours", ruleValue: 2 },
    { scheduleLinkId: link.id, ruleType: "max_future_days", ruleValue: 14 },
  ];

  for (const rule of defaultRules) {
    await db.insert(scheduleRules).values(rule);
  }

  console.log(`Created ${defaultRules.length} schedule rules`);
  console.log("Seed complete!");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
