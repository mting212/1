package availability

import (
	"sort"
	"time"
)

// AvailabilityRule represents a weekly recurring time range.
type AvailabilityRule struct {
	DayOfWeek time.Weekday
	StartTime ClockTime
	EndTime   ClockTime
}

// ClockTime is an hour:minute time of day (no date component).
type ClockTime struct {
	Hour   int
	Minute int
}

// BusySlot represents a time range that is already occupied.
type BusySlot struct {
	Start time.Time
	End   time.Time
}

// TimeSlot is an available time range with a rank.
type TimeSlot struct {
	Start time.Time
	End   time.Time
	Rank  SlotRank
}

// SlotRank indicates whether a slot is preferred or just available.
type SlotRank int

const (
	RankAvailable SlotRank = iota
	RankPreferred
)

// CalculateInput holds all parameters for the availability calculation.
type CalculateInput struct {
	Rules                  []AvailabilityRule
	BusySlots              []BusySlot
	WindowStart            time.Time
	WindowEnd              time.Time
	BufferBeforeMinutes    int
	BufferAfterMinutes     int
	DailyLimit             int // 0 means no limit
	WeeklyLimit            int // 0 means no limit
	MinNoticeHours         int // minimum hours before a slot can be booked
	SlotDurationMinutes    int
	ExistingBookingCounts  map[string]int // key: "2006-01-02" for daily, "2006-W02" for weekly
	PreferredTimeRanges    []PreferredRange
}

// PreferredRange defines a time range that should be ranked higher.
type PreferredRange struct {
	DayOfWeek time.Weekday
	StartTime ClockTime
	EndTime   ClockTime
}

// CalculateAvailability computes all available time slots given the constraints.
// This is a pure function with no side effects.
func CalculateAvailability(input CalculateInput) []TimeSlot {
	if input.SlotDurationMinutes <= 0 {
		input.SlotDurationMinutes = 30
	}

	// 1. Expand weekly rules into concrete time slots within the window
	allSlots := expandRules(input)

	// 2. Subtract busy slots (including buffer expansion)
	bufferedBusy := expandBusyWithBuffers(input.BusySlots, input.BufferBeforeMinutes, input.BufferAfterMinutes)
	allSlots = subtractBusy(allSlots, bufferedBusy)

	// 3. Remove slots within minimum notice period (only if MinNoticeHours > 0)
	if input.MinNoticeHours > 0 {
		now := time.Now().UTC()
		minimumStart := now.Add(time.Duration(input.MinNoticeHours) * time.Hour)
		allSlots = filterAfter(allSlots, minimumStart)
	}

	// 4. Enforce daily and weekly limits
	if input.DailyLimit > 0 || input.WeeklyLimit > 0 {
		allSlots = applyLimits(allSlots, input.DailyLimit, input.WeeklyLimit, input.ExistingBookingCounts)
	}

	// 5. Assign ranks based on preferred time ranges
	if len(input.PreferredTimeRanges) > 0 {
		allSlots = applyRanking(allSlots, input.PreferredTimeRanges)
	}

	// Sort by time
	sort.Slice(allSlots, func(i, j int) bool {
		return allSlots[i].Start.Before(allSlots[j].Start)
	})

	return allSlots
}

// expandRules converts weekly availability rules into concrete TimeSlots within the window.
func expandRules(input CalculateInput) []TimeSlot {
	var slots []TimeSlot
	duration := time.Duration(input.SlotDurationMinutes) * time.Minute
	loc := input.WindowStart.Location()

	// Walk day by day through the window
	dayCursor := time.Date(input.WindowStart.Year(), input.WindowStart.Month(), input.WindowStart.Day(), 0, 0, 0, 0, loc)
	windowEndDay := time.Date(input.WindowEnd.Year(), input.WindowEnd.Month(), input.WindowEnd.Day(), 0, 0, 0, 0, loc)
	if !input.WindowEnd.Equal(windowEndDay) {
		windowEndDay = windowEndDay.Add(24 * time.Hour)
	}

	for dayCursor.Before(windowEndDay) {
		weekday := dayCursor.Weekday()

		for _, rule := range input.Rules {
			if weekday != rule.DayOfWeek {
				continue
			}

			dayStart := time.Date(dayCursor.Year(), dayCursor.Month(), dayCursor.Day(),
				rule.StartTime.Hour, rule.StartTime.Minute, 0, 0, loc)

			dayEndTime := time.Date(dayCursor.Year(), dayCursor.Month(), dayCursor.Day(),
				rule.EndTime.Hour, rule.EndTime.Minute, 0, 0, loc)

			slotStart := dayStart
			for slotStart.Add(duration).Before(dayEndTime) || slotStart.Add(duration).Equal(dayEndTime) {
				slotEnd := slotStart.Add(duration)
				if !slotEnd.After(input.WindowEnd) && !slotStart.Before(input.WindowStart) {
					slots = append(slots, TimeSlot{
						Start: slotStart,
						End:   slotEnd,
						Rank:  RankAvailable,
					})
				}
				slotStart = slotEnd
			}
		}

		dayCursor = dayCursor.Add(24 * time.Hour)
	}

	return slots
}

