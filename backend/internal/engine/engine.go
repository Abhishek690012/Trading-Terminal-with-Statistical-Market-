package engine

import (
	"time"
)

//
// EVENT-DRIVEN ARCHITECTURE:
// The engine uses an event-driven architecture where inputs (orders) and outputs
// (trades, market data updates) are passed through Go channels. This decouples
// I/O operations from core logic and allows producers/consumers to scale independently.
// It also enables handling streams of data without blocking the main execution path.
//
// WHY SINGLE-THREADED ENGINE IS USED:
// The engine runs in a single goroutine to process orders sequentially. This guarantees
// deterministic execution, strict price-time priority, and avoids race conditions.
// Because all state mutations happen within the same goroutine sequentially, it entirely
// avoids the need for expensive locking mechanisms (like Mutexes) on the OrderBook data
// structure, resulting in blazing fast throughput and simplicity.
type Engine struct {
	OrderBook *OrderBook
	orderChannel     chan *Order
	tradeChannel     chan Trade
	// broadcastChannel carries pre-computed OrderBookDepth snapshots, NOT live
	// *OrderBook pointers. GetDepth is called inside the engine goroutine so the
	// snapshot is always produced under single-goroutine ownership — no mutex needed
	// and no data race possible for consumers reading the sent value.
	broadcastChannel chan OrderBookDepth
}

// newBroadcastDepthLevels is the number of price levels included in each
// order book snapshot sent over the broadcast channel.
const newBroadcastDepthLevels = 20

// NewEngine creates and initializes a new matching engine.
func NewEngine() *Engine {
	return &Engine{
		OrderBook:        NewOrderBook(),
		orderChannel:     make(chan *Order, 100000),
		tradeChannel:     make(chan Trade, 100000),
		broadcastChannel: make(chan OrderBookDepth, 1000),
	}
}

// Start begins the engine executing loop.
// The engine must run as a SINGLE goroutine to guarantee sequential processing.
// Goroutines are ONLY used for the outer loop so that it operates in the background.
// Matching logic itself executes entirely sequentially.
func (e *Engine) Start() {
	go func() {
		// Ticker to batch order book updates every 100ms
		ticker := time.NewTicker(100 * time.Millisecond)
		defer ticker.Stop()

		for {
			// Engine loop uses select to wait on events (orders or ticker)
			select {
			case order, ok := <-e.orderChannel:
				if !ok {
					// Stop the engine if order stream is closed
					return
				}

				// Process incoming orders sequentially using matching logic
				trades := e.OrderBook.Process(order)

				// Send resulting trades to the tradeChannel as they occur
				for _, trade := range trades {
					e.tradeChannel <- trade
				}

			case <-ticker.C:
				// Batch updates: snapshot the order book depth INSIDE the engine
				// goroutine so GetDepth reads consistent state with no concurrent
				// mutation. The resulting OrderBookDepth is an immutable value type
				// — safe to hand off to any goroutine without further synchronization.
				snapshot := e.OrderBook.GetDepth(newBroadcastDepthLevels)

				// Non-blocking send: if the broadcast channel is full, skip this
				// tick rather than blocking the engine and starving it of CPU.
				select {
				case e.broadcastChannel <- snapshot:
				default:
					// Downstream is busy; the next tick will produce a fresh snapshot.
				}
			}
		}
	}()
}

// SubmitOrder acts as a Producer sending an event to the orderChannel.
func (e *Engine) SubmitOrder(order *Order) {
	e.orderChannel <- order
}

// OrderChannel returns the write-only channel to submit orders to the engine.
func (e *Engine) OrderChannel() chan<- *Order {
	return e.orderChannel
}

// TradeChannel returns the read-only channel to listen for executed trades.
func (e *Engine) TradeChannel() <-chan Trade {
	return e.tradeChannel
}

// BroadcastChannel returns the read-only channel to receive order book depth snapshots.
// Each value is a complete, immutable snapshot safe to read from any goroutine.
func (e *Engine) BroadcastChannel() <-chan OrderBookDepth {
	return e.broadcastChannel
}
