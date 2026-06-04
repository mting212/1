package availability

import (
	"testing"
	"time"
)

func TestRankTimeSlots_AllAvailableWithoutPreferred(t *testing.T) {
	// Slots on Wednesday, no preferred ranges → all should be RankAvailable
	slots := []TimeSlot{
		{Start: wednesdayAt(9, 0), End: wednesdayAt(9, 30), Rank: RankAvailable},
		{Start: wednesdayAt(10, 0), End: wednesdayAt(10, 30), Rank: RankAvailable},
		{Start: wednesdayAt(11, 0), End: wednesdayAt(11, 30), Rank: RankAvailable},
	}

	input := RankInput{
		Slots:               slots,
		PreferredTimeRanges: nil,
		Goal:                GoalCluster,
	}

	result := RankTimeSlots(input)

	for i, s := range result {
		if s.Rank != RankAvailable {
			t.Errorf("slot %d: expected RankAvailable, got %v", i, s.Rank)
		}
	}
	if len(result) != 3 {
		t.Errorf("expected 3 slots, got %d", len(result))
	}
}

func TestRankTimeSlots_PreferredRange(t *testing.T) {
	// Mark 10:00-11:00 as preferred
	slots := []TimeSlot{
		{Start: wednesdayAt(9, 0), End: wednesdayAt(9, 30), Rank: RankAvailable},
		{Start: wednesdayAt(10, 0), End: wednesdayAt(10, 30), Rank: RankAvailable},
		{Start: wednesdayAt(14, 0), End: wednesdayAt(14, 30), Rank: RankAvailable},
	}

	input := RankInput{
		Slots: slots,
		PreferredTimeRanges: []PreferredRange{
			{DayOfWeek: time.Wednesday, StartTime: ClockTime{10, 0}, EndTime: ClockTime{11, 0}},
		},
		Goal: GoalCluster,
	}

	result := RankTimeSlots(input)

	// 10:00 slot should be preferred
	for _, s := range result {
		if s.Start.Hour() == 10 && s.Start.Minute() == 0 {
			if s.Rank != RankPreferred {
				t.Errorf("10:00 slot should be PREFERRED, got %v", s.Rank)
			}
		} else {
			if s.Rank != RankAvailable {
				t.Errorf("slot at %v should remain AVAILABLE, got %v", s.Start, s.Rank)
			}
		}
	}
}

func TestRankTimeSlots_ClusterMode(t *testing.T) {
	// Existing booking at Wednesday 10:00-10:30
	// Slots at 9:30, 10:30 (near) and 15:00 (far)
	// Cluster mode: near slots first
	slots := []TimeSlot{
		{Start: wednesdayAt(15, 0), End: wednesdayAt(15, 30), Rank: RankAvailable},
		{Start: wednesdayAt(9, 30), End: wednesdayAt(10, 0), Rank: RankAvailable},
		{Start: wednesdayAt(10, 30), End: wednesdayAt(11, 0), Rank: RankAvailable},
	}

	input := RankInput{
		Slots: slots,
		Goal:  GoalCluster,
		ExistingBookings: []BusySlot{
			{Start: wednesdayAt(10, 0), End: wednesdayAt(10, 30)},
		},
	}

	result := RankTimeSlots(input)

	if len(result) != 3 {
		t.Fatalf("expected 3 slots, got %d", len(result))
	}

	// 9:30 (distance 0.5h) and 10:30 (distance 0h) should come before 15:00 (distance 4.5h)
	if result[0].Start.Hour() == 15 {
		t.Errorf("cluster mode: far slot (15:00) should not be first. Got %v, %v, %v",
			result[0].Start, result[1].Start, result[2].Start)
	}

	// Nearest slots should be first two
	nearHours := []int{result[0].Start.Hour(), result[1].Start.Hour()}
	if !containsInt(nearHours, 9) || !containsInt(nearHours, 10) {
		t.Errorf("expected 9:30 and 10:30 first, got %v and %v", result[0].Start, result[1].Start)
	}
}

func TestRankTimeSlots_EmptyList(t *testing.T) {
	input := RankInput{
		Slots: []TimeSlot{},
		Goal:  GoalCluster,
	}

	result := RankTimeSlots(input)

	if len(result) != 0 {
		t.Errorf("expected empty result, got %d slots", len(result))
	}
}

func TestRankTimeSlots_SpreadMode(t *testing.T) {
	// Existing booking at Wednesday 10:00-10:30
	// Slots at 9:30 (near), 14:00 (far), 16:00 (very far)
	// Spread mode: far slots first
	slots := []TimeSlot{
		{Start: wednesdayAt(9, 30), End: wednesdayAt(10, 0), Rank: RankAvailable},
		{Start: wednesdayAt(14, 0), End: wednesdayAt(14, 30), Rank: RankAvailable},
		{Start: wednesdayAt(16, 0), End: wednesdayAt(16, 30), Rank: RankAvailable},
	}

	input := RankInput{
		Slots: slots,
		Goal:  GoalSpread,
		ExistingBookings: []BusySlot{
			{Start: wednesdayAt(10, 0), End: wednesdayAt(10, 30)},
		},
	}

	result := RankTimeSlots(input)

	if len(result) != 3 {
		t.Fatalf("expected 3 slots, got %d", len(result))
	}

	// Spread mode: 16:00 should be before 9:30 (16:00 is farther from the 10:00 booking)
	// 16:00: distance to 10:00 = 5.5h (midpoint 16:15 to mid 10:15 = 6h minus... wait let me just check)
	// Actually, 16:00-16:30 midpoint = 16:15, booking 10:00-10:30 midpoint = 10:15
	// 16:15 - 10:15 = 6 hours = 360 minutes
	// 14:00-14:30 midpoint = 14:15, 14:15 - 10:15 = 4 hours = 240 minutes
	// 9:30-10:00 midpoint = 9:45, 10:15 - 9:45 = 0.5 hours = 30 minutes
	// So order should be: 16:00 (360min), 14:00 (240min), 9:30 (30min)
	if result[0].Start.Hour() != 16 {
		t.Errorf("spread mode: expected 16:00 first (farthest), got %v", result[0].Start)
	}
	if result[2].Start.Hour() != 9 {
		t.Errorf("spread mode: expected 9:30 last (nearest), got %v", result[2].Start)
	}
}

func containsInt(s []int, v int) bool {
	for _, x := range s {
		if x == v {
			return true
		}
	}
	return false
}
