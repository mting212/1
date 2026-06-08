"use client"

import { useState, useMemo } from "react"
import { CalendarGrid } from "@/components/CalendarGrid"
import { TimezoneDetector } from "@/components/TimezoneDetector"
import { BookingFormPanel } from "./BookingFormPanel"
import { generateWeekGrid } from "@meetflow/calendar-engine"
import { fromZonedTime } from "date-fns-tz"
import type { GridCell } from "@meetflow/calendar-engine"
import { api } from "@/trpc/react"
import { Button } from "@/components/ui/button"
import { useTimezoneStore } from "@/stores/timezone"

interface Props {
  scheduleLinkId: string
  scheduleLinkSlug: string
  scheduleLinkName: string
  organizerName: string
  primaryColor?: string | undefined
  logoUrl?: string | undefined
  welcomeMessage?: string | undefined
  durationMinutes: number
}

export function BookingCalendar({
  scheduleLinkId,
  scheduleLinkSlug,
  scheduleLinkName,
  organizerName,
  primaryColor,
  logoUrl,
  welcomeMessage,
  durationMinutes,
}: Props) {
  const timezone = useTimezoneStore((s) => s.timezone)
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedSlot, setSelectedSlot] = useState<GridCell | null>(null)
  const [conflictError, setConflictError] = useState("")

  // Real booking mutation
  const utils = api.useUtils()
  const bookMutation = api.booking.create.useMutation({
    onSuccess: () => {
      // Invalidate availability to refresh the grid
      utils.availability.getAvailability.invalidate()
    },
  })

  // Compute Monday midnight in the display timezone, expressed as UTC
  const windowStartUtc = useMemo(() => {
    // Get current time in the display timezone
    const now = new Date()
    // Find Monday of current week in the display timezone
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const mondayLocal = new Date(now)
    mondayLocal.setDate(mondayLocal.getDate() + diff + weekOffset * 7)
    mondayLocal.setHours(0, 0, 0, 0)
    // Convert wall-clock Monday midnight to UTC
    return fromZonedTime(mondayLocal, timezone)
  }, [weekOffset, timezone])

  const windowEndUtc = useMemo(() => {
    const end = new Date(windowStartUtc)
    end.setUTCDate(end.getUTCDate() + 7)
    return end
  }, [windowStartUtc])

  // Fetch availability from tRPC (proxies Go engine in production)
  const availQuery = api.availability.getAvailability.useQuery(
    {
      scheduleLinkId,
      windowStart: windowStartUtc.toISOString(),
      windowEnd: windowEndUtc.toISOString(),
      inviteeTimezone: timezone,
    },
    { staleTime: 60_000 },
  )

  const grid = useMemo(
    () => generateWeekGrid(windowStartUtc, timezone, 8, 20, 30),
    [windowStartUtc, timezone],
  )

  // Extract busy and preferred slots from availability query
  const { busySlots, preferredSlots } = useMemo(() => {
    if (!availQuery.data?.slots) return { busySlots: [], preferredSlots: [] }
    const busy: { start: string; end: string }[] = []
    const preferred: { start: string; end: string }[] = []
    for (const slot of availQuery.data.slots) {
      if (slot.rank === "PREFERRED") {
        preferred.push({ start: slot.start, end: slot.end })
      } else {
        busy.push({ start: slot.start, end: slot.end })
      }
    }
    return { busySlots: busy, preferredSlots: preferred }
  }, [availQuery.data])

  // Real booking submission via tRPC
  const handleSubmit = async (data: { name: string; email: string; notes: string }) => {
    if (!selectedSlot) return
    setConflictError("")

    const endTime = new Date(selectedSlot.time.getTime() + durationMinutes * 60 * 1000)

    try {
      const result = await bookMutation.mutateAsync({
        scheduleLinkSlug,
        startTime: selectedSlot.iso,
        endTime: endTime.toISOString(),
        attendeeName: data.name,
        attendeeEmail: data.email,
        attendeeTimezone: timezone,
        notes: data.notes || undefined,
      })

      return result // signals success to BookingFormPanel
    } catch (err: unknown) {
      // Check for tRPC conflict error
      if (
        typeof err === "object" &&
        err !== null &&
        "message" in err &&
        typeof (err as { message: string }).message === "string"
      ) {
        const msg = (err as { message: string }).message
        if (msg.toLowerCase().includes("conflict")) {
          setConflictError("This slot was just booked. Please select another time.")
          // Refresh availability
          utils.availability.getAvailability.invalidate()
          setSelectedSlot(null)
          throw err
        }
        setConflictError(msg)
        throw err
      }
      setConflictError("Booking failed. Please try again.")
      throw err
    }
  }

  const handleClose = () => {
    setSelectedSlot(null)
    setConflictError("")
    bookMutation.reset()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="bg-white border-b px-4 py-4 md:px-8"
        style={{
          borderTopColor: primaryColor,
          borderTopWidth: 4,
        }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo or avatar fallback */}
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={organizerName}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                style={{ backgroundColor: primaryColor }}
              >
                {organizerName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {organizerName}
              </h1>
              <p className="text-sm text-gray-500">
                {scheduleLinkName} · {durationMinutes} min
              </p>
            </div>
          </div>
          <TimezoneDetector />
        </div>
        {/* Welcome message */}
        {welcomeMessage && (
          <div className="max-w-5xl mx-auto mt-3">
            <p className="text-sm text-gray-600 italic">{welcomeMessage}</p>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6 md:px-8 flex flex-col lg:flex-row gap-6">
        {/* Calendar */}
        <div className="flex-1">
          {/* Week navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekOffset((w) => w - 1)}
              disabled={weekOffset <= 0}
              data-testid="nav-prev-week"
            >
              ← Previous
            </Button>
            <span className="text-sm text-gray-600" data-testid="week-range">
              {grid.days[0]?.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
              {" — "}
              {grid.days[6]?.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekOffset((w) => w + 1)}
              data-testid="nav-next-week"
            >
              Next →
            </Button>
          </div>

          {availQuery.isError && (
            <div className="mb-4 bg-red-50 text-red-700 text-sm p-3 rounded">
              Could not load availability. Please refresh the page.
            </div>
          )}

          <CalendarGrid
            grid={grid}
            busySlots={busySlots}
            preferredSlots={preferredSlots}
            selectedSlot={selectedSlot ?? undefined}
            onSlotSelect={setSelectedSlot}
            loading={availQuery.isLoading}
          />
        </div>

        {/* Booking form — side panel (lg) or bottom sheet (mobile) */}
        {selectedSlot && (
          <div className="lg:w-96 shrink-0">
            <div className="lg:sticky lg:top-6">
              <BookingFormPanel
                selectedSlot={selectedSlot}
                timezone={timezone}
                durationMinutes={durationMinutes}
                onClose={handleClose}
                onSubmit={handleSubmit}
                submitting={bookMutation.isPending}
                success={bookMutation.isSuccess}
                error={conflictError || bookMutation.error?.message || ""}
              />
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="max-w-5xl mx-auto px-4 pb-8 md:px-8">
        <div className="flex gap-4 text-xs text-gray-500">
          <span>⬜ Available</span>
          <span className="text-blue-600">⬜ Preferred</span>
          <span>⬛ Busy</span>
        </div>
      </div>
    </div>
  )
}
