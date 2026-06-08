import { describe, it, expect } from "vitest"
import { generateWeekGrid, isCellBusy, isCellPreferred } from "../week-grid"
import { fromZonedTime } from "date-fns-tz"

/**
 * Helper: create a UTC Date from wall-clock values in a given timezone.
 * e.g. makeZoned(2026, 6, 1, 0, 0, 0, "Asia/Shanghai") returns the UTC moment
 * that corresponds to "June 1, 2026 00:00:00 in Shanghai".
 */
function makeZoned(
  year: number,
  month: number, // 0-indexed (0=Jan)
  day: number,
  hours: number,
  minutes: number,
  seconds: number,
  timezone: string,
): Date {
  // new Date(y,m,d,...) sets *local* time values, which is exactly what
  // fromZonedTime reads back — the two cancel out regardless of system TZ.
  const wallClock = new Date(year, month, day, hours, minutes, seconds)
  return fromZonedTime(wallClock, timezone)
}

/**
 * Create a window start: Monday midnight in the given timezone, converted to UTC.
 * This is the expected calling convention for generateWeekGrid.
 */
function mondayMidnight(year: number, month: number, day: number, tz: string): Date {
  return makeZoned(year, month, day, 0, 0, 0, tz)
}

// June 1, 2026 is a Monday
const JUNE = 5 // 0-indexed
const SHANGHAI_MONDAY_UTC = mondayMidnight(2026, JUNE, 1, "Asia/Shanghai") // 2026-05-31T16:00:00Z
const NY_MONDAY_UTC = mondayMidnight(2026, JUNE, 1, "America/New_York") // 2026-06-01T04:00:00Z
const UTC_MONDAY = mondayMidnight(2026, JUNE, 1, "UTC") // 2026-06-01T00:00:00Z

