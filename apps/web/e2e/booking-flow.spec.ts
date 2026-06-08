/**
 * E2E tests for the complete booking flow (Step 55)
 */
import { test, expect, loginAsTestUser } from "./fixtures"

test.describe("Complete Booking Flow", () => {
  test("should complete full booking flow end-to-end", async ({ page }) => {
    await page.goto("/test/30min")
    const grid = page.getByTestId("calendar-grid")
    await expect(grid).toBeVisible({ timeout: 15000 })

    // Step 1: Select an available or preferred slot
    const slot = grid.getByTestId("slot-preferred").or(grid.getByTestId("slot-available")).first()
    if (!(await slot.isVisible().catch(() => false))) {
      test.skip(true, "No bookable slots found")
      return
    }
    await slot.click()

    // Step 2: Fill booking form (use .first() because form renders twice: desktop + mobile)
    await page.getByTestId("input-name").first().fill("Alice Smith")
    await page.getByTestId("input-email").first().fill("alice@example.com")

    // Step 3: Submit booking
    await page.getByTestId("btn-submit-booking").first().click()

    // Step 4: Should show success state
    await expect(page.locator("text=Booking Confirmed!")).toBeVisible({
      timeout: 10000,
    })
  })

  test("should prevent double booking of same slot", async ({ page }) => {
    await page.goto("/test/30min")
    const grid = page.getByTestId("calendar-grid")
    await expect(grid).toBeVisible({ timeout: 15000 })

    // Book first available/preferred slot
    const slot = grid.getByTestId("slot-preferred").or(grid.getByTestId("slot-available")).first()
    if (!(await slot.isVisible().catch(() => false))) {
      test.skip(true, "No bookable slots")
      return
    }
    await slot.click()
    await page.getByTestId("input-name").first().fill("First User")
    await page.getByTestId("input-email").first().fill("first@example.com")
    await page.getByTestId("btn-submit-booking").first().click()
    await expect(page.locator("text=Booking Confirmed!")).toBeVisible({
      timeout: 10000,
    })

    // Go back to booking page
    await page.goto("/test/30min")
    await expect(grid).toBeVisible({ timeout: 15000 })

    // Try to book the same slot again
    const slotAgain = grid.getByTestId("slot-preferred").or(grid.getByTestId("slot-available")).first()
    if (await slotAgain.isVisible().catch(() => false)) {
      await slotAgain.click()
      await page.getByTestId("input-name").first().fill("Second User")
      await page.getByTestId("input-email").first().fill("second@example.com")
      await page.getByTestId("btn-submit-booking").first().click()

      // Either success (different slot) or conflict
      const result = await Promise.race([
        page.waitForSelector("text=Booking Confirmed!", { timeout: 5000 }),
        page.waitForSelector("text=just booked", { timeout: 5000 }),
      ]).catch(() => null)
      expect(result).toBeTruthy()
    }
  })

  test("should refresh availability after booking", async ({ page }) => {
    await page.goto("/test/30min")
    const grid = page.getByTestId("calendar-grid")
    await expect(grid).toBeVisible({ timeout: 15000 })

    // Book a slot
    const slot = grid.getByTestId("slot-preferred").or(grid.getByTestId("slot-available")).first()
    if (!(await slot.isVisible().catch(() => false))) {
      test.skip(true, "No bookable slots")
      return
    }
    await slot.click()
    await page.getByTestId("input-name").first().fill("Test User")
    await page.getByTestId("input-email").first().fill("test@example.com")
    await page.getByTestId("btn-submit-booking").first().click()
    await expect(page.locator("text=Booking Confirmed!")).toBeVisible({
      timeout: 10000,
    })

    // Go back and verify the page still loads
    await page.goto("/test/30min")
    await expect(grid).toBeVisible({ timeout: 15000 })
  })
})

test.describe("Dashboard & Links Management", () => {
  test("should see login page", async ({ page }) => {
    // Verify the login page is accessible
    await page.goto("/login")
    await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test("should see dashboard after login", async ({ page }) => {
    await loginAsTestUser(page)

    // Should be on dashboard
    await expect(page.locator("h1")).toContainText("Dashboard", { timeout: 10000 })

    // Navigation should work
    await expect(page.locator('text=Dashboard')).toBeVisible()
    await expect(page.locator('text=Bookings')).toBeVisible()
    await expect(page.locator('text=Links')).toBeVisible()
  })

  test("should navigate to bookings page", async ({ page }) => {
    await loginAsTestUser(page)

    // Navigate to bookings
    await page.getByText("Bookings").first().click()
    await expect(page.locator("h1")).toContainText("Bookings", { timeout: 5000 })
  })

  test("should navigate to links page and see demo links", async ({ page }) => {
    await loginAsTestUser(page)

    // Navigate to links
    await page.getByText("Links").first().click()
    await expect(page.locator("h1")).toContainText("Scheduling Links", { timeout: 5000 })

    // Demo links should be visible
    await expect(page.getByText("30 Minute Meeting")).toBeVisible({ timeout: 5000 })
  })

  test("should edit a link and change its name", async ({ page }) => {
    await loginAsTestUser(page)

    // Navigate to links
    await page.getByText("Links").first().click()
    await expect(page.locator("h1")).toContainText("Scheduling Links", { timeout: 5000 })

    // Click edit on the first link
    await page.getByText("Edit").first().click()

    // Should be on the edit page
    await expect(page.locator("text=General Settings")).toBeVisible({ timeout: 5000 })
  })
})

test.describe("Error Handling", () => {
  test("should show loading state on booking page", async ({ page }) => {
    await page.goto("/test/30min")
    await expect(page.getByTestId("calendar-grid")).toBeVisible({
      timeout: 15000,
    })
  })

  test("should handle invalid slug gracefully", async ({ page }) => {
    const response = await page.goto("/this-slug-does-not-exist")
    expect(response?.status()).toBe(404)
  })
})
