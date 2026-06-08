import { router } from "../trpc"
import { authRouter } from "./auth"
import { scheduleLinksRouter } from "./schedule-links"
import { availabilityRouter } from "./availability"
import { bookingRouter } from "./booking"

export const appRouter = router({
  auth: authRouter,
  scheduleLinks: scheduleLinksRouter,
  availability: availabilityRouter,
  booking: bookingRouter,
})

export type AppRouter = typeof appRouter
