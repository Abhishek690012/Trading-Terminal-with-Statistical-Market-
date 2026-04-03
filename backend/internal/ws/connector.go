package ws

import (
	"backend/internal/engine"
)

// TradeMessage wraps the native Trade output into a specific JSON schema.
type TradeMessage struct {
	Type      string  `json:"type"`
	Price     float64 `json:"price"`
	Quantity  float64 `json:"quantity"`
	Timestamp int64   `json:"timestamp"`
	Side      string  `json:"side"`
}

// OrderBookMessage wraps the native OrderBook snapshot into a specific JSON schema.
type OrderBookMessage struct {
	Type string           `json:"type"`
	Bids [][2]float64     `json:"bids"`
	Asks [][2]float64     `json:"asks"`
}

// ConnectEngine bridges the isolated Matching Engine output channels directly
// into the decoupled WebSocket Broadcaster asynchronously.
// It safely consumes events and translates them into serializable JSON packets.
//
// NOTE: obChan carries engine.OrderBookDepth snapshots — pre-computed, immutable
// value types produced inside the engine goroutine. No GetDepth call is needed
// here, removing the previous data race on the live *OrderBook pointer.
func ConnectEngine(b *Broadcaster, tradeChan <-chan engine.Trade, obChan <-chan engine.OrderBookDepth) {
	// Execute the bridge logic asynchronously to guarantee neither Engine nor Broadcaster are ever blocked.
	go func() {
		for {
			select {
			// Consume raw streaming trades off the engine
			case trade, ok := <-tradeChan:
				if !ok {
					return // Channel safely closed by engine
				}

				// Construct the targeted Trade JSON schema payload
				b.Broadcast(TradeMessage{
					Type:      "trade",
					Price:     trade.Price,
					Quantity:  trade.Quantity,
					Timestamp: trade.Timestamp / 1e6, // Convert nano to ms for frontend
					Side:      string(trade.TakerSide),
				})

			// Consume the pre-computed order book depth snapshots
			case depth, ok := <-obChan:
				if !ok {
					return // Channel safely closed by engine
				}

				// Snapshot is already a clean [][price, quantity] structure —
				// no GetDepth call needed; no race possible.
				b.Broadcast(OrderBookMessage{
					Type: "orderbook",
					Bids: depth.Bids,
					Asks: depth.Asks,
				})
			}
		}
	}()
}
