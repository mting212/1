import { toZonedTime, fromZonedTime } from "date-fns-tz"

export interface GridCell {
  time: Date
  dayOfWeek: number // 0=Sun, 6=Sat
  hour: number
  minute: number
  iso: string
}

export interface WeekGrid {
  days: Date[] // 7 Date objects, one per day at midnight UTC
  columns: GridCell[][] // 7 columns, each with N rows
  hourRange: { start: number; end: number } // e.g. 8-20
}

/**
 * Generate a 7-day week grid from windowStartUtc (Monday midnight in the
 * display timezone, expressed as UTC). Each column is a day; each row is
 * a slot of `slotMinutes` minutes.
 *
 * Timezone-aware: uses the given IANA timezone for wall-clock hour/minute
 * and day-of-week. DST-safe: detects and removes duplicate UTC timestamps
 * that occur when fromZonedTime leniently maps DST-gap wall-clock times to
 * the same UTC moment as pre-gap times (spring-forward).
 */
export function generateWeekGrid(
  windowStartUtc: Date,
  timezone: string,
  hourStart = 8,
  hourEnd = 20,
  slotMinutes = 30,
): WeekGrid {
  const days: Date[] = []
  const columns: GridCell[][] = []

  for (let d = 0; d < 7; d++) {
    // Midnight UTC for this day
    const dayUtc = new Date(windowStartUtc)
    dayUtc.setUTCDate(dayUtc.getUTCDate() + d)
    days.push(new Date(dayUtc))

    // Get wall-clock date components in the target timezone.
    // We must use the zoned year/month/date (not UTC) because the
    // wall-clock date in the target TZ may differ from the UTC date
    // (e.g. 2026-05-31T16:00Z = June 1 in Asia/Shanghai).
    const zonedDay = toZonedTime(dayUtc, timezone)
    const dayOfWeek = zonedDay.getDay() // 0=Sun, 6=Sat
    const zYear = zonedDay.getFullYear()
    const zMonth = zonedDay.getMonth()
    const zDate = zonedDay.getDate()

    const cells: GridCell[] = []
    let prevUtcMs = 0 // track previous UTC timestamp to detect DST duplicates
    for (let h = hourStart; h < hourEnd; h++) {
      for (let m = 0; m < 60; m += slotMinutes) {
        // Build an ISO 8601 datetime string WITHOUT timezone suffix.
        // fromZonedTime treats it as wall-clock time in the target
        // timezone and returns the correct UTC moment.
        const dateStr =
          `${String(zYear).padStart(4, "0")}-` +
          `${String(zMonth + 1).padStart(2, "0")}-` +
          `${String(zDate).padStart(2, "0")}T` +
          `${String(h).padStart(2, "0")}:` +
          `${String(m).padStart(2, "0")}:00`

        try {
          const utcTime = fromZonedTime(dateStr, timezone)
          const utcMs = utcTime.getTime()

          // Skip DST-gap duplicates: spring-forward maps gap times to
          // the same UTC as pre-gap times (e.g. 02:00 → same UTC as 01:00).
          if (utcMs <= prevUtcMs) continue
          prevUtcMs = utcMs

          cells.push({
            time: utcTime,
            dayOfWeek,
            hour: h,
            minute: m,
            iso: utcTime.toISOString(),
          })
        } catch {
          // Skip non-existent times (some runtimes throw for DST gap)
        }
      }
    }
    columns.push(cells)
  }

  return { days, columns, hourRange: { start: hourStart, end: hourEnd } }
}

/** Check if a cell overlaps with any busy slot (half-open interval) */
export function isCellBusy(
  cell: GridCell,
  busySlots: { start: string; end: string }[],
): boolean {
  const cellStart = cell.time.getTime()
  const cellEnd = cellStart + 30 * 60 * 1000
  return busySlots.some((b) => {
    const bStart = new Date(b.start).getTime()
    const bEnd = new Date(b.end).getTime()
    return cellStart < bEnd && bStart < cellEnd
  })
}

/** Check if a cell falls completely within a preferred range */
export function isCellPreferred(
  cell: GridCell,
  preferredSlots: { start: string; end: string }[],
): boolean {
  const cellStart = cell.time.getTime()
  const cellEnd = cellStart + 30 * 60 * 1000
  return preferredSlots.some((p) => {
    const pStart = new Date(p.start).getTime()
    const pEnd = new Date(p.end).getTime()
    return cellStart >= pStart && cellEnd <= pEnd
  })
}
