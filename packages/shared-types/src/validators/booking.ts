import { z } from "zod";

export const createBookingSchema = z.object({
  scheduleLinkSlug: z.string().min(1),
  startTime: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: "start_time must be a valid ISO8601 timestamp",
  }),
  endTime: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: "end_time must be a valid ISO8601 timestamp",
  }),
  attendeeName: z.string().min(1, "Name is required").max(255),
  attendeeEmail: z.string().email("Invalid email format"),
  attendeeTimezone: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => new Date(data.endTime) > new Date(data.startTime), {
  message: "end_time must be after start_time",
  path: ["endTime"],
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
