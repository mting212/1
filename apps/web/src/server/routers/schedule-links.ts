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
  meetingProvider: string
  createdAt: Date
}

const linksStore = new Map<string, LinkRecord>()

let seeded = false

/** Look up a link by slug (bypasses tRPC — for internal use) */
export function findLinkBySlug(slug: string): LinkRecord | undefined {
  return Array.from(linksStore.values()).find(
    (l) => l.slug === slug && l.isActive,
  )
}

/** Seed the in-memory store with demo data. Idempotent — call freely. */
export function seedDemoData() {
  if (seeded) return
  seeded = true

  const demo: LinkRecord = {
    id: "link_demo_001",
    userId: "user:test@meetflow.dev",
    slug: "test/30min",
    name: "30 Minute Meeting",
    description: "Book a 30-minute chat with me",
    durationMinutes: 30,
    isActive: true,
    branding: {
      primaryColor: "#6366f1", // indigo-500
      welcomeMessage: "Welcome! Choose a time that works for you.",
    },
    meetingProvider: "zoom",
    createdAt: new Date(),
  }
  linksStore.set(demo.id, demo)

  // Second demo link — shows brand variations
  const demo2: LinkRecord = {
    id: "link_demo_002",
    userId: "user:test@meetflow.dev",
    slug: "alex/15min",
    name: "15 Minute Quick Call",
    description: "A quick sync to discuss your project",
    durationMinutes: 15,
    isActive: true,
    branding: {
      primaryColor: "#f59e0b", // amber-500 — test contrast auto-darken
      logoUrl: null,
    },
    meetingProvider: "google_meet",
    createdAt: new Date(),
  }
  linksStore.set(demo2.id, demo2)
}

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
        isActive: true, branding: {}, meetingProvider: "zoom", createdAt: new Date(),
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
      seedDemoData()
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
