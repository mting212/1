package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// SlotData is the serializable representation of availability time slots for caching.
type SlotData struct {
	Start string `json:"start"`
	End   string `json:"end"`
	Rank  int32  `json:"rank"`
}

// AvailabilityCacheKey generates a deterministic cache key for an availability query.
func AvailabilityCacheKey(scheduleLinkID, windowStart, windowEnd string) string {
	return fmt.Sprintf("availability:%s:%s:%s", scheduleLinkID, windowStart, windowEnd)
}

// AvailabilityCacheKeyPrefix generates a prefix for invalidating all cached availability
// for a given schedule link.
func AvailabilityCacheKeyPrefix(scheduleLinkID string) string {
	return fmt.Sprintf("availability:%s:*", scheduleLinkID)
}

// AvailabilityCache provides Redis-backed caching for availability computation results.
// If the Redis client is nil, all operations are no-ops (graceful degradation).
type AvailabilityCache struct {
	client *redis.Client
	ttl    time.Duration
}

// NewAvailabilityCache creates a cache with the given Redis client.
// Pass nil to disable caching (all operations become no-ops).
func NewAvailabilityCache(client *redis.Client) *AvailabilityCache {
	return &AvailabilityCache{
		client: client,
		ttl:    5 * time.Minute,
	}
}

// NewAvailabilityCacheWithTTL creates a cache with a custom TTL.
func NewAvailabilityCacheWithTTL(client *redis.Client, ttl time.Duration) *AvailabilityCache {
	return &AvailabilityCache{
		client: client,
		ttl:    ttl,
	}
}

// Get retrieves cached availability slots. Returns nil on cache miss or error.
func (c *AvailabilityCache) Get(ctx context.Context, key string) ([]SlotData, bool) {
	if c.client == nil {
		return nil, false
	}

	data, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		if err != redis.Nil {
			log.Printf("[cache] Get error for key %s: %v", key, err)
		}
		return nil, false
	}

	var slots []SlotData
	if err := json.Unmarshal(data, &slots); err != nil {
		log.Printf("[cache] unmarshal error for key %s: %v", key, err)
		return nil, false
	}

	return slots, true
}

// Set stores availability slots in the cache with the configured TTL.
func (c *AvailabilityCache) Set(ctx context.Context, key string, slots []SlotData) {
	if c.client == nil {
		return
	}

	data, err := json.Marshal(slots)
	if err != nil {
		log.Printf("[cache] marshal error for key %s: %v", key, err)
		return
	}

	if err := c.client.Set(ctx, key, data, c.ttl).Err(); err != nil {
		log.Printf("[cache] Set error for key %s: %v", key, err)
	}
}

// Invalidate removes all cached availability for a schedule link.
// Uses SCAN to find matching keys (not recommended for production with huge key spaces).
func (c *AvailabilityCache) Invalidate(ctx context.Context, scheduleLinkID string) {
	if c.client == nil {
		return
	}

	pattern := AvailabilityCacheKeyPrefix(scheduleLinkID)
	iter := c.client.Scan(ctx, 0, pattern, 100).Iterator()
	var keys []string
	for iter.Next(ctx) {
		keys = append(keys, iter.Val())
	}
	if err := iter.Err(); err != nil {
		log.Printf("[cache] Invalidate scan error for %s: %v", scheduleLinkID, err)
		return
	}

	if len(keys) > 0 {
		if err := c.client.Del(ctx, keys...).Err(); err != nil {
			log.Printf("[cache] Invalidate del error for %s: %v", scheduleLinkID, err)
		}
	}
}

// IsEnabled returns true if caching is active (Redis client is configured).
func (c *AvailabilityCache) IsEnabled() bool {
	return c.client != nil
}
