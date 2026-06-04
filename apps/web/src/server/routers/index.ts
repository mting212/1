import { router } from "../trpc"
import { authRouter } from "./auth"
import { scheduleLinksRouter } from "./schedule-links"
import { availabilityRouter } from "./availability"

export const appRouter = router({
  auth: authRouter,
  scheduleLinks: scheduleLinksRouter,
  availability: availabilityRouter,
})

export type AppRouter = typeof appRouter
