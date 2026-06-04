package availability

import (
	"testing"
	"time"
)

var utc = time.UTC

// mondayAt returns a time.Time for a Monday at the given hour in UTC.
// Uses 2026-06-01 (Monday) as the base.
func mondayAt(hour, minute int) time.Time {
	return time.Date(2026, 6, 1, hour, minute, 0, 0, utc)
}

func tuesdayAt(hour, minute int) time.Time {
	return time.Date(2026, 6, 2, hour, minute, 0, 0, utc)
}

func wednesdayAt(hour, minute int) time.Time {
	return time.Date(2026, 6, 3, hour, minute, 0, 0, utc)
}

func thursdayAt(hour, minute int) time.Time {
	return time.Date(2026, 6, 4, hour, minute, 0, 0, utc)
}

func fridayAt(hour, minute int) time.Time {
	return time.Date(2026, 6, 5, hour, minute, 0, 0, utc)
}

// jan1_2026 is a Thursday (DST not in effect).
func jan1At(hour, minute int) time.Time {
	return time.Date(2026, 1, 1, hour, minute, 0, 0, utc)
}

// weekdayRules returns Mon-Fri 9:00-17:00 rules.
func weekdayRules() []AvailabilityRule {
	return []AvailabilityRule{
		{DayOfWeek: time.Monday, StartTime: ClockTime{9, 0}, EndTime: ClockTime{17, 0}},
		{DayOfWeek: time.Tuesday, StartTime: ClockTime{9, 0}, EndTime: ClockTime{17, 0}},
		{DayOfWeek: time.Wednesday, StartTime: ClockTime{9, 0}, EndTime: ClockTime{17, 0}},
		{DayOfWeek: time.Thursday, StartTime: ClockTime{9, 0}, EndTime: ClockTime{17, 0}},
		{DayOfWeek: time.Friday, StartTime: ClockTime{9, 0}, EndTime: ClockTime{17, 0}},
	}
}

func defaultInput() CalculateInput {
	return CalculateInput{
		Rules:               weekdayRules(),
		WindowStart:         mondayAt(0, 0),
		WindowEnd:           mondayAt(0, 0).Add(7 * 24 * time.Hour), // Mon-Sun
		SlotDurationMinutes: 30,
	}
}

func TestCalculateAvailability_EmptyCalendarAllAvailable(t *testing.T) {
	input := defaultInput()
	slots := CalculateAvailability(input)

	// 5 days * 8 hours/day / 0.5 hour = 5 * 16 = 80 slots
	expected := 5 * 16
	if len(slots) != expected {
		t.Errorf("expected %d slots, got %d", expected, len(slots))
	}

	// Verify all slots are RankAvailable
	for i, s := range slots {
		if s.Rank != RankAvailable {
			t.Errorf("slot %d: expected RankAvailable, got %v", i, s.Rank)
		}
	}
}

func TestCalculateAvailability_SingleBusySlot(t *testing.T) {
	input := defaultInput()
	// Block Wednesday 10:00-11:00
	input.BusySlots = []BusySlot{
		{Start: wednesdayAt(10, 0), End: wednesdayAt(11, 0)},
	}

	slots := CalculateAvailability(input)

	// Check that the 10:00 and 10:30 slots on Wednesday are removed
	for _, s := range slots {
		if s.Start.Weekday() == time.Wednesday &&
			s.Start.Hour() == 10 {
			t.Errorf("expected Wednesday 10:00-11:00 to be blocked, but found slot at %v", s.Start)
		}
	}

	// Should have lost 2 slots (10:00-10:30 and 10:30-11:00)
	expected := 5*16 - 2
	if len(slots) != expected {
		t.Errorf("expected %d slots after blocking, got %d", expected, len(slots))
	}
}

