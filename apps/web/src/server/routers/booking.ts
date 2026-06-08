import { router, publicProcedure, protectedProcedure } from "../trpc"
import { createBookingSchema } from "@meetflow/shared-types"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { findLinkBySlug } from "./schedule-links"
import { sendConfirmationEmails } from "@meetflow/notification"
import { createMeetingLink } from "@meetflow/video-meeting"
import type { MeetingProvider } from "@meetflow/video-meeting"

interface BookingRecord {
  id: string
  scheduleLinkId: string
  startTime: string
  endTime: string
  status: "confirmed" | "cancelled"
  attendeeName: string
  attendeeEmail: string
  attendeeTimezone: string | null
  notes: string | null
  meetingUrl: string | null
  cancelToken: string
  createdAt: Date
}

const bookingsStore = new Map<string, BookingRecord>()

// Track which schedule link + time slot is already booked
const bookedSlots = new Map<string, string>() // key: `${linkId}::${startIso}` -> bookingId

function generateId(): string {
  return `book_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export const bookingRouter = router({
  create: publicProcedure
    .input(createBookingSchema)
    .mutation(async ({ input }) => {
      // Check for double booking (in-memory)
      const slotKey = `${input.scheduleLinkSlug}::${input.startTime}`
      const existing = bookedSlots.get(slotKey)
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This time slot has already been booked. Please select another.",
        })
      }

      const id = generateId()
      const cancelToken = crypto.randomUUID()
      const record: BookingRecord = {
        id,
        scheduleLinkId: input.scheduleLinkSlug,
        startTime: input.startTime,
        endTime: input.endTime,
        status: "confirmed",
        attendeeName: input.attendeeName,
        attendeeEmail: input.attendeeEmail,
        attendeeTimezone: input.attendeeTimezone ?? null,
        notes: input.notes ?? null,
        meetingUrl: null, // Would be set by Zoom/Meet integration
        cancelToken,
        createdAt: new Date(),
      }

      bookingsStore.set(id, record)
      bookedSlots.set(slotKey, id)

      // Fire-and-forget: generate meeting link + send confirmation emails.
      // Neither failure blocks the booking response.
      const link = findLinkBySlug(input.scheduleLinkSlug)
      if (link) {
        // Phase 1: Generate video meeting link (if provider configured)
        const meetingPromise =
          link.meetingProvider && link.meetingProvider !== "none"
            ? createMeetingLink({
                provider: link.meetingProvider as MeetingProvider,
                topic: `${link.name} — ${input.attendeeName}`,
                startTime: input.startTime,
                endTime: input.endTime,
                durationMinutes: link.durationMinutes,
                timezone: input.attendeeTimezone ?? "UTC",
                attendeeEmail: input.attendeeEmail,
                attendeeName: input.attendeeName,
              }).then((result) => {
                if (result.url) {
                  record.meetingUrl = result.url
                  console.log("[booking] Meeting link created:", result.url)
                } else if (result.error) {
                  console.warn("[booking] Meeting link failed:", result.error)
                }
                return result.url
              })
            : Promise.resolve(null)

        // Phase 2: Send emails with meeting URL (if available)
        meetingPromise
          .then((meetingUrl) =>
            sendConfirmationEmails({
              bookingId: id,
              attendeeName: input.attendeeName,
              attendeeEmail: input.attendeeEmail,
              attendeeTimezone: input.attendeeTimezone ?? "UTC",
              organizerName: "Test User",
              organizerEmail: "test@meetflow.dev",
              scheduleLinkName: link.name,
              durationMinutes: link.durationMinutes,
              startUtc: input.startTime,
              endUtc: input.endTime,
              notes: input.notes ?? null,
              meetingUrl,
            }),
          )
          .catch((err) => console.error("[booking] Post-processing failed:", err))
      }

      return {
        bookingId: id,
        status: "confirmed" as const,
        meetingUrl: null as string | null,
        cancelToken,
      }
    }),

  cancel: publicProcedure
    .input(z.object({ bookingId: z.string(), cancelToken: z.string() }))
    .mutation(async ({ input }) => {
      const booking = bookingsStore.get(input.bookingId)
      if (!booking) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" })
      }
      if (booking.cancelToken !== input.cancelToken) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Invalid cancel token" })
      }
      if (booking.status === "cancelled") {
        throw new TRPCError({ code: "CONFLICT", message: "Booking already cancelled" })
      }

      booking.status = "cancelled"
      const slotKey = `${booking.scheduleLinkId}::${booking.startTime}`
      bookedSlots.delete(slotKey)

      return { success: true, message: "Booking cancelled" }
    }),

  get: publicProcedure
    .input(z.object({ bookingId: z.string() }))
    .query(async ({ input }) => {
      const booking = bookingsStore.get(input.bookingId)
      if (!booking) throw new TRPCError({ code: "NOT_FOUND" })
      // Don't expose cancelToken in the public response
      const { cancelToken: _, ...safe } = booking
      return safe
    }),

  list: protectedProcedure.query(async () => {
    return Array.from(bookingsStore.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }),

  stats: protectedProcedure.query(async () => {
    const all = Array.from(bookingsStore.values())
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay() + 1)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)

    const thisWeek = all.filter((b) => {
      const created = b.createdAt.getTime()
      return created >= weekStart.getTime() && created < weekEnd.getTime()
    })

    return {
      totalBookings: all.filter((b) => b.status === "confirmed").length,
      thisWeekBookings: thisWeek.filter((b) => b.status === "confirmed").length,
      cancelledBookings: all.filter((b) => b.status === "cancelled").length,
      recentBookings: all.slice(0, 5),
    }
  }),
})
