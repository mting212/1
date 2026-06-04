package booking

import (
	"time"

	"github.com/meetflow/scheduler/internal/availability"
)

// BookingRecord represents a confirmed booking in the system.
type BookingRecord struct {
	ID             string
	ScheduleLinkID string
	StartTime      time.Time
	EndTime        time.Time
	Status         string // "confirmed", "cancelled", "rescheduled"
}

// ConflictResult describes a booking conflict.
type ConflictResult struct {
	HasConflict      bool
	ConflictingID    string
	ConflictingStart time.Time
	ConflictingEnd   time.Time
}

// CheckConflict determines whether a candidate time slot overlaps with any
// existing non-cancelled booking for the same schedule link.
// This is a pure function with no side effects.
func CheckConflict(
	scheduleLinkID string,
	startTime time.Time,
	endTime time.Time,
	existingBookings []BookingRecord,
) ConflictResult {
	for _, b := range existingBookings {
		if b.ScheduleLinkID != scheduleLinkID {
			continue
		}
		if b.Status == "cancelled" {
			continue
		}
		if overlaps(startTime, endTime, b.StartTime, b.EndTime) {
			return ConflictResult{
				HasConflict:      true,
				ConflictingID:    b.ID,
				ConflictingStart: b.StartTime,
				ConflictingEnd:   b.EndTime,
			}
		}
	}
	return ConflictResult{HasConflict: false}
}

// overlaps returns true if two time ranges overlap.
// Uses exclusive end bound semantics: [start1, end1) overlaps [start2, end2)
// if start1 < end2 AND start2 < end1.
func overlaps(start1, end1, start2, end2 time.Time) bool {
	return start1.Before(end2) && start2.Before(end1)
}

// BusySlotFromBooking converts a booking record to a busy slot for the availability engine.
func BusySlotFromBooking(b BookingRecord) availability.BusySlot {
	return availability.BusySlot{
		Start: b.StartTime,
		End:   b.EndTime,
	}
}

// BusySlotsFromBookings converts multiple booking records to busy slots.
func BusySlotsFromBookings(bookings []BookingRecord) []availability.BusySlot {
	slots := make([]availability.BusySlot, 0, len(bookings))
	for _, b := range bookings {
		if b.Status != "cancelled" {
			slots = append(slots, BusySlotFromBooking(b))
		}
	}
	return slots
}
