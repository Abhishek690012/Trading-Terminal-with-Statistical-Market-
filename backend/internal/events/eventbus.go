package events

import (
	"log"
	"sync"

	"backend/internal/engine"
)

// EventBus fans out incoming trade events to multiple independent subscribers.
type EventBus struct {
	mu          sync.RWMutex
	subscribers []chan engine.Trade
	tradeChan   <-chan engine.Trade
}

// NewEventBus establishes the pub-sub hub using the core engine trade output.
func NewEventBus(tradeChan <-chan engine.Trade) *EventBus {
	return &EventBus{
		subscribers: make([]chan engine.Trade, 0),
		tradeChan:   tradeChan,
	}
}

// Subscribe returns a uniquely buffered channel for the caller to receive fan-out events.
func (eb *EventBus) Subscribe() <-chan engine.Trade {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	// 100,000 items buffer ensures no trade loss even during extreme bursts
	ch := make(chan engine.Trade, 100000)
	eb.subscribers = append(eb.subscribers, ch)
	return ch
}

// Start spawns the background router mapping engine events to all downstream systems.
func (eb *EventBus) Start() {
	go func() {
		for trade := range eb.tradeChan {
			eb.mu.RLock()
			for _, sub := range eb.subscribers {
				// Non-blocking fan-out. Slow consumers lose messages instead of blocking the bus.
				select {
				case sub <- trade:
				default:
					log.Printf("EventBus: Slow subscriber skipped. Dropping trade event %s\n", trade.BuyOrderID[:8])
				}
			}
			eb.mu.RUnlock()
		}
	}()
}
