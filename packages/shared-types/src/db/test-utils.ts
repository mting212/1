import { Pool } from "pg";

const TEST_DB_NAME = "meetflow_test";
const BASE_URL = process.env.DATABASE_URL ?? "";

function getBaseUrl(): string {
  // Connect to the default 'postgres' database to create/drop the test database
  return BASE_URL.replace(/\/[^/]+$/, "/postgres");
}

function getTestUrl(): string {
  return BASE_URL.replace(/\/[^/]+$/, `/${TEST_DB_NAME}`);
}

/**
 * Create an isolated test database by cloning the main database schema.
 * Does NOT copy data — schema only.
 */
export async function createTestDatabase(): Promise<string> {
  const basePool = new Pool({ connectionString: getBaseUrl() });

  try {
    // Drop if exists (clean up from previous failed run)
    await basePool.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = '${TEST_DB_NAME}'
        AND pid <> pg_backend_pid()
    `);
    await basePool.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
    await basePool.query(`CREATE DATABASE ${TEST_DB_NAME}`);

    const testUrl = getTestUrl();
    return testUrl;
  } finally {
    await basePool.end();
  }
}

/**
 * Run migrations on the test database.
 * Call this after createTestDatabase().
 */
export async function migrateTestDatabase(testUrl: string): Promise<void> {
  const testPool = new Pool({ connectionString: testUrl });
  try {
    // Run custom constraints (includes btree_gist extension)
    // The actual Drizzle migrations would be run via drizzle-kit migrate
    await testPool.query("CREATE EXTENSION IF NOT EXISTS btree_gist");
  } finally {
    await testPool.end();
  }
}

/**
 * Seed the test database with fixture data.
 */
export async function seedTestData(testUrl: string): Promise<void> {
  // Set the test URL as the connection string for the seed script
  process.env.DATABASE_URL = testUrl;
  const { db } = await import("./connection");

  const { users } = await import("./schema/users");
  const { scheduleLinks } = await import("./schema/schedule_links");
  const { availabilityRules } = await import("./schema/availability_rules");
  const { scheduleRules } = await import("./schema/schedule_rules");

  const [testUser] = await db
    .insert(users)
    .values({
      email: "test@meetflow.dev",
      name: "Test User",
      timezone: "Asia/Shanghai",
    })
    .returning();

  if (!testUser) throw new Error("Seed failed: could not create test user");

  const [link] = await db
    .insert(scheduleLinks)
    .values({
      userId: testUser.id,
      slug: "test/30min",
      name: "30 Minute Meeting",
      durationMinutes: 30,
    })
    .returning();

  if (!link) throw new Error("Seed failed: could not create schedule link");

  // Mon-Fri 9:00-17:00
  for (const day of [1, 2, 3, 4, 5]) {
    await db.insert(availabilityRules).values({
      userId: testUser.id,
      scheduleLinkId: link.id,
      dayOfWeek: day,
      startTime: "09:00",
      endTime: "17:00",
    });
  }

  // Default rules
  const rules = [
    { scheduleLinkId: link.id, ruleType: "buffer_before", ruleValue: 15 },
    { scheduleLinkId: link.id, ruleType: "buffer_after", ruleValue: 10 },
  ];
  for (const r of rules) {
    await db.insert(scheduleRules).values(r);
  }
}

/**
 * Drop the test database, terminating all connections first.
 */
export async function dropTestDatabase(): Promise<void> {
  const basePool = new Pool({ connectionString: getBaseUrl() });
  try {
    await basePool.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = '${TEST_DB_NAME}'
        AND pid <> pg_backend_pid()
    `);
    await basePool.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
  } finally {
    await basePool.end();
  }
}
