package cache

import (
	"context"
	"testing"
	"time"
)

func TestAvailabilityCache_NilClient_NoOp(t *testing.T) {
	cache := NewAvailabilityCache(nil)

	if cache.IsEnabled() {
		t.Error("cache with nil client should not be enabled")
	}

	// Get should always return cache miss
	_, hit := cache.Get(context.Background(), "test-key")
	if hit {
		t.Error("nil-client cache should never hit")
	}

	// Set should not panic
	cache.Set(context.Background(), "test-key", []SlotData{
		{Start: "2026-07-01T10:00:00Z", End: "2026-07-01T10:30:00Z", Rank: 1},
	})

	// Invalidate should not panic
	cache.Invalidate(context.Background(), "link1")
}

func TestAvailabilityCacheKey(t *testing.T) {
	key := AvailabilityCacheKey("link1", "2026-07-01T00:00:00Z", "2026-07-08T00:00:00Z")
	expected := "availability:link1:2026-07-01T00:00:00Z:2026-07-08T00:00:00Z"
	if key != expected {
		t.Errorf("expected %q, got %q", expected, key)
	}
}

func TestAvailabilityCacheKeyPrefix(t *testing.T) {
	prefix := AvailabilityCacheKeyPrefix("link1")
	expected := "availability:link1:*"
	if prefix != expected {
		t.Errorf("expected %q, got %q", expected, prefix)
	}
}

func TestNewAvailabilityCacheWithTTL(t *testing.T) {
	cache := NewAvailabilityCacheWithTTL(nil, 30*time.Second)
	if cache.IsEnabled() {
		t.Error("nil client should not be enabled even with custom TTL")
	}
}
