import { z } from "zod";

export const createScheduleLinkSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  durationMinutes: z
    .number()
    .int()
    .refine((v) => [15, 30, 45, 60].includes(v), {
      message: "Duration must be 15, 30, 45, or 60 minutes",
    }),
  description: z.string().optional(),
});

export const updateScheduleLinkSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  durationMinutes: z
    .number()
    .int()
    .refine((v) => [15, 30, 45, 60].includes(v))
    .optional(),
  description: z.string().optional(),
  branding: z.record(z.unknown()).optional(),
  meetingProvider: z.enum(["zoom", "google_meet"]).optional(),
});

export const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type CreateScheduleLinkInput = z.infer<typeof createScheduleLinkSchema>;
export type UpdateScheduleLinkInput = z.infer<typeof updateScheduleLinkSchema>;