describe("generateWeekGrid", () => {
  // ============================================================
  // Basic grid structure
  // ============================================================
  describe("basic grid structure", () => {
    it("should generate 7 columns for a week", () => {
      const grid = generateWeekGrid(UTC_MONDAY, "UTC")
      expect(grid.columns).toHaveLength(7)
      expect(grid.days).toHaveLength(7)
    })

    it("should generate correct number of rows for default 8-20 range (30min slots)", () => {
      const grid = generateWeekGrid(UTC_MONDAY, "UTC")
      // 12 hours × 2 slots/hour = 24 slots per day
      for (const col of grid.columns) {
        expect(col).toHaveLength(24)
      }
    })

    it("should respect custom hourStart/hourEnd", () => {
      const grid = generateWeekGrid(UTC_MONDAY, "UTC", 9, 17, 30)
      // 8 hours × 2 slots/hour = 16 slots
      for (const col of grid.columns) {
        expect(col).toHaveLength(16)
      }
      expect(grid.hourRange).toEqual({ start: 9, end: 17 })
    })

    it("should respect custom slotMinutes (60min)", () => {
      const grid = generateWeekGrid(UTC_MONDAY, "UTC", 8, 18, 60)
      for (const col of grid.columns) {
        expect(col).toHaveLength(10)
      }
    })

    it("should have correct dayOfWeek for each column when windowStart is Monday in display tz", () => {
      const grid = generateWeekGrid(UTC_MONDAY, "UTC")
      // d=0→Mon(1), d=1→Tue(2), d=2→Wed(3), d=3→Thu(4), d=4→Fri(5), d=5→Sat(6), d=6→Sun(0)
      const expected = [1, 2, 3, 4, 5, 6, 0]
      for (let i = 0; i < 7; i++) {
        expect(grid.columns[i]![0]!.dayOfWeek).toBe(expected[i])
      }
    })

    it("should produce unique UTC timestamps for each cell", () => {
      const grid = generateWeekGrid(SHANGHAI_MONDAY_UTC, "Asia/Shanghai")
      const isos = new Set<string>()
      for (const col of grid.columns) {
        for (const cell of col) {
          isos.add(cell.iso)
        }
      }
      expect(isos.size).toBe(7 * 24)
    })
  })

  // ============================================================
  // Timezone awareness
  // ============================================================
  describe("timezone awareness", () => {
    it("should produce different UTC times for same wall-clock in different timezones", () => {
      // 8:00 AM Shanghai wall-clock → UTC 0:00 (UTC+8)
      // 8:00 AM New York wall-clock (June, DST) → UTC 12:00 (UTC-4)
      const shanghaiGrid = generateWeekGrid(SHANGHAI_MONDAY_UTC, "Asia/Shanghai")
      const nyGrid = generateWeekGrid(NY_MONDAY_UTC, "America/New_York")

      const shFirst = shanghaiGrid.columns[0]![0]!
      const nyFirst = nyGrid.columns[0]![0]!

      expect(shFirst.iso).toBe("2026-06-01T00:00:00.000Z")
      expect(nyFirst.iso).toBe("2026-06-01T12:00:00.000Z")
      expect(shFirst.time.getTime()).not.toBe(nyFirst.time.getTime())
    })

    it("should have correct display hours in the target timezone", () => {
      const grid = generateWeekGrid(SHANGHAI_MONDAY_UTC, "Asia/Shanghai")
      const first = grid.columns[0]![0]!
      expect(first.hour).toBe(8)
      expect(first.minute).toBe(0)
    })

    it("should handle UTC timezone correctly", () => {
      const grid = generateWeekGrid(UTC_MONDAY, "UTC")
      const first = grid.columns[0]![0]!
      expect(first.hour).toBe(8)
      expect(first.iso).toBe("2026-06-01T08:00:00.000Z")
    })

    it("should handle negative offset timezones in winter (EST: UTC-5)", () => {
      // Monday December 7, 2026 midnight EST = 05:00 UTC
      const decMonday = mondayMidnight(2026, 11, 7, "America/New_York")
      const grid = generateWeekGrid(decMonday, "America/New_York")
      const first = grid.columns[0]![0]!
      // 8:00 AM EST → 13:00 UTC
      expect(first.iso).toBe("2026-12-07T13:00:00.000Z")
    })
  })

  // ============================================================
  // DST handling
  // ============================================================
  describe("DST handling", () => {
    it("should not crash on spring-forward DST boundary (US March 2026)", () => {
      // US spring-forward: Sunday March 8, 2026 (2 AM → 3 AM EDT)
      // fromZonedTime in date-fns-tz v3 is lenient: non-existent times are
      // mapped to valid UTC moments, so no slots are skipped.
      const springMonday = mondayMidnight(2026, 2, 2, "America/New_York")
      const grid = generateWeekGrid(springMonday, "America/New_York", 0, 24, 30)

      // Sunday March 8 is column 6
      const sundayCol = grid.columns[6]!
      // Spring-forward day: 2 slots removed by DST dedup (2:00, 2:30)
      // 48 − 2 = 46 slots expected
      expect(sundayCol.length).toBe(46)

      // Every cell has a unique UTC timestamp (no DST duplicates)
      const isos = new Set(sundayCol.map((c) => c.iso))
      expect(isos.size).toBe(sundayCol.length)
    })

    it("should not crash on fall-back DST boundary (US November 2026)", () => {
      // US fall-back: Sunday November 1, 2026 (2 AM EDT → 1 AM EST)
      // fromZonedTime in date-fns-tz v3 always picks the first occurrence
      // (EDT) for the 1:00 hour, so no duplicates.
      const fallMonday = mondayMidnight(2026, 9, 26, "America/New_York")
      const grid = generateWeekGrid(fallMonday, "America/New_York", 0, 24, 30)

      // Sunday November 1 is column 6
      const sundayCol = grid.columns[6]!
      // Standard 48 slots (lenient, no extras)
      expect(sundayCol.length).toBe(48)

      // Every cell has a unique UTC timestamp
      const isos = new Set(sundayCol.map((c) => c.iso))
      expect(isos.size).toBe(48)
    })

    it("should not vary for timezones without DST (Asia/Shanghai)", () => {
      const grid = generateWeekGrid(SHANGHAI_MONDAY_UTC, "Asia/Shanghai")
      for (const col of grid.columns) {
        expect(col).toHaveLength(24)
      }
    })
  })

  // ============================================================
  // Edge cases
  // ============================================================
  describe("edge cases", () => {
    it("should handle dayOfWeek correctly for Friday-start window", () => {
      // Friday June 5, 2026 midnight UTC
      const friday = makeZoned(2026, JUNE, 5, 0, 0, 0, "UTC")
      const grid = generateWeekGrid(friday, "UTC")
      // d=0→Fri(5), d=1→Sat(6), d=2→Sun(0), d=3→Mon(1), ..., d=6→Thu(4)
      const expected = [5, 6, 0, 1, 2, 3, 4]
      for (let i = 0; i < 7; i++) {
        expect(grid.columns[i]![0]!.dayOfWeek).toBe(expected[i])
      }
    })

    it("should produce valid ISO strings for all cells", () => {
      const grid = generateWeekGrid(SHANGHAI_MONDAY_UTC, "Asia/Shanghai")
      const isoRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      for (const col of grid.columns) {
        for (const cell of col) {
          expect(cell.iso).toMatch(isoRe)
        }
      }
    })

    it("should not crash with a very large hour range", () => {
      const grid = generateWeekGrid(UTC_MONDAY, "UTC", 0, 24, 30)
      for (const col of grid.columns) {
        expect(col).toHaveLength(48) // 24h × 2
      }
    })
  })
})