// expandBusyWithBuffers adds buffer time around busy slots.
func expandBusyWithBuffers(busy []BusySlot, beforeMin, afterMin int) []BusySlot {
	if beforeMin == 0 && afterMin == 0 {
		return busy
	}

	expanded := make([]BusySlot, len(busy))
	before := time.Duration(beforeMin) * time.Minute
	after := time.Duration(afterMin) * time.Minute

	for i, b := range busy {
		expanded[i] = BusySlot{
			Start: b.Start.Add(-before),
			End:   b.End.Add(after),
		}
	}
	return expanded
}

// subtractBusy removes busy time ranges from the slot list.
func subtractBusy(slots []TimeSlot, busy []BusySlot) []TimeSlot {
	if len(busy) == 0 {
		return slots
	}

	var result []TimeSlot
	for _, slot := range slots {
		blocked := false
		for _, b := range busy {
			if overlaps(slot.Start, slot.End, b.Start, b.End) {
				blocked = true
				break
			}
		}
		if !blocked {
			result = append(result, slot)
		}
	}
	return result
}

// overlaps returns true if two time ranges overlap (exclusive end bound).
func overlaps(start1, end1, start2, end2 time.Time) bool {
	return start1.Before(end2) && start2.Before(end1)
}

// filterAfter removes slots starting before the given time.
func filterAfter(slots []TimeSlot, minimumStart time.Time) []TimeSlot {
	var result []TimeSlot
	for _, s := range slots {
		if !s.Start.Before(minimumStart) {
			result = append(result, s)
		}
	}
	return result
}

// applyLimits enforces daily and weekly booking limits.
func applyLimits(slots []TimeSlot, dailyLimit, weeklyLimit int, counts map[string]int) []TimeSlot {
	if counts == nil {
		counts = make(map[string]int)
	}

	dailyUsed := make(map[string]int)
	weeklyUsed := make(map[string]int)

	// Copy existing counts
	for k, v := range counts {
		if len(k) == 10 { // "2006-01-02"
			dailyUsed[k] = v
		} else { // weekly format
			weeklyUsed[k] = v
		}
	}

	var result []TimeSlot
	for _, s := range slots {
		dayKey := s.Start.Format("2006-01-02")
		year, week := s.Start.ISOWeek()
		weekKey := formatWeekKey(year, week)

		if dailyLimit > 0 && dailyUsed[dayKey] >= dailyLimit {
			continue
		}
		if weeklyLimit > 0 && weeklyUsed[weekKey] >= weeklyLimit {
			continue
		}

		dailyUsed[dayKey]++
		weeklyUsed[weekKey]++
		result = append(result, s)
	}

	return result
}

// applyRanking assigns preferred rank to slots that overlap with preferred ranges.
func applyRanking(slots []TimeSlot, preferred []PreferredRange) []TimeSlot {
	for i := range slots {
		for _, pr := range preferred {
			if slots[i].Start.Weekday() != pr.DayOfWeek {
				continue
			}
			slotTime := ClockTime{slots[i].Start.Hour(), slots[i].Start.Minute()}
			if clockTimeGTE(slotTime, pr.StartTime) && clockTimeLTE(slotTime, pr.EndTime) {
				slots[i].Rank = RankPreferred
				break
			}
		}
	}
	return slots
}

// formatWeekKey creates a sortable week key string.
func formatWeekKey(year, week int) string {
	// "2006-W02" format
	return time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC).
		AddDate(0, 0, (week-1)*7).
		Format("2006") + "-W" + padInt(week)
}

func padInt(n int) string {
	if n < 10 {
		return "0" + string(rune('0'+n))
	}
	return string(rune('0'+n/10)) + string(rune('0'+n%10))
}

func clockTimeGTE(a, b ClockTime) bool {
	if a.Hour > b.Hour {
		return true
	}
	if a.Hour == b.Hour && a.Minute >= b.Minute {
		return true
	}
	return false
}

func clockTimeLTE(a, b ClockTime) bool {
	if a.Hour < b.Hour {
		return true
	}
	if a.Hour == b.Hour && a.Minute <= b.Minute {
		return true
	}
	return false
}