func TestCalculateAvailability_BufferTime(t *testing.T) {
	input := defaultInput()
	input.BufferBeforeMinutes = 15
	input.BufferAfterMinutes = 10

	// Place a booking at 10:00-10:30
	input.BusySlots = []BusySlot{
		{Start: wednesdayAt(10, 0), End: wednesdayAt(10, 30)},
	}

	slots := CalculateAvailability(input)

	// With buffer: busy expands from 9:45 to 10:40
	// So 9:30-10:00 and 10:00-10:30 are blocked (9:30 crosses into buffer)
	for _, s := range slots {
		if s.Start.Weekday() == time.Wednesday {
			if s.Start.Equal(wednesdayAt(9, 30)) {
				t.Errorf("9:30-10:00 should be blocked by buffer_before (expands to 9:45)")
			}
			if s.Start.Equal(wednesdayAt(10, 0)) {
				t.Errorf("10:00-10:30 should be blocked (busy)")
			}
			if s.Start.Equal(wednesdayAt(10, 30)) {
				t.Errorf("10:30-11:00 should be blocked by buffer_after (expands to 10:40)")
			}
		}
	}
}

func TestCalculateAvailability_MinNoticeHours(t *testing.T) {
	input := defaultInput()
	// Set min notice to 2 hours from now
	input.MinNoticeHours = 2

	// Make "now" be Wednesday 8:00 UTC — slots before 10:00 should be removed
	// We need to work with the actual now, so instead we'll place the window such
	// that some slots are within the notice period.

	// Simulate a window starting "now + 1 hour"
	now := time.Now().UTC()
	input.WindowStart = now
	input.WindowEnd = now.Add(24 * time.Hour)

	// Only use today's weekday rules
	today := now.Weekday()
	input.Rules = []AvailabilityRule{
		{DayOfWeek: today, StartTime: ClockTime{0, 0}, EndTime: ClockTime{23, 30}},
	}

	slots := CalculateAvailability(input)
	minimumStart := now.Add(2 * time.Hour)

	for _, s := range slots {
		if s.Start.Before(minimumStart) {
			t.Errorf("slot at %v is before minimum start %v", s.Start, minimumStart)
		}
	}
}

func TestCalculateAvailability_DailyLimit(t *testing.T) {
	input := defaultInput()
	input.DailyLimit = 3

	// Monday already has 3 bookings
	input.ExistingBookingCounts = map[string]int{
		"2026-06-01": 3, // Monday
	}

	slots := CalculateAvailability(input)

	// Monday should return 0 slots, Tue-Fri should have 16 each
	for _, s := range slots {
		if s.Start.Weekday() == time.Monday {
			t.Errorf("Monday should be fully blocked by daily limit, but found slot at %v", s.Start)
		}
	}

	// Tue-Fri: 4 days * 3 slots (daily limit) = 12
	expected := 4 * 3
	if len(slots) != expected {
		t.Errorf("expected %d slots (Monday blocked + 3/day limit), got %d", expected, len(slots))
	}
}

func TestCalculateAvailability_WeeklyLimit(t *testing.T) {
	input := defaultInput()
	input.WeeklyLimit = 10

	// Already 10 bookings this week
	year, week := mondayAt(0, 0).ISOWeek()
	weekKey := formatWeekKey(year, week)
	input.ExistingBookingCounts = map[string]int{
		weekKey: 10,
	}

	slots := CalculateAvailability(input)

	if len(slots) != 0 {
		t.Errorf("expected 0 slots (weekly limit reached), got %d", len(slots))
	}
}

