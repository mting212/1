"use client"

import { cn } from "@/lib/utils"
import type { WeekGrid, GridCell } from "@meetflow/calendar-engine"
import { isCellBusy, isCellPreferred } from "@meetflow/calendar-engine"

interface Props {
  grid: WeekGrid
  busySlots: { start: string; end: string }[]
  preferredSlots?: { start: string; end: string }[]
  selectedSlot?: GridCell | undefined
  onSlotSelect?: ((cell: GridCell) => void) | undefined
  loading?: boolean
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function CalendarGrid({
  grid,
  busySlots,
  preferredSlots = [],
  selectedSlot,
  onSlotSelect,
  loading,
}: Props) {
  // Responsive cell height: 44px+ on mobile (≥44px touch target), 36px on desktop
  const cellHeight = "h-11 md:h-9"

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "bg-gray-50 p-4",
              // Hide extra columns on smaller viewports
              i >= 3 && "hidden md:block",
              i >= 3 && "hidden lg:block",
            )}
          >
            <div className="h-4 w-10 bg-gray-200 rounded animate-pulse mb-2" />
            {Array.from({ length: 10 }).map((_, j) => (
              <div
                key={j}
                className="h-9 md:h-6 bg-gray-100 rounded animate-pulse mb-1"
              />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto" data-testid="calendar-grid">
      {/* Day headers — responsive columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-px bg-gray-200 rounded-t-lg overflow-hidden">
        {grid.days.map((day, i) => (
          <div
            key={i}
            className={cn(
              "bg-white p-2 text-center text-sm font-medium",
              // Show all 7 on lg, 3 on md, 1 on mobile
              i > 0 && "hidden",
              i < 3 && "md:block",
              "lg:block", // all columns visible on lg
            )}
            // Override: show specific columns per breakpoint
            style={
              {
                // CSS variables could be used for active column on mobile
              } as React.CSSProperties
            }
          >
            <div className="text-gray-500">{DAY_LABELS[day.getDay()]}</div>
            <div className="text-gray-900">{day.getDate()}</div>
          </div>
        ))}
      </div>

      {/* Time grid — responsive columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-px bg-gray-200 rounded-b-lg overflow-hidden">
        {grid.columns.map((column, colIdx) => {
          const label = DAY_LABELS[grid.days[colIdx]?.getDay() ?? 0]

          return (
            <div
              key={colIdx}
              className={cn(
                "bg-white",
                // Responsive column visibility
                colIdx > 0 && "hidden",
                colIdx < 3 && "md:block",
                "lg:block", // all 7 columns on lg
              )}
            >
              {column.map((cell, rowIdx) => {
                const isSelected = selectedSlot?.iso === cell.iso
                const busy = isCellBusy(cell, busySlots)
                const preferred =
                  !busy && isCellPreferred(cell, preferredSlots)

                return (
                  <button
                    key={rowIdx}
                    type="button"
                    aria-label={`${label} ${cell.hour}:${String(cell.minute).padStart(2, "0")}`}
                    data-testid={
                        busy
                          ? "slot-busy"
                          : preferred
                            ? "slot-preferred"
                            : "slot-available"
                      }
                    className={cn(
                      cellHeight,
                      "w-full text-xs border-b border-gray-100 transition-colors",
                      "focus:outline-none focus:ring-2 focus:ring-blue-400",
                      // Touch-friendly: min 44px height on mobile via h-11
                      // Busy: grey, not clickable
                      busy &&
                        "bg-gray-200 text-gray-400 cursor-not-allowed",
                      // Preferred: highlighted blue tint
                      !busy &&
                        preferred &&
                        "bg-blue-100 text-blue-700 hover:bg-blue-200",
                      // Available: clickable
                      !busy &&
                        !preferred &&
                        !isSelected &&
                        "bg-white text-gray-600 hover:bg-blue-50",
                      // Selected
                      isSelected &&
                        "bg-blue-500 text-white hover:bg-blue-600",
                    )}
                    onClick={() => {
                      if (!busy) onSlotSelect?.(cell)
                    }}
                    disabled={busy}
                  >
                    {/* Show time label on the hour */}
                    {rowIdx === 0 || cell.minute === 0
                      ? `${cell.hour}:00`
                      : ""}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Mobile: swipe indicator */}
      <div className="flex justify-center gap-2 mt-2 lg:hidden">
        {grid.days.map((_, i) => (
          <div
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-gray-300 aria-current:bg-blue-500"
            aria-current={i === 0 ? "true" : undefined}
          />
        ))}
      </div>
    </div>
  )
}
