package market

import (
	"math"
	"sync/atomic"
)

// PriceOracle is a thread-safe store for the current best mid-price.
//
// It is written by the main broadcast loop (from engine OrderBookDepth
// snapshots) and read by the generator goroutine every tick.
//
// Uses atomic uint64 wrapping IEEE-754 float64 bits — zero lock contention.
type PriceOracle struct {
	midBits  atomic.Uint64
	fallback float64 // used when the book is empty or before first snapshot
}

// NewPriceOracle creates an oracle initialised to fallback price.
func NewPriceOracle(fallback float64) *PriceOracle {
	o := &PriceOracle{fallback: fallback}
	o.SetMid(fallback)
	return o
}

// SetMid updates the stored mid-price. Safe to call from any goroutine.
// Ignored if price ≤ 0 to guard against corrupt snapshots.
func (o *PriceOracle) SetMid(price float64) {
	if price > 0 {
		o.midBits.Store(math.Float64bits(price))
	}
}

// Mid returns the last known mid-price. Falls back to the initial
// reference price if no valid snapshot has been received yet.
func (o *PriceOracle) Mid() float64 {
	bits := o.midBits.Load()
	if bits == 0 {
		return o.fallback
	}
	p := math.Float64frombits(bits)
	if p <= 0 {
		return o.fallback
	}
	return p
}

// Fallback returns the reference anchor price set at construction.
func (o *PriceOracle) Fallback() float64 {
	return o.fallback
}
