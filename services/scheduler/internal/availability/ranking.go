package availability

import (
	"math"
	"sort"
	"time"
)

// RankGoal defines the sorting strategy for time slots.
type RankGoal int

const (
	GoalCluster RankGoal = iota // Prefer slots near existing bookings (reduce fragmentation)
	GoalSpread                  // Prefer slots with maximum gap from existing bookings
)

// RankInput holds parameters for the ranking function.
type RankInput struct {
	Slots               []TimeSlot
	PreferredTimeRanges []PreferredRange
	Goal                RankGoal
	ExistingBookings    []BusySlot // Used for distance calculation in cluster/spread
}

// RankTimeSlots assigns ranks and sorts time slots according to the specified strategy.
// Slots that overlap with preferred time ranges receive RankPreferred.
// The sorting order depends on the goal: cluster groups near existing bookings, spread maximizes gaps.
func RankTimeSlots(input RankInput) []TimeSlot {
	if len(input.Slots) == 0 {
		return input.Slots
	}

	// 1. Assign preferred ranks based on preferred time ranges
	if len(input.PreferredTimeRanges) > 0 {
		applyRanking(input.Slots, input.PreferredTimeRanges)
	}

	// 2. Sort according to the goal strategy
	switch input.Goal {
	case GoalCluster:
		sortByCluster(input.Slots, input.ExistingBookings)
	case GoalSpread:
		sortBySpread(input.Slots, input.ExistingBookings)
	default:
		// Default: sort by time ascending
		sortByTime(input.Slots)
	}

	return input.Slots
}

// sortByCluster sorts slots so that those near existing bookings come first.
// This minimizes calendar fragmentation by grouping bookings together.
func sortByCluster(slots []TimeSlot, existing []BusySlot) {
	if len(existing) == 0 {
		sortByTime(slots)
		return
	}

	// Calculate distance from each slot to the nearest existing booking
	distances := make([]float64, len(slots))
	for i, s := range slots {
		distances[i] = minDistanceToBookings(s.Start, s.End, existing)
	}

	sort.Slice(slots, func(i, j int) bool {
		// Primary: distance to existing bookings (closer = first)
		if math.Abs(distances[i]-distances[j]) > 1.0 { // 1 minute threshold
			return distances[i] < distances[j]
		}
		// Secondary: preferred slots first
		if slots[i].Rank != slots[j].Rank {
			return slots[i].Rank == RankPreferred
		}
		// Tertiary: time ascending
		return slots[i].Start.Before(slots[j].Start)
	})
}

// sortBySpread sorts slots so that those with maximum gap from other slots come first.
// This distributes meetings evenly across the day.
func sortBySpread(slots []TimeSlot, existing []BusySlot) {
	if len(existing) == 0 {
		// No existing bookings — prefer middle of available ranges
		sortByTime(slots)
		return
	}

	// Calculate the minimum gap from each slot to any existing booking
	gaps := make([]float64, len(slots))
	for i, s := range slots {
		gaps[i] = minDistanceToBookings(s.Start, s.End, existing)
	}

	sort.Slice(slots, func(i, j int) bool {
		// Primary: larger gap = first (spread out)
		if math.Abs(gaps[i]-gaps[j]) > 1.0 {
			return gaps[i] > gaps[j]
		}
		// Secondary: preferred slots first
		if slots[i].Rank != slots[j].Rank {
			return slots[i].Rank == RankPreferred
		}
		// Tertiary: time ascending
		return slots[i].Start.Before(slots[j].Start)
	})
}

// minDistanceToBookings returns the minimum time distance (in minutes) from a slot to any existing booking.
// Returns a large number if there are no bookings.
func minDistanceToBookings(start, end time.Time, bookings []BusySlot) float64 {
	if len(bookings) == 0 {
		return math.MaxFloat64
	}

	minDist := math.MaxFloat64
	slotMid := start.Add(end.Sub(start) / 2)

	for _, b := range bookings {
		var dist float64

		if slotMid.Before(b.Start) {
			// Slot is before the booking
			dist = b.Start.Sub(slotMid).Minutes()
		} else if slotMid.After(b.End) {
			// Slot is after the booking
			dist = slotMid.Sub(b.End).Minutes()
		} else {
			// Slot overlaps with the booking (shouldn't happen with filtered slots)
			dist = 0
		}

		if dist < minDist {
			minDist = dist
		}
	}

	return minDist
}

// sortByTime sorts slots by start time ascending.
func sortByTime(slots []TimeSlot) {
	sort.Slice(slots, func(i, j int) bool {
		if slots[i].Start.Equal(slots[j].Start) {
			return slots[i].Rank == RankPreferred
		}
		return slots[i].Start.Before(slots[j].Start)
	})
}
