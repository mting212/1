import { z } from "zod";

export const availabilityRuleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
}).refine((data) => data.endTime > data.startTime, {
  message: "end_time must be after start_time",
  path: ["endTime"],
});

export const setAvailabilityRulesSchema = z.object({
  scheduleLinkId: z.string().min(1),
  rules: z.array(availabilityRuleSchema).min(1),
});

export const scheduleRuleSchema = z.object({
  scheduleLinkId: z.string().min(1),
  ruleType: z.enum([
    "buffer_before", "buffer_after",
    "daily_limit", "weekly_limit", "monthly_limit",
    "min_notice_hours", "max_future_days",
  ]),
  ruleValue: z.number().int().min(1),
});

export type AvailabilityRuleInput = z.infer<typeof availabilityRuleSchema>;
export type SetAvailabilityRulesInput = z.infer<typeof setAvailabilityRulesSchema>;
export type ScheduleRuleInput = z.infer<typeof scheduleRuleSchema>;
