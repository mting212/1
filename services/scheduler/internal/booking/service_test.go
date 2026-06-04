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

// InMemoryStore implements BookingStore for testing with optional conflict injection.
type InMemoryStore struct {
	mu       sync.Mutex
	bookings map[string]BookingRecord
	byLink   map[string][]string // schedule_link_id -> booking IDs

	// SimulatePhase2Conflict, when set, causes InsertBooking to fail with
	// ErrConflict as if a concurrent booking slipped in.
	SimulatePhase2Conflict bool
}

func NewInMemoryStore() *InMemoryStore {
	return &InMemoryStore{
		bookings: make(map[string]BookingRecord),
		byLink:   make(map[string][]string),
	}
}

func (s *InMemoryStore) GetBookings(scheduleLinkID string) ([]BookingRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var result []BookingRecord
	for _, id := range s.byLink[scheduleLinkID] {
		if b, ok := s.bookings[id]; ok {
			result = append(result, b)
		}
	}
	return result, nil
}

func (s *InMemoryStore) InsertBooking(record BookingRecord) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Simulate a concurrent booking conflict
	if s.SimulatePhase2Conflict {
		return ErrConflict
	}

	// Re-verify no conflict (simulating DB exclusion constraint)
	for _, id := range s.byLink[record.ScheduleLinkID] {
		if b, ok := s.bookings[id]; ok && b.Status != "cancelled" {
			if overlaps(record.StartTime, record.EndTime, b.StartTime, b.EndTime) {
				return ErrConflict
			}
		}
	}

	s.bookings[record.ID] = record
	s.byLink[record.ScheduleLinkID] = append(s.byLink[record.ScheduleLinkID], record.ID)
	return nil
}

func (s *InMemoryStore) CancelBooking(bookingID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	b, ok := s.bookings[bookingID]
	if !ok {
		return errors.New("booking not found")
	}
	b.Status = "cancelled"
	s.bookings[bookingID] = b
	return nil
}

func (s *InMemoryStore) addBooking(record BookingRecord) {
	s.bookings[record.ID] = record
	s.byLink[record.ScheduleLinkID] = append(s.byLink[record.ScheduleLinkID], record.ID)
}

// --- Tests ---

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

	// Candidate: 10:15-10:45 overlaps the end of existing 10:00-10:30
	result := CheckConflict("link1", wedAt(10, 15), wedAt(10, 45), existing)
	if !result.HasConflict {
		t.Error("expected conflict for partial overlap (front), got none")
	}
}

func TestCheckConflict_PartialOverlapBack(t *testing.T) {
	existing := []BookingRecord{
		{ID: "b1", ScheduleLinkID: "link1", StartTime: wedAt(10, 0), EndTime: wedAt(10, 30), Status: "confirmed"},
	}

	// Candidate: 9:45-10:15 overlaps the start of existing 10:00-10:30
	result := CheckConflict("link1", wedAt(9, 45), wedAt(10, 15), existing)
	if !result.HasConflict {
		t.Error("expected conflict for partial overlap (back), got none")
	}
}

func TestCheckConflict_Containment(t *testing.T) {
	existing := []BookingRecord{
		{ID: "b1", ScheduleLinkID: "link1", StartTime: wedAt(10, 0), EndTime: wedAt(11, 0), Status: "confirmed"},
	}

	// Candidate: 10:15-10:45 is fully inside existing 10:00-11:00
	result := CheckConflict("link1", wedAt(10, 15), wedAt(10, 45), existing)
	if !result.HasConflict {
		t.Error("expected conflict for containment, got none")
	}
}

func TestCheckConflict_BoundaryTouch_NoConflict(t *testing.T) {
	existing := []BookingRecord{
		{ID: "b1", ScheduleLinkID: "link1", StartTime: wedAt(10, 0), EndTime: wedAt(10, 30), Status: "confirmed"},
	}

	// Candidate starts exactly when existing ends: 10:30-11:00
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

	// Same time, different schedule link — no conflict
	result := CheckConflict("link2", wedAt(10, 0), wedAt(10, 30), existing)
	if result.HasConflict {
		t.Error("different schedule link should not cause conflict")
	}
}

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

	// Verify booking is in store
	bookings, _ := store.GetBookings("link1")
	if len(bookings) != 1 {
		t.Errorf("expected 1 booking, got %d", len(bookings))
	}
}

func TestCreateBooking_Conflict(t *testing.T) {
	store := NewInMemoryStore()
	store.addBooking(BookingRecord{
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
		EndTime:        wedAt(10, 0), // end before start
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

	// 10 concurrent booking attempts for the same slot
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(idx int) {
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
		}(i)
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

	// Verify only 1 booking in store
	bookings, _ := store.GetBookings("link1")
	if len(bookings) != 1 {
		t.Errorf("expected exactly 1 booking in store, got %d", len(bookings))
	}
}

func TestCreateBooking_Phase2Conflict(t *testing.T) {
	// Simulates the scenario where Phase 1 (read) shows no conflict,
	// but a concurrent booking slips in before Phase 2 (insert).
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
	store.addBooking(BookingRecord{
		ID: "b1", ScheduleLinkID: "link1",
		StartTime: wedAt(10, 0), EndTime: wedAt(10, 30),
		Status: "confirmed",
	})

	svc := NewBookingService(store)

	err := svc.CancelBooking("b1")
	if err != nil {
		t.Fatalf("expected cancel to succeed, got: %v", err)
	}

	// After cancellation, the same slot should be bookable
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

	// Only 2 confirmed bookings
	if len(slots) != 2 {
		t.Errorf("expected 2 busy slots (cancelled excluded), got %d", len(slots))
	}
}
