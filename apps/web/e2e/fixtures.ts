/**
 * E2E test fixtures and helpers for MeetFlow
 */
import { test as base, expect } from "@playwright/test"

export const test = base
export { expect }

/** Log in via the credentials form */
export async function loginAsTestUser(page: import("@playwright/test").Page) {
  await page.goto("/login")
  // Form uses id, not name attribute
  await page.waitForSelector("#email", { timeout: 10000 })
  await page.fill("#email", "test@meetflow.dev")
  await page.fill("#password", "password123456") // min 8 chars
  await page.click('button[type="submit"]')
  // Wait for redirect to dashboard
  await page.waitForURL("**/app/dashboard", { timeout: 10000 })
}
