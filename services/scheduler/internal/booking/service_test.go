package booking

import (
	"errors"
	"sync"
	"testing"
	"time"
)

var utc = time.UTC

func wedAt(h, m int) time.Time {
	return time.Date(2026, 6, 3, h, m, 0, 0, utc)
}

// --- Conflict Detection Tests ---

func TestCheckConflict_NoConflict(t *testing.T) {
	existing := []BookingRecord{
		{ID: "b1", ScheduleLinkID: "link1", StartTime: wedAt(10, 0), EndTime: wedAt(10, 30), Status: "confirmed"},
	}

	result := CheckConflict("link1", wedAt(11, 0), wedAt(11, 30), existing)
	if result.HasConflict {
		t.Errorf("expected no conflict, got conflict with %s", result.ConflictingID)
	}
}

func TestCheckConflict_ExactOverlap(t *testing.T) {
	existing := []BookingRecord{
		{ID: "b1", ScheduleLinkID: "link1", StartTime: wedAt(10, 0), EndTime: wedAt(10, 30), Status: "confirmed"},
	}

	result := CheckConflict("link1", wedAt(10, 0), wedAt(10, 30), existing)
	if !result.HasConflict {
		t.Error("expected conflict for exact overlap, got none")
	}
	if result.ConflictingID != "b1" {
		t.Errorf("expected conflict with b1, got %s", result.ConflictingID)
	}
}

func TestCheckConflict_PartialOverlapFront(t *testing.T) {
	existing := []BookingRecord{
		{ID: "b1", ScheduleLinkID: "link1", StartTime: wedAt(10, 0), EndTime: wedAt(10, 30), Status: "confirmed"},
	}
	result := CheckConflict("link1", wedAt(10, 15), wedAt(10, 45), existing)
	if !result.HasConflict {
		t.Error("expected conflict for partial overlap (front), got none")
	}
}

func TestCheckConflict_PartialOverlapBack(t *testing.T) {
	existing := []BookingRecord{
		{ID: "b1", ScheduleLinkID: "link1", StartTime: wedAt(10, 0), EndTime: wedAt(10, 30), Status: "confirmed"},
	}
	result := CheckConflict("link1", wedAt(9, 45), wedAt(10, 15), existing)
	if !result.HasConflict {
		t.Error("expected conflict for partial overlap (back), got none")
	}
}

func TestCheckConflict_Containment(t *testing.T) {
	existing := []BookingRecord{
		{ID: "b1", ScheduleLinkID: "link1", StartTime: wedAt(10, 0), EndTime: wedAt(11, 0), Status: "confirmed"},
	}
	result := CheckConflict("link1", wedAt(10, 15), wedAt(10, 45), existing)
	if !result.HasConflict {
		t.Error("expected conflict for containment, got none")
	}
}

func TestCheckConflict_BoundaryTouch_NoConflict(t *testing.T) {
	existing := []BookingRecord{
		{ID: "b1", ScheduleLinkID: "link1", StartTime: wedAt(10, 0), EndTime: wedAt(10, 30), Status: "confirmed"},
	}
	result := CheckConflict("link1", wedAt(10, 30), wedAt(11, 0), existing)
	if result.HasConflict {
		t.Error("boundary touch should not be a conflict, but got one")
	}
}

func TestCheckConflict_CancelledIgnored(t *testing.T) {
	existing := []BookingRecord{
		{ID: "b1", ScheduleLinkID: "link1", StartTime: wedAt(10, 0), EndTime: wedAt(10, 30), Status: "cancelled"},
	}
	result := CheckConflict("link1", wedAt(10, 0), wedAt(10, 30), existing)
	if result.HasConflict {
		t.Error("cancelled booking should not cause conflict")
	}
}

func TestCheckConflict_DifferentScheduleLink(t *testing.T) {
	existing := []BookingRecord{
		{ID: "b1", ScheduleLinkID: "link1", StartTime: wedAt(10, 0), EndTime: wedAt(10, 30), Status: "confirmed"},
	}
	result := CheckConflict("link2", wedAt(10, 0), wedAt(10, 30), existing)
	if result.HasConflict {
		t.Error("different schedule link should not cause conflict")
	}
}

// --- Booking Service Tests ---

func TestCreateBooking_Success(t *testing.T) {
	store := NewInMemoryStore()
	svc := NewBookingService(store)

	result, err := svc.CreateBooking(CreateBookingInput{
		ScheduleLinkID:   "link1",
		StartTime:        wedAt(10, 0),
		EndTime:          wedAt(10, 30),
		AttendeeName:     "Alice",
		AttendeeEmail:    "alice@example.com",
		AttendeeTimezone: "America/New_York",
	})

	if err != nil {
		t.Fatalf("expected booking to succeed, got error: %v", err)
	}
	if result.Status != "confirmed" {
		t.Errorf("expected status confirmed, got %s", result.Status)
	}
	if result.BookingID == "" {
		t.Error("expected non-empty booking ID")
	}

	bookings, _ := store.GetBookings("link1")
	if len(bookings) != 1 {
		t.Errorf("expected 1 booking, got %d", len(bookings))
	}
}

