package booking

import (
	"errors"
	"sync"
)

// InMemoryStore implements BookingStore for development and testing.
// It stores bookings in a simple map protected by a mutex.
type InMemoryStore struct {
	mu       sync.Mutex
	bookings map[string]BookingRecord
	byLink   map[string][]string // schedule_link_id -> booking IDs

	// SimulatePhase2Conflict, when set, causes InsertBooking to fail with
	// ErrConflict as if a concurrent booking slipped in.
	SimulatePhase2Conflict bool
}

// NewInMemoryStore creates a new in-memory booking store.
func NewInMemoryStore() *InMemoryStore {
	return &InMemoryStore{
		bookings: make(map[string]BookingRecord),
		byLink:   make(map[string][]string),
	}
}

// GetBookings returns all bookings for a schedule link.
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

// InsertBooking atomically inserts a booking after re-verifying no conflict.
func (s *InMemoryStore) InsertBooking(record BookingRecord) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.SimulatePhase2Conflict {
		return ErrConflict
	}

	// Re-verify (simulating DB exclusion constraint)
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

// CancelBooking marks a booking as cancelled.
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

// GetBooking returns a single booking by ID.
func (s *InMemoryStore) GetBooking(bookingID string) (BookingRecord, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	b, ok := s.bookings[bookingID]
	return b, ok
}

// AddBooking is a test helper that directly inserts a booking without conflict checks.
func (s *InMemoryStore) AddBooking(record BookingRecord) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.bookings[record.ID] = record
	s.byLink[record.ScheduleLinkID] = append(s.byLink[record.ScheduleLinkID], record.ID)
}
