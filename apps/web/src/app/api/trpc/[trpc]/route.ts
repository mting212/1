import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { appRouter } from "@/server/routers"
import { createContext } from "@/server/trpc"
import { seedDemoData } from "@/server/routers/schedule-links"

// Ensure demo data exists before handling any request
seedDemoData()

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  })

export { handler as GET, handler as POST }
