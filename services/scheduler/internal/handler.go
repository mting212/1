package internal

import (
	"context"
	"errors"
	"time"

	"github.com/meetflow/scheduler/internal/availability"
	"github.com/meetflow/scheduler/internal/booking"
	schedulerv1 "github.com/meetflow/scheduler/proto/scheduler/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// SchedulerHandler implements the gRPC SchedulerServiceServer.
type SchedulerHandler struct {
	schedulerv1.UnimplementedSchedulerServiceServer
	svc *booking.BookingService
}

// NewSchedulerHandler creates a handler with the given booking service.
func NewSchedulerHandler(svc *booking.BookingService) *SchedulerHandler {
	return &SchedulerHandler{svc: svc}
}

// GetAvailability returns available time slots for a scheduling link.
func (h *SchedulerHandler) GetAvailability(
	ctx context.Context,
	req *schedulerv1.GetAvailabilityRequest,
) (*schedulerv1.GetAvailabilityResponse, error) {
	windowStart, err := time.Parse(time.RFC3339, req.WindowStart)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid window_start: %v", err)
	}
	windowEnd, err := time.Parse(time.RFC3339, req.WindowEnd)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid window_end: %v", err)
	}

	// Build availability calculation input from the schedule link configuration.
	// In production, availability rules and preferences are loaded from the database.
	// For now, use sensible defaults that demonstrate the engine works.
	input := availability.CalculateInput{
		Rules:               defaultRules(),
		WindowStart:         windowStart,
		WindowEnd:           windowEnd,
		SlotDurationMinutes: 30,
		BufferBeforeMinutes: 15,
		BufferAfterMinutes:  10,
		MinNoticeHours:      2,
		PreferredTimeRanges: []availability.PreferredRange{
			{DayOfWeek: time.Tuesday, StartTime: availability.ClockTime{Hour: 10, Minute: 0},
				EndTime: availability.ClockTime{Hour: 12, Minute: 0}},
			{DayOfWeek: time.Wednesday, StartTime: availability.ClockTime{Hour: 10, Minute: 0},
				EndTime: availability.ClockTime{Hour: 12, Minute: 0}},
			{DayOfWeek: time.Thursday, StartTime: availability.ClockTime{Hour: 10, Minute: 0},
				EndTime: availability.ClockTime{Hour: 12, Minute: 0}},
		},
	}

	// Add invitee calendar events as busy slots
	for _, e := range req.InviteeCalendarEvents {
		start, err := time.Parse(time.RFC3339, e.Start)
		if err != nil {
			continue
		}
		end, err := time.Parse(time.RFC3339, e.End)
		if err != nil {
			continue
		}
		input.BusySlots = append(input.BusySlots, availability.BusySlot{
			Start: start,
			End:   end,
		})
	}

	// Load existing bookings as busy slots
	existing, err := h.svc.GetBookings(req.ScheduleLinkId)
	if err == nil {
		busyFromBookings := booking.BusySlotsFromBookings(existing)
		input.BusySlots = append(input.BusySlots, busyFromBookings...)
	}

	slots := availability.CalculateAvailability(input)

	resp := &schedulerv1.GetAvailabilityResponse{
		Slots: make([]*schedulerv1.TimeSlot, len(slots)),
	}
	for i, s := range slots {
		resp.Slots[i] = &schedulerv1.TimeSlot{
			Start: s.Start.Format(time.RFC3339),
			End:   s.End.Format(time.RFC3339),
			Rank:  toProtoRank(s.Rank),
		}
	}

	return resp, nil
}

// CreateBooking atomically reserves a time slot.
func (h *SchedulerHandler) CreateBooking(
	ctx context.Context,
	req *schedulerv1.CreateBookingRequest,
) (*schedulerv1.CreateBookingResponse, error) {
	startTime, err := time.Parse(time.RFC3339, req.StartTime)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid start_time: %v", err)
	}
	endTime, err := time.Parse(time.RFC3339, req.EndTime)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid end_time: %v", err)
	}

	result, err := h.svc.CreateBooking(booking.CreateBookingInput{
		ScheduleLinkID:   req.ScheduleLinkId,
		StartTime:        startTime,
		EndTime:          endTime,
		AttendeeName:     req.AttendeeName,
		AttendeeEmail:    req.AttendeeEmail,
		AttendeeTimezone: req.AttendeeTimezone,
		Notes:            req.Notes,
	})
	if err != nil {
		if errors.Is(err, booking.ErrConflict) {
			return &schedulerv1.CreateBookingResponse{
				Status:       schedulerv1.BookingStatus_BOOKING_STATUS_CONFLICT,
				ErrorMessage: err.Error(),
			}, nil
		}
		if errors.Is(err, booking.ErrInvalidTimeRange) {
			return nil, status.Errorf(codes.InvalidArgument, "%v", err)
		}
		return nil, status.Errorf(codes.Internal, "booking failed: %v", err)
	}

	return &schedulerv1.CreateBookingResponse{
		BookingId: result.BookingID,
		Status:    schedulerv1.BookingStatus_BOOKING_STATUS_CONFIRMED,
	}, nil
}

// CancelBooking releases a previously reserved time slot.
func (h *SchedulerHandler) CancelBooking(
	ctx context.Context,
	req *schedulerv1.CancelBookingRequest,
) (*schedulerv1.CancelBookingResponse, error) {
	if err := h.svc.CancelBooking(req.BookingId); err != nil {
		return &schedulerv1.CancelBookingResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}

	return &schedulerv1.CancelBookingResponse{
		Success: true,
		Message: "booking cancelled",
	}, nil
}

// defaultRules returns weekday 9-5 availability as a fallback.
func defaultRules() []availability.AvailabilityRule {
	days := []time.Weekday{
		time.Monday, time.Tuesday, time.Wednesday,
		time.Thursday, time.Friday,
	}
	rules := make([]availability.AvailabilityRule, len(days))
	for i, d := range days {
		rules[i] = availability.AvailabilityRule{
			DayOfWeek: d,
			StartTime: availability.ClockTime{Hour: 9, Minute: 0},
			EndTime:   availability.ClockTime{Hour: 17, Minute: 0},
		}
	}
	return rules
}

func toProtoRank(r availability.SlotRank) schedulerv1.SlotRank {
	switch r {
	case availability.RankPreferred:
		return schedulerv1.SlotRank_SLOT_RANK_PREFERRED
	default:
		return schedulerv1.SlotRank_SLOT_RANK_AVAILABLE
	}
}