// ============================================================
// isCellBusy
// ============================================================
describe("isCellBusy", () => {
  const cellTime = new Date("2026-06-01T09:00:00Z")
  const cell = {
    time: cellTime,
    dayOfWeek: 1,
    hour: 9,
    minute: 0,
    iso: cellTime.toISOString(),
  }

  it("should return false when busySlots is empty", () => {
    expect(isCellBusy(cell, [])).toBe(false)
  })

  it("should return true for exact overlap", () => {
    const busy = [{ start: "2026-06-01T09:00:00Z", end: "2026-06-01T09:30:00Z" }]
    expect(isCellBusy(cell, busy)).toBe(true)
  })

  it("should return true when busy starts before cell and ends during cell", () => {
    const busy = [{ start: "2026-06-01T08:45:00Z", end: "2026-06-01T09:15:00Z" }]
    expect(isCellBusy(cell, busy)).toBe(true)
  })

  it("should return true when busy starts during cell and ends after cell", () => {
    const busy = [{ start: "2026-06-01T09:15:00Z", end: "2026-06-01T09:45:00Z" }]
    expect(isCellBusy(cell, busy)).toBe(true)
  })

  it("should return true when busy fully contains the cell", () => {
    const busy = [{ start: "2026-06-01T08:00:00Z", end: "2026-06-01T10:00:00Z" }]
    expect(isCellBusy(cell, busy)).toBe(true)
  })

  it("should return false when busy ends exactly at cell start (boundary touch)", () => {
    const busy = [{ start: "2026-06-01T08:30:00Z", end: "2026-06-01T09:00:00Z" }]
    expect(isCellBusy(cell, busy)).toBe(false)
  })

  it("should return false when busy starts exactly at cell end (boundary touch)", () => {
    const busy = [{ start: "2026-06-01T09:30:00Z", end: "2026-06-01T10:00:00Z" }]
    expect(isCellBusy(cell, busy)).toBe(false)
  })

  it("should return false for completely non-overlapping slot", () => {
    const busy = [{ start: "2026-06-01T10:00:00Z", end: "2026-06-01T10:30:00Z" }]
    expect(isCellBusy(cell, busy)).toBe(false)
  })

  it("should check across multiple busy slots", () => {
    const busy = [
      { start: "2026-06-01T08:00:00Z", end: "2026-06-01T08:30:00Z" },
      { start: "2026-06-01T09:00:00Z", end: "2026-06-01T09:30:00Z" },
    ]
    expect(isCellBusy(cell, busy)).toBe(true)
  })
})

// ============================================================
// isCellPreferred
// ============================================================
describe("isCellPreferred", () => {
  const cellTime = new Date("2026-06-01T09:00:00Z")
  const cell = {
    time: cellTime,
    dayOfWeek: 1,
    hour: 9,
    minute: 0,
    iso: cellTime.toISOString(),
  }

  it("should return false for empty preferred slots", () => {
    expect(isCellPreferred(cell, [])).toBe(false)
  })

  it("should return true when cell fits exactly within a preferred range", () => {
    const p = [{ start: "2026-06-01T09:00:00Z", end: "2026-06-01T09:30:00Z" }]
    expect(isCellPreferred(cell, p)).toBe(true)
  })

  it("should return true when cell is fully inside a larger preferred range", () => {
    const p = [{ start: "2026-06-01T08:00:00Z", end: "2026-06-01T10:00:00Z" }]
    expect(isCellPreferred(cell, p)).toBe(true)
  })

  it("should return false when cell only partially overlaps preferred range", () => {
    // Cell: 9:00-9:30, Preferred: 9:15-9:45 → cell NOT fully inside
    const p = [{ start: "2026-06-01T09:15:00Z", end: "2026-06-01T09:45:00Z" }]
    expect(isCellPreferred(cell, p)).toBe(false)
  })

  it("should return false when cell is outside all preferred ranges", () => {
    const p = [{ start: "2026-06-01T10:00:00Z", end: "2026-06-01T11:00:00Z" }]
    expect(isCellPreferred(cell, p)).toBe(false)
  })

  it("should respect multiple preferred ranges", () => {
    const p = [
      { start: "2026-06-01T08:00:00Z", end: "2026-06-01T08:30:00Z" },
      { start: "2026-06-01T09:00:00Z", end: "2026-06-01T09:30:00Z" },
    ]
    expect(isCellPreferred(cell, p)).toBe(true)
  })
})
