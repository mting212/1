package integration

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/meetflow/scheduler/internal"
	"github.com/meetflow/scheduler/internal/booking"
	schedulerv1 "github.com/meetflow/scheduler/proto/scheduler/v1"
)

var utc = time.UTC

// Use a future Monday to avoid MinNoticeHours filtering (2026-07-06 = Monday)
func monday() time.Time {
	return time.Date(2026, 7, 6, 0, 0, 0, 0, utc)
}

func setupHandler() *internal.SchedulerHandler {
	store := booking.NewInMemoryStore()
	svc := booking.NewBookingService(store)
	return internal.NewSchedulerHandler(svc)
}

// TestGetAvailability_WithSeedData verifies availability with default weekday rules.
func TestGetAvailability_WithSeedData(t *testing.T) {
	handler := setupHandler()

	windowStart := monday().Format(time.RFC3339)
	windowEnd := monday().Add(7 * 24 * time.Hour).Format(time.RFC3339)

	resp, err := handler.GetAvailability(context.Background(), &schedulerv1.GetAvailabilityRequest{
		ScheduleLinkId: "test-link",
		WindowStart:    windowStart,
		WindowEnd:      windowEnd,
	})

	if err != nil {
		t.Fatalf("GetAvailability failed: %v", err)
	}
	if len(resp.Slots) == 0 {
		t.Fatal("expected non-empty slots for Mon-Fri 9-5 window")
	}

	// Should return slots for 5 weekdays
	weekdays := make(map[time.Weekday]int)
	for _, s := range resp.Slots {
		tm, _ := time.Parse(time.RFC3339, s.Start)
		weekdays[tm.Weekday()]++
	}
	for _, d := range []time.Weekday{time.Monday, time.Tuesday, time.Wednesday, time.Thursday, time.Friday} {
		if weekdays[d] == 0 {
			t.Errorf("expected slots on %v, got none", d)
		}
	}
	if weekdays[time.Saturday] > 0 || weekdays[time.Sunday] > 0 {
		t.Error("unexpected weekend slots")
	}

	// Preferred slots should exist (Tue/Wed/Thu 10:00-12:00)
	prefCount := 0
	for _, s := range resp.Slots {
		if s.Rank == schedulerv1.SlotRank_SLOT_RANK_PREFERRED {
			prefCount++
		}
	}
	if prefCount == 0 {
		t.Error("expected some PREFERRED slots (Tue-Thu 10-12 range)")
	}
}

// TestCreateBooking_FullFlow tests booking creation and subsequent availability refresh.
func TestCreateBooking_FullFlow(t *testing.T) {
	handler := setupHandler()

	// Book a Wednesday 10:00-10:30 slot
	startTime := time.Date(2026, 7, 8, 10, 0, 0, 0, utc).Format(time.RFC3339)
	endTime := time.Date(2026, 7, 8, 10, 30, 0, 0, utc).Format(time.RFC3339)

	resp, err := handler.CreateBooking(context.Background(), &schedulerv1.CreateBookingRequest{
		ScheduleLinkId:   "test-link",
		StartTime:        startTime,
		EndTime:          endTime,
		AttendeeName:     "Alice",
		AttendeeEmail:    "alice@example.com",
		AttendeeTimezone: "UTC",
	})

	if err != nil {
		t.Fatalf("CreateBooking failed: %v", err)
	}
	if resp.Status != schedulerv1.BookingStatus_BOOKING_STATUS_CONFIRMED {
		t.Fatalf("expected CONFIRMED, got %v", resp.Status)
	}
	if resp.BookingId == "" {
		t.Fatal("expected non-empty booking ID")
	}

	// Now check availability — the booked slot should be unavailable
	availResp, err := handler.GetAvailability(context.Background(), &schedulerv1.GetAvailabilityRequest{
		ScheduleLinkId: "test-link",
		WindowStart:    monday().Format(time.RFC3339),
		WindowEnd:      monday().Add(7 * 24 * time.Hour).Format(time.RFC3339),
	})
	if err != nil {
		t.Fatalf("GetAvailability after booking failed: %v", err)
	}

	// Check that Wednesday 10:00-10:30 is no longer available
	for _, s := range availResp.Slots {
		tm, _ := time.Parse(time.RFC3339, s.Start)
		if tm.Weekday() == time.Wednesday && tm.Hour() == 10 && tm.Minute() == 0 {
			t.Error("booked slot should not appear in availability")
		}
	}
}

// TestCreateBooking_Concurrent verifies that 20 concurrent booking attempts
// for the same slot result in exactly 1 success.
func TestCreateBooking_Concurrent(t *testing.T) {
	handler := setupHandler()

	var wg sync.WaitGroup
	results := make(chan bool, 20)

	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			resp, err := handler.CreateBooking(context.Background(), &schedulerv1.CreateBookingRequest{
				ScheduleLinkId:   "test-link",
				StartTime:        time.Date(2026, 7, 8, 14, 0, 0, 0, utc).Format(time.RFC3339),
				EndTime:          time.Date(2026, 7, 8, 14, 30, 0, 0, utc).Format(time.RFC3339),
				AttendeeName:     "Concurrent",
				AttendeeEmail:    "concurrent@example.com",
				AttendeeTimezone: "UTC",
			})
			results <- (err == nil && resp.Status == schedulerv1.BookingStatus_BOOKING_STATUS_CONFIRMED)
		}()
	}

	wg.Wait()
	close(results)

	successCount := 0
	for ok := range results {
		if ok {
			successCount++
		}
	}

	if successCount != 1 {
		t.Errorf("expected exactly 1 successful booking from 20 concurrent attempts, got %d", successCount)
	}
}

// TestCancelBooking_ReleasesSlot verifies that cancelling a booking frees the slot.
func TestCancelBooking_ReleasesSlot(t *testing.T) {
	handler := setupHandler()

	// Create a booking
	startTime := time.Date(2026, 7, 8, 14, 0, 0, 0, utc).Format(time.RFC3339)
	endTime := time.Date(2026, 7, 8, 14, 30, 0, 0, utc).Format(time.RFC3339)

	resp, err := handler.CreateBooking(context.Background(), &schedulerv1.CreateBookingRequest{
		ScheduleLinkId:   "test-link",
		StartTime:        startTime,
		EndTime:          endTime,
		AttendeeName:     "Bob",
		AttendeeEmail:    "bob@example.com",
		AttendeeTimezone: "UTC",
	})
	if err != nil {
		t.Fatalf("CreateBooking failed: %v", err)
	}

	// Cancel it
	cancelResp, err := handler.CancelBooking(context.Background(), &schedulerv1.CancelBookingRequest{
		BookingId: resp.BookingId,
	})
	if err != nil {
		t.Fatalf("CancelBooking failed: %v", err)
	}
	if !cancelResp.Success {
		t.Fatal("expected cancel success")
	}

	// Check availability — slot should be available again
	availResp, err := handler.GetAvailability(context.Background(), &schedulerv1.GetAvailabilityRequest{
		ScheduleLinkId: "test-link",
		WindowStart:    monday().Format(time.RFC3339),
		WindowEnd:      monday().Add(7 * 24 * time.Hour).Format(time.RFC3339),
	})
	if err != nil {
		t.Fatalf("GetAvailability after cancel failed: %v", err)
	}

	found := false
	for _, s := range availResp.Slots {
		tm, _ := time.Parse(time.RFC3339, s.Start)
		if tm.Weekday() == time.Wednesday && tm.Hour() == 14 && tm.Minute() == 0 {
			found = true
			break
		}
	}
	if !found {
		t.Error("cancelled slot should be available again")
	}
}
