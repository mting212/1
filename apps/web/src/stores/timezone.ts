import { create } from "zustand"
import { persist } from "zustand/middleware"

/**
 * Detect the browser timezone once.
 * Falls back to "UTC" if unavailable (SSR, restricted environments).
 */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return "UTC"
  }
}

interface TimezoneState {
  /** The currently active timezone (detected or user-selected) */
  timezone: string
  /** Whether the timezone was manually overridden */
  manual: boolean
  /** Set a new timezone (manual override) */
  setTimezone: (tz: string) => void
  /** Reset to auto-detected timezone */
  reset: () => void
}

export const useTimezoneStore = create<TimezoneState>()(
  persist(
    (set, get) => ({
      timezone: detectTimezone(),
      manual: false,
      setTimezone: (tz: string) => set({ timezone: tz, manual: true }),
      reset: () => set({ timezone: detectTimezone(), manual: false }),
    }),
    {
      name: "meetflow-timezone",
      // Only persist the timezone string, not the manual flag
      partialize: (state) => ({ timezone: state.timezone }),
    },
  ),
)
