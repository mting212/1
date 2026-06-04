package internal

import (
	"context"
	"testing"
	"time"

	"github.com/meetflow/scheduler/internal/booking"
	schedulerv1 "github.com/meetflow/scheduler/proto/scheduler/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func mon(t *testing.T) time.Time {
	return time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
}

func TestGetAvailability_ReturnsSlots(t *testing.T) {
	store := booking.NewInMemoryStore()
	svc := booking.NewBookingService(store)
	handler := NewSchedulerHandler(svc)

	windowStart := mon(t).Format(time.RFC3339)
	windowEnd := mon(t).Add(7 * 24 * time.Hour).Format(time.RFC3339)

	resp, err := handler.GetAvailability(context.Background(), &schedulerv1.GetAvailabilityRequest{
		ScheduleLinkId: "link1",
		WindowStart:    windowStart,
		WindowEnd:      windowEnd,
	})

	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if len(resp.Slots) == 0 {
		t.Error("expected some available slots")
	}
}

func TestGetAvailability_InvalidWindowStart(t *testing.T) {
	store := booking.NewInMemoryStore()
	svc := booking.NewBookingService(store)
	handler := NewSchedulerHandler(svc)

	_, err := handler.GetAvailability(context.Background(), &schedulerv1.GetAvailabilityRequest{
		WindowStart: "not-a-timestamp",
		WindowEnd:   mon(t).Add(7 * 24 * time.Hour).Format(time.RFC3339),
	})

	if err == nil {
		t.Fatal("expected error for invalid window_start")
	}
	if status.Code(err) != codes.InvalidArgument {
		t.Errorf("expected InvalidArgument, got %v", status.Code(err))
	}
}

func TestCreateBooking_Success(t *testing.T) {
	store := booking.NewInMemoryStore()
	svc := booking.NewBookingService(store)
	handler := NewSchedulerHandler(svc)

	resp, err := handler.CreateBooking(context.Background(), &schedulerv1.CreateBookingRequest{
		ScheduleLinkId:   "link1",
		StartTime:        time.Date(2026, 7, 1, 10, 0, 0, 0, time.UTC).Format(time.RFC3339),
		EndTime:          time.Date(2026, 7, 1, 10, 30, 0, 0, time.UTC).Format(time.RFC3339),
		AttendeeName:     "Test",
		AttendeeEmail:    "test@example.com",
		AttendeeTimezone: "UTC",
	})

	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if resp.Status != schedulerv1.BookingStatus_BOOKING_STATUS_CONFIRMED {
		t.Errorf("expected CONFIRMED, got %v", resp.Status)
	}
	if resp.BookingId == "" {
		t.Error("expected non-empty booking_id")
	}
}

func TestCreateBooking_Conflict(t *testing.T) {
	store := booking.NewInMemoryStore()
	store.AddBooking(booking.BookingRecord{
		ID: "existing", ScheduleLinkID: "link1",
		StartTime: time.Date(2026, 7, 1, 10, 0, 0, 0, time.UTC),
		EndTime:   time.Date(2026, 7, 1, 10, 30, 0, 0, time.UTC),
		Status:    "confirmed",
	})
	svc := booking.NewBookingService(store)
	handler := NewSchedulerHandler(svc)

	resp, err := handler.CreateBooking(context.Background(), &schedulerv1.CreateBookingRequest{
		ScheduleLinkId: "link1",
		StartTime:      time.Date(2026, 7, 1, 10, 0, 0, 0, time.UTC).Format(time.RFC3339),
		EndTime:        time.Date(2026, 7, 1, 10, 30, 0, 0, time.UTC).Format(time.RFC3339),
		AttendeeName:   "Test",
		AttendeeEmail:  "test@example.com",
	})

	// Conflict returns a response with error_message, not a gRPC error
	if err != nil {
		t.Fatalf("conflict returns response (not gRPC error): %v", err)
	}
	if resp.Status != schedulerv1.BookingStatus_BOOKING_STATUS_CONFLICT {
		t.Errorf("expected CONFLICT status, got %v", resp.Status)
	}
}

func TestCancelBooking_Success(t *testing.T) {
	store := booking.NewInMemoryStore()
	store.AddBooking(booking.BookingRecord{
		ID: "b1", ScheduleLinkID: "link1",
		StartTime: time.Date(2026, 7, 1, 10, 0, 0, 0, time.UTC),
		EndTime:   time.Date(2026, 7, 1, 10, 30, 0, 0, time.UTC),
		Status:    "confirmed",
	})
	svc := booking.NewBookingService(store)
	handler := NewSchedulerHandler(svc)

	resp, err := handler.CancelBooking(context.Background(), &schedulerv1.CancelBookingRequest{
		BookingId: "b1",
	})

	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if !resp.Success {
		t.Error("expected success=true")
	}
}