func TestCreateBooking_Conflict(t *testing.T) {
	store := NewInMemoryStore()
	store.AddBooking(BookingRecord{
		ID: "existing1", ScheduleLinkID: "link1",
		StartTime: wedAt(10, 0), EndTime: wedAt(10, 30),
		Status: "confirmed",
	})

	svc := NewBookingService(store)

	_, err := svc.CreateBooking(CreateBookingInput{
		ScheduleLinkID: "link1",
		StartTime:      wedAt(10, 0),
		EndTime:        wedAt(10, 30),
		AttendeeName:   "Bob",
		AttendeeEmail:  "bob@example.com",
	})

	if err == nil {
		t.Fatal("expected conflict error, got nil")
	}
	if !errors.Is(err, ErrConflict) {
		t.Errorf("expected ErrConflict, got %v", err)
	}
}

func TestCreateBooking_InvalidTimeRange(t *testing.T) {
	store := NewInMemoryStore()
	svc := NewBookingService(store)

	_, err := svc.CreateBooking(CreateBookingInput{
		ScheduleLinkID: "link1",
		StartTime:      wedAt(10, 30),
		EndTime:        wedAt(10, 0),
		AttendeeName:   "Charlie",
		AttendeeEmail:  "charlie@example.com",
	})

	if !errors.Is(err, ErrInvalidTimeRange) {
		t.Errorf("expected ErrInvalidTimeRange, got %v", err)
	}
}

func TestCreateBooking_ConcurrentSafety(t *testing.T) {
	store := NewInMemoryStore()
	svc := NewBookingService(store)

	var wg sync.WaitGroup
	results := make(chan error, 10)

	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := svc.CreateBooking(CreateBookingInput{
				ScheduleLinkID:   "link1",
				StartTime:        wedAt(10, 0),
				EndTime:          wedAt(10, 30),
				AttendeeName:     "Concurrent User",
				AttendeeEmail:    "concurrent@example.com",
				AttendeeTimezone: "UTC",
			})
			results <- err
		}()
	}

	wg.Wait()
	close(results)

	successCount := 0
	failCount := 0
	for err := range results {
		if err == nil {
			successCount++
		} else {
			failCount++
		}
	}

	if successCount != 1 {
		t.Errorf("expected exactly 1 successful booking, got %d", successCount)
	}
	if failCount != 9 {
		t.Errorf("expected 9 conflict failures, got %d", failCount)
	}

	bookings, _ := store.GetBookings("link1")
	if len(bookings) != 1 {
		t.Errorf("expected exactly 1 booking in store, got %d", len(bookings))
	}
}

func TestCreateBooking_Phase2Conflict(t *testing.T) {
	store := NewInMemoryStore()
	store.SimulatePhase2Conflict = true

	svc := NewBookingService(store)

	_, err := svc.CreateBooking(CreateBookingInput{
		ScheduleLinkID: "link1",
		StartTime:      wedAt(10, 0),
		EndTime:        wedAt(10, 30),
		AttendeeName:   "Alice",
		AttendeeEmail:  "alice@example.com",
	})

	if err == nil {
		t.Fatal("expected phase 2 conflict error, got nil")
	}
	if !errors.Is(err, ErrConflict) {
		t.Errorf("expected ErrConflict, got %v", err)
	}
}

func TestCancelBooking_Success(t *testing.T) {
	store := NewInMemoryStore()
	store.AddBooking(BookingRecord{
		ID: "b1", ScheduleLinkID: "link1",
		StartTime: wedAt(10, 0), EndTime: wedAt(10, 30),
		Status: "confirmed",
	})

	svc := NewBookingService(store)

	err := svc.CancelBooking("b1")
	if err != nil {
		t.Fatalf("expected cancel to succeed, got: %v", err)
	}

	result, err := svc.CreateBooking(CreateBookingInput{
		ScheduleLinkID: "link1",
		StartTime:      wedAt(10, 0),
		EndTime:        wedAt(10, 30),
		AttendeeName:   "New Person",
		AttendeeEmail:  "new@example.com",
	})
	if err != nil {
		t.Fatalf("expected re-booking after cancel to succeed, got: %v", err)
	}
	if result.Status != "confirmed" {
		t.Errorf("expected confirmed, got %s", result.Status)
	}
}

func TestCancelBooking_NotFound(t *testing.T) {
	store := NewInMemoryStore()
	svc := NewBookingService(store)

	err := svc.CancelBooking("nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent booking")
	}
}

func TestBusySlotsFromBookings(t *testing.T) {
	bookings := []BookingRecord{
		{ID: "b1", Status: "confirmed", StartTime: wedAt(10, 0), EndTime: wedAt(10, 30)},
		{ID: "b2", Status: "cancelled", StartTime: wedAt(11, 0), EndTime: wedAt(11, 30)},
		{ID: "b3", Status: "confirmed", StartTime: wedAt(14, 0), EndTime: wedAt(14, 30)},
	}

	slots := BusySlotsFromBookings(bookings)

	if len(slots) != 2 {
		t.Errorf("expected 2 busy slots (cancelled excluded), got %d", len(slots))
	}
}
