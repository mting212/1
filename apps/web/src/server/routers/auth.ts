import { router, publicProcedure, protectedProcedure } from "../trpc"
import { registerSchema, updateProfileSchema } from "@meetflow/shared-types"
import { TRPCError } from "@trpc/server"

export const authRouter = router({
  register: publicProcedure
    .input(registerSchema)
    .mutation(async ({ input }) => {
      // MVP: accept credentials login without database
      return {
        success: true,
        user: {
          email: input.email,
          name: input.name,
          timezone: input.timezone,
        },
      }
    }),

  getMe: protectedProcedure.query(async ({ ctx }) => {
    return {
      id: ctx.userId,
      email: ctx.session?.user?.email ?? "",
      name: ctx.session?.user?.name ?? "",
    }
  }),

  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ input }) => {
      return { success: true, updated: input }
    }),
})
