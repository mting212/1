import { router, protectedProcedure, publicProcedure } from "../trpc"
import { setAvailabilityRulesSchema, scheduleRuleSchema } from "@meetflow/shared-types"
import { TRPCError } from "@trpc/server"
import { z } from "zod"

// In-memory store for MVP
const rulesStore: Map<string, {
  dayOfWeek: number
  startTime: string
  endTime: string
}[]> = new Map()

const scheduleRulesStore: Map<string, {
  ruleType: string
  ruleValue: number
}[]> = new Map()

export const availabilityRouter = router({
  setRules: protectedProcedure
    .input(setAvailabilityRulesSchema)
    .mutation(async ({ input }) => {
      rulesStore.set(input.scheduleLinkId, input.rules)
      return { success: true, count: input.rules.length }
    }),

  getRules: publicProcedure
    .input(z.object({ scheduleLinkId: z.string() }))
    .query(async ({ input }) => {
      return rulesStore.get(input.scheduleLinkId) ?? []
    }),

  setScheduleRule: protectedProcedure
    .input(scheduleRuleSchema)
    .mutation(async ({ input }) => {
      const existing = scheduleRulesStore.get(input.scheduleLinkId) ?? []
      const idx = existing.findIndex(r => r.ruleType === input.ruleType)
      const entry = { ruleType: input.ruleType, ruleValue: input.ruleValue }
      if (idx >= 0) {
        existing[idx] = entry
      } else {
        existing.push(entry)
      }
      scheduleRulesStore.set(input.scheduleLinkId, existing)
      return { success: true }
    }),

  getScheduleRules: publicProcedure
    .input(z.object({ scheduleLinkId: z.string() }))
    .query(async ({ input }) => {
      return scheduleRulesStore.get(input.scheduleLinkId) ?? []
    }),

  getAvailability: publicProcedure
    .input(z.object({
      scheduleLinkId: z.string(),
      windowStart: z.string(),
      windowEnd: z.string(),
      inviteeTimezone: z.string().default("UTC"),
    }))
    .query(async ({ input }) => {
      // In production, this proxies to the Go scheduler gRPC service
      // For MVP, return mock data
      const slots = []
      const start = new Date(input.windowStart)
      const end = new Date(input.windowEnd)
      const cursor = new Date(start)
      while (cursor < end) {
        const day = cursor.getDay()
        if (day >= 1 && day <= 5) {
          for (let h = 9; h < 17; h++) {
            for (let m = 0; m < 60; m += 30) {
              const slotStart = new Date(cursor)
              slotStart.setHours(h, m, 0, 0)
              const slotEnd = new Date(slotStart)
              slotEnd.setMinutes(slotEnd.getMinutes() + 30)
              if (slotStart >= start && slotEnd <= end) {
                slots.push({
                  start: slotStart.toISOString(),
                  end: slotEnd.toISOString(),
                  rank: (h >= 10 && h < 12) ? "PREFERRED" : "AVAILABLE",
                })
              }
            }
          }
        }
        cursor.setDate(cursor.getDate() + 1)
      }
      return { slots: slots.slice(0, 200) }
    }),
})
