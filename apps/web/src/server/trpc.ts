import { initTRPC, TRPCError } from "@trpc/server"
import superjson from "superjson"
import { auth } from "@/auth"
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch"

export async function createContext(_opts: FetchCreateContextFnOptions) {
  const session = await auth()
  const userId = session?.user?.email ? `user:${session.user.email}` : undefined
  return { session, userId }
}

type Context = Awaited<ReturnType<typeof createContext>>

const t = initTRPC.context<Context>().create({
  transformer: superjson,
})

export const router = t.router
export const publicProcedure = t.procedure

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } })
})

export const protectedProcedure = t.procedure.use(enforceAuth)
