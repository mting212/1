import { router, protectedProcedure, publicProcedure } from "../trpc"
import { createScheduleLinkSchema, updateScheduleLinkSchema } from "@meetflow/shared-types"
import { TRPCError } from "@trpc/server"
import { z } from "zod"

interface LinkRecord {
  id: string
  userId: string
  slug: string
  name: string
  description: string | null
  durationMinutes: number
  isActive: boolean
  branding: Record<string, unknown>
  createdAt: Date
}

const linksStore = new Map<string, LinkRecord>()

export const scheduleLinksRouter = router({
  create: protectedProcedure
    .input(createScheduleLinkSchema)
    .mutation(async ({ ctx, input }) => {
      const id = `link_${Date.now()}`
      const slug = `${input.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now().toString(36).slice(-4)}`
      const record: LinkRecord = {
        id, userId: ctx.userId, slug, name: input.name,
        durationMinutes: input.durationMinutes,
        description: input.description ?? null,
        isActive: true, branding: {}, createdAt: new Date(),
      }
      linksStore.set(id, record)
      return record
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return Array.from(linksStore.values())
      .filter(l => l.userId === ctx.userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const link = Array.from(linksStore.values())
        .find(l => l.slug === input.slug && l.isActive)
      if (!link) throw new TRPCError({ code: "NOT_FOUND" })
      return link
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), ...updateScheduleLinkSchema.shape }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input
      const existing = linksStore.get(id)
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
      Object.assign(existing, updates)
      return existing
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const existing = linksStore.get(input.id)
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
      existing.isActive = false
      return { success: true }
    }),
})
