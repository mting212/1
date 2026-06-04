import { z } from "zod";

const IANA_TIMEZONES = [
  "Asia/Shanghai", "Asia/Tokyo", "Asia/Singapore", "Asia/Kolkata",
  "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Europe/London", "Europe/Berlin", "Europe/Paris",
  "UTC", "Pacific/Auckland", "Australia/Sydney",
] as const;

export const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  timezone: z.string().default("Asia/Shanghai"),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  timezone: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
