package booking

import (
	"errors"
	"fmt"
	"sync"
	"time"
)

// ErrConflict is returned when a booking slot is already taken.
var ErrConflict = errors.New("booking conflict: the requested time slot is no longer available")

// ErrInvalidTimeRange is returned when start_time >= end_time.
var ErrInvalidTimeRange = errors.New("invalid time range: end_time must be after start_time")

// BookingStore defines the interface for persisting and querying bookings.
// This allows the booking service to work with any storage backend.
type BookingStore interface {
	// GetBookings returns all non-cancelled bookings for a schedule link.
	GetBookings(scheduleLinkID string) ([]BookingRecord, error)

	// InsertBooking atomically inserts a new booking.
	// Must fail if a conflicting booking was inserted since the last GetBookings call.
	InsertBooking(record BookingRecord) error

	// CancelBooking marks a booking as cancelled.
	CancelBooking(bookingID string) error
}

// CreateBookingInput holds all data needed to create a booking.
type CreateBookingInput struct {
	ScheduleLinkID   string
	StartTime        time.Time
	EndTime          time.Time
	AttendeeName     string
	AttendeeEmail    string
	AttendeeTimezone string
	Notes            string
}

// CreateBookingResult holds the result of a successful booking.
type CreateBookingResult struct {
	BookingID string
	Status    string
}

// BookingService manages the booking lifecycle with two-phase conflict detection.
type BookingService struct {
	store    BookingStore
	mu       sync.Mutex // protects concurrent CreateBooking calls
}

// NewBookingService creates a new booking service with the given store.
func NewBookingService(store BookingStore) *BookingService {
	return &BookingService{store: store}
}

// CreateBooking attempts to reserve a time slot using a two-phase lock:
//
// Phase 1: Read current bookings and check for conflicts.
//   This is a non-locking read — a concurrent booking may slip through.
//
// Phase 2: Attempt an atomic insert.
//   The store must verify no conflicting booking was inserted since Phase 1.
//   If a conflict is detected at this stage, return ErrConflict.
func (s *BookingService) CreateBooking(input CreateBookingInput) (CreateBookingResult, error) {
	// Validate input
	if !input.EndTime.After(input.StartTime) {
		return CreateBookingResult{}, ErrInvalidTimeRange
	}

	// Serialize booking attempts to simplify conflict handling.
	// In production with PostgreSQL, the SERIALIZABLE isolation + exclusion
	// constraint provides the definitive guarantee.
	s.mu.Lock()
	defer s.mu.Unlock()

	// Phase 1: Read existing bookings and check for conflicts
	existing, err := s.store.GetBookings(input.ScheduleLinkID)
	if err != nil {
		return CreateBookingResult{}, fmt.Errorf("phase 1 read failed: %w", err)
	}

	conflict := CheckConflict(input.ScheduleLinkID, input.StartTime, input.EndTime, existing)
	if conflict.HasConflict {
		return CreateBookingResult{}, fmt.Errorf("%w: conflicts with booking %s (%v — %v)",
			ErrConflict,
			conflict.ConflictingID,
			conflict.ConflictingStart.Format(time.RFC3339),
			conflict.ConflictingEnd.Format(time.RFC3339),
		)
	}

	// Phase 2: Atomic insert (store must re-verify internally)
	record := BookingRecord{
		ID:             generateBookingID(),
		ScheduleLinkID: input.ScheduleLinkID,
		StartTime:      input.StartTime,
		EndTime:        input.EndTime,
		Status:         "confirmed",
	}

	if err := s.store.InsertBooking(record); err != nil {
		if errors.Is(err, ErrConflict) {
			return CreateBookingResult{}, fmt.Errorf("phase 2 insert failed: %w", err)
		}
		return CreateBookingResult{}, fmt.Errorf("phase 2 insert failed: %w", err)
	}

	return CreateBookingResult{
		BookingID: record.ID,
		Status:    "confirmed",
	}, nil
}

// CancelBooking marks a booking as cancelled, releasing the time slot.
func (s *BookingService) CancelBooking(bookingID string) error {
	return s.store.CancelBooking(bookingID)
}

// generateBookingID creates a unique booking identifier.
// In production, this would be a UUID.
var bookingIDCounter int
var bookingIDMu sync.Mutex

func generateBookingID() string {
	bookingIDMu.Lock()
	defer bookingIDMu.Unlock()
	bookingIDCounter++
	return fmt.Sprintf("book_%d_%d", time.Now().UnixMilli(), bookingIDCounter)
}
