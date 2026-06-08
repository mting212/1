import { appRouter } from "@/server/routers"
import { auth } from "@/auth"

/**
 * Create a tRPC caller for server components.
 * Uses the NextAuth session to build context.
 */
export async function getServerCaller() {
  const session = await auth()
  const userId = session?.user?.email ? `user:${session.user.email}` : undefined
  return appRouter.createCaller({ session, userId })
}
