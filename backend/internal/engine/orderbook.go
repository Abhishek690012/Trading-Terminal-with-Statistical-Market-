package engine

import (
	"container/list"
	"sort"
)

// PriceLevel represents a collection of orders at a specific price point.
//
// To guarantee time priority within a price level:
// We use a FIFO queue (doubly-linked list from container/list) for O(1) appends (PushBack)
// and O(1) removals (Remove) which is crucial during order active matching or cancellations.
type PriceLevel struct {
	Price  float64
	Orders *list.List // Queue of *Order
}

// NewPriceLevel creates a new price level queue.
func NewPriceLevel(price float64) *PriceLevel {
	return &PriceLevel{
		Price:  price,
		Orders: list.New(),
	}
}

// OrderBook maintains the state of all active orders.
// 
// Data Structure choice for Price-Time Priority:
// 1. O(1) Level Lookup: We use maps (bidsMap, asksMap) with price as the key to quickly
//    access the corresponding PriceLevel queue. This provides O(1) lookups and insertions
//    for any given price level.
// 2. Fast Best Bid/Ask: We maintain sorted slices (bidsPrices, asksPrices) of active
//    price levels. The best bid (highest price) and best ask (lowest price) will
//    always be at index 0 of their respective slices, providing O(1) best price lookup.
// 3. Time Priority: By using a FIFO queue in each PriceLevel, orders that arrive
//    first at a given price are executed first, maintaining strict time priority.
type OrderBook struct {
	// Maps for O(1) access to price levels
	bidsMap map[float64]*PriceLevel
	asksMap map[float64]*PriceLevel

	// Sorted slices to keep track of prices, allowing O(1) access to best bid/ask
	bidsPrices []float64 // Sorted descending (highest to lowest)
	asksPrices []float64 // Sorted ascending (lowest to highest)

	// O(1) lookup map for active orders by ID, holding the list Element pointer
	ActiveOrders map[string]*list.Element
}

// NewOrderBook initializes an empty order book.
func NewOrderBook() *OrderBook {
	return &OrderBook{
		bidsMap:      make(map[float64]*PriceLevel),
		asksMap:      make(map[float64]*PriceLevel),
		bidsPrices:   make([]float64, 0),
		asksPrices:   make([]float64, 0),
		ActiveOrders: make(map[string]*list.Element),
	}
}

// AddOrder inserts an order into the order book, preserving price-time priority.
func (ob *OrderBook) AddOrder(order *Order) {
	if order.Side == Bid {
		ob.addBid(order)
	} else {
		ob.addAsk(order)
	}
}

// addBid processes a buy order.
func (ob *OrderBook) addBid(order *Order) {
	level, exists := ob.bidsMap[order.Price]
	if !exists {
		level = NewPriceLevel(order.Price)
		ob.bidsMap[order.Price] = level
		
		// Insert into bidsPrices while keeping it sorted descending
		index := sort.Search(len(ob.bidsPrices), func(i int) bool {
			return ob.bidsPrices[i] < order.Price // Strictly less to search for descending
		})
		
		ob.bidsPrices = append(ob.bidsPrices, 0)
		copy(ob.bidsPrices[index+1:], ob.bidsPrices[index:])
		ob.bidsPrices[index] = order.Price
	}
	
	// Time priority maintained by FIFO (PushBack)
	ob.ActiveOrders[order.ID] = level.Orders.PushBack(order)
}

// addAsk processes a sell order.
func (ob *OrderBook) addAsk(order *Order) {
	level, exists := ob.asksMap[order.Price]
	if !exists {
		level = NewPriceLevel(order.Price)
		ob.asksMap[order.Price] = level
		
		// Insert into asksPrices while keeping it sorted ascending
		index := sort.Search(len(ob.asksPrices), func(i int) bool {
			return ob.asksPrices[i] > order.Price // Strictly greater to search for ascending
		})
		
		ob.asksPrices = append(ob.asksPrices, 0)
		copy(ob.asksPrices[index+1:], ob.asksPrices[index:])
		ob.asksPrices[index] = order.Price
	}
	
	// Time priority maintained by FIFO (PushBack)
	ob.ActiveOrders[order.ID] = level.Orders.PushBack(order)
}