func TestCalculateAvailability_NoRuleDays(t *testing.T) {
	// Only Mon-Wed rules
	input := CalculateInput{
		Rules: []AvailabilityRule{
			{DayOfWeek: time.Monday, StartTime: ClockTime{9, 0}, EndTime: ClockTime{17, 0}},
			{DayOfWeek: time.Tuesday, StartTime: ClockTime{9, 0}, EndTime: ClockTime{17, 0}},
			{DayOfWeek: time.Wednesday, StartTime: ClockTime{9, 0}, EndTime: ClockTime{17, 0}},
		},
		WindowStart:         mondayAt(0, 0),
		WindowEnd:           mondayAt(0, 0).Add(7 * 24 * time.Hour),
		SlotDurationMinutes: 30,
	}

	slots := CalculateAvailability(input)

	// 3 days * 16 slots = 48
	expected := 3 * 16
	if len(slots) != expected {
		t.Errorf("expected %d slots (Mon-Wed only), got %d", expected, len(slots))
	}

	// Verify no Thursday or Friday slots
	for _, s := range slots {
		wd := s.Start.Weekday()
		if wd == time.Thursday || wd == time.Friday || wd == time.Saturday || wd == time.Sunday {
			t.Errorf("unexpected slot on %v: %v", wd, s.Start)
		}
	}
}

func TestCalculateAvailability_TimezoneConversion(t *testing.T) {
	// Rules defined in Asia/Shanghai timezone are expanded using the window's timezone.
	// Test using UTC window: rule times should be interpreted in the window's timezone.
	shanghai, _ := time.LoadLocation("Asia/Shanghai")

	input := CalculateInput{
		Rules: []AvailabilityRule{
			{DayOfWeek: time.Thursday, StartTime: ClockTime{9, 0}, EndTime: ClockTime{17, 0}},
		},
		// Window in Shanghai timezone
		WindowStart:         time.Date(2026, 1, 1, 0, 0, 0, 0, shanghai),
		WindowEnd:           time.Date(2026, 1, 2, 0, 0, 0, 0, shanghai),
		SlotDurationMinutes: 30,
	}

	slots := CalculateAvailability(input)

	// Jan 1 2026 is a Thursday. In Asia/Shanghai (UTC+8),
	// 9:00-17:00 CST = 1:00-9:00 UTC
	if len(slots) != 16 {
		t.Errorf("expected 16 slots (8 hours / 30min), got %d", len(slots))
	}

	// First slot should be at 9:00 Shanghai time = 1:00 UTC
	firstExpected := time.Date(2026, 1, 1, 9, 0, 0, 0, shanghai)
	if !slots[0].Start.Equal(firstExpected) {
		t.Errorf("first slot: expected %v, got %v", firstExpected, slots[0].Start)
	}
}

func TestCalculateAvailability_PreferredRanking(t *testing.T) {
	input := defaultInput()
	input.PreferredTimeRanges = []PreferredRange{
		{DayOfWeek: time.Wednesday, StartTime: ClockTime{10, 0}, EndTime: ClockTime{12, 0}},
	}

	slots := CalculateAvailability(input)

	for _, s := range slots {
		if s.Start.Weekday() == time.Wednesday &&
			s.Start.Hour() >= 10 && s.Start.Hour() < 12 {
			if s.Rank != RankPreferred {
				t.Errorf("Wednesday %v should be PREFERRED, got %v", s.Start, s.Rank)
			}
		}
	}
}

func TestCalculateAvailability_EmptyInput(t *testing.T) {
	input := CalculateInput{
		Rules:               []AvailabilityRule{},
		WindowStart:         mondayAt(0, 0),
		WindowEnd:           mondayAt(0, 0).Add(7 * 24 * time.Hour),
		SlotDurationMinutes: 30,
	}

	slots := CalculateAvailability(input)
	if len(slots) != 0 {
		t.Errorf("expected 0 slots with no rules, got %d", len(slots))
	}
}

func TestCalculateAvailability_NoPanicOnNil(t *testing.T) {
	input := CalculateInput{
		Rules:               weekdayRules(),
		WindowStart:         mondayAt(0, 0),
		WindowEnd:           mondayAt(0, 0).Add(7 * 24 * time.Hour),
		SlotDurationMinutes: 30,
		// BusySlots, PreferredTimeRanges, ExistingBookingCounts are nil
	}

	// Should not panic
	slots := CalculateAvailability(input)
	if len(slots) == 0 {
		t.Error("expected some slots even with nil optional fields")
	}
}
