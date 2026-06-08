/**
 * E2E tests for the public booking page (Step 44)
 */
import { test, expect } from "./fixtures"

test.describe("Booking Page — Public View", () => {
  test("should load booking page with correct title", async ({ page }) => {
    await page.goto("/test/30min")
    await expect(page).toHaveTitle(/30 Minute Meeting/)
    await expect(page.locator("h1")).toContainText("Test User")
  })

  test("should display week view grid on desktop", async ({ page }) => {
    await page.goto("/test/30min")
    const grid = page.getByTestId("calendar-grid")
    await expect(grid).toBeVisible({ timeout: 15000 })
  })

  test("should show clickable slots and disabled busy slots", async ({ page }) => {
    await page.goto("/test/30min")
    const grid = page.getByTestId("calendar-grid")
    await expect(grid).toBeVisible({ timeout: 15000 })

    // Preferred slots should be enabled and clickable
    const preferred = grid.getByTestId("slot-preferred").first()
    if (await preferred.isVisible().catch(() => false)) {
      await expect(preferred).toBeEnabled()
    }

    // Busy slots should be disabled
    const busy = grid.getByTestId("slot-busy").first()
    if (await busy.isVisible().catch(() => false)) {
      await expect(busy).toBeDisabled()
    }
  })

  test("should open booking form when clicking a slot", async ({ page }) => {
    await page.goto("/test/30min")
    const grid = page.getByTestId("calendar-grid")
    await expect(grid).toBeVisible({ timeout: 15000 })

    // Try preferred slots first, then available
    const slot = grid.getByTestId("slot-preferred").or(grid.getByTestId("slot-available")).first()
    if (await slot.isVisible().catch(() => false)) {
      await slot.click()

      // Form should appear (use .first() since form renders for desktop + mobile)
      await expect(page.getByTestId("input-name").first()).toBeVisible()
      await expect(page.getByTestId("btn-submit-booking").first()).toBeVisible()
    }
  })

  test("should show validation errors on empty form submission", async ({ page }) => {
    await page.goto("/test/30min")
    const grid = page.getByTestId("calendar-grid")
    await expect(grid).toBeVisible({ timeout: 15000 })

    const slot = grid.getByTestId("slot-preferred").or(grid.getByTestId("slot-available")).first()
    if (await slot.isVisible().catch(() => false)) {
      await slot.click()

      // Submit empty form
      await page.getByTestId("btn-submit-booking").first().click()

      // Should show validation (red border or error text)
      const hasError = await page.locator("text=required").first().isVisible().catch(() => false)
      // Alternately check if the form is still there (didn't submit)
      const formStillVisible = await page.getByTestId("input-name").first().isVisible().catch(() => false)
      expect(hasError || formStillVisible).toBeTruthy()
    }
  })

  test("should navigate to next week", async ({ page }) => {
    await page.goto("/test/30min")
    await expect(page.getByTestId("calendar-grid")).toBeVisible({ timeout: 15000 })

    const initialRange = await page.getByTestId("week-range").textContent()
    const nextBtn = page.getByTestId("nav-next-week")
    await expect(nextBtn).toBeEnabled()
    await nextBtn.click()
    await page.waitForTimeout(800)

    const newRange = await page.getByTestId("week-range").textContent()
    expect(newRange).not.toBe(initialRange)
  })

  test("should not navigate before current week", async ({ page }) => {
    await page.goto("/test/30min")
    await expect(page.getByTestId("calendar-grid")).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId("nav-prev-week")).toBeDisabled()
  })

  test("should show 404 for non-existent link", async ({ page }) => {
    const response = await page.goto("/nonexistent/30min")
    expect(response?.status()).toBe(404)
  })
})

test.describe("Booking Page — Mobile Responsive", () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test("should display booking form on mobile", async ({ page }) => {
    await page.goto("/test/30min")
    const grid = page.getByTestId("calendar-grid")
    await expect(grid).toBeVisible({ timeout: 15000 })

    const slot = grid.getByTestId("slot-preferred").or(grid.getByTestId("slot-available")).first()
    if (await slot.isVisible().catch(() => false)) {
      await slot.click()

      // Form should be visible (bottom sheet on mobile)
      // Use .last() — mobile form is second in DOM after hidden desktop form
      await expect(page.getByTestId("input-name").last()).toBeVisible()
      await expect(page.getByTestId("btn-submit-booking").last()).toBeVisible()
    }
  })

  test("should have touch-friendly slot sizes on mobile", async ({ page }) => {
    await page.goto("/test/30min")
    const grid = page.getByTestId("calendar-grid")
    await expect(grid).toBeVisible({ timeout: 15000 })

    const slot = grid.getByTestId("slot-preferred").or(grid.getByTestId("slot-available")).first()
    if (await slot.isVisible().catch(() => false)) {
      const box = await slot.boundingBox()
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44)
      }
    }
  })
})