// CancelOrder efficiently cancels an active resting order from the order book.
func (ob *OrderBook) CancelOrder(orderID string) {
	element, exists := ob.ActiveOrders[orderID]
	if !exists {
		return // Order does not exist or has already executed
	}

	order := element.Value.(*Order)

	// Remove from the queue internally
	var level *PriceLevel
	if order.Side == Bid {
		level = ob.bidsMap[order.Price]
	} else {
		level = ob.asksMap[order.Price]
	}

	if level != nil {
		level.Orders.Remove(element)

		// Clean up empty levels dynamically to prevent memory/ghost level leaks
		if level.Orders.Len() == 0 {
			if order.Side == Bid {
				ob.removeBidLevel(order.Price)
			} else {
				ob.removeAskLevel(order.Price)
			}
		}
	}

	delete(ob.ActiveOrders, orderID)
}

// OrderBookDepth represents the aggregated state of the order book for serialization.
type OrderBookDepth struct {
	Bids [][2]float64 `json:"bids"` // [price, quantity]
	Asks [][2]float64 `json:"asks"` // [price, quantity]
}

// GetDepth extracts the top N price levels and their total resting quantities.
//
// SAFETY CONTRACT
//   - This function is NOT goroutine-safe by itself. It must be called from
//     the same goroutine that mutates the OrderBook (i.e. the engine loop),
//     OR the caller must guarantee that no concurrent mutations are happening.
//
// ⚠️  ARCHITECTURAL WARNING (flagged for review)
//   - GetDepth is currently called from ws/connector.go and cmd/server/main.go
//     on a *OrderBook pointer that is owned and mutated by the engine goroutine.
//     This is a data race. The correct fix is to have the engine pass a deep-copied
//     OrderBookDepth snapshot (not the live *OrderBook) through the broadcast channel.
//
// EDGE CASES HANDLED
//   - levels <= 0            → returns empty depth immediately
//   - empty order book       → returns empty Bids/Asks slices (not nil)
//   - fewer levels than N    → returns only what exists (no out-of-bounds)
//   - map key missing        → price in bidsPrices/asksPrices not found in map; skipped
//   - nil PriceLevel         → map returned zero-value nil pointer; skipped
//   - nil Orders list        → PriceLevel.Orders was never initialised; skipped
//   - nil list element Value → corrupted element; skipped with recovered quantity
func (ob *OrderBook) GetDepth(levels int) OrderBookDepth {
	depth := OrderBookDepth{
		Bids: make([][2]float64, 0, levels),
		Asks: make([][2]float64, 0, levels),
	}

	// Guard: caller passed a nonsensical depth — return empty snapshot.
	if levels <= 0 {
		return depth
	}

	// Extract top bids (bidsPrices is sorted descending: index 0 = best bid).
	for i := 0; i < len(ob.bidsPrices) && i < levels; i++ {
		price := ob.bidsPrices[i]

		// Guard 1: map lookup returns nil zero-value if the key is absent.
		// This can happen transiently if removeBidLevel removed the entry while
		// bidsPrices has not yet been trimmed (or vice-versa) in a concurrent call.
		level, ok := ob.bidsMap[price]
		if !ok || level == nil {
			continue
		}

		// Guard 2: Orders list itself may be nil if a PriceLevel was somehow
		// constructed outside NewPriceLevel and the field was never set.
		if level.Orders == nil {
			continue
		}

		var totalQty float64
		for e := level.Orders.Front(); e != nil; e = e.Next() {
			// Guard 3: a list element whose Value is nil would panic on type-assert.
			// This should not happen through normal engine paths, but under extreme
			// concurrency or future refactors it is a worthwhile safety net.
			if e.Value == nil {
				continue
			}
			order, ok := e.Value.(*Order)
			if !ok || order == nil {
				continue
			}
			totalQty += order.Quantity
		}

		depth.Bids = append(depth.Bids, [2]float64{price, totalQty})
	}

	// Extract top asks (asksPrices is sorted ascending: index 0 = best ask).
	for i := 0; i < len(ob.asksPrices) && i < levels; i++ {
		price := ob.asksPrices[i]

		// Guard 1: same map-key-absent protection as bids above.
		level, ok := ob.asksMap[price]
		if !ok || level == nil {
			continue
		}

		// Guard 2: nil Orders list protection.
		if level.Orders == nil {
			continue
		}

		var totalQty float64
		for e := level.Orders.Front(); e != nil; e = e.Next() {
			// Guard 3: nil or wrong-typed Value protection.
			if e.Value == nil {
				continue
			}
			order, ok := e.Value.(*Order)
			if !ok || order == nil {
				continue
			}
			totalQty += order.Quantity
		}

		depth.Asks = append(depth.Asks, [2]float64{price, totalQty})
	}

	return depth
}
