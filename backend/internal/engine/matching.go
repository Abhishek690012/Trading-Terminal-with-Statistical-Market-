package engine

import (
	"math"
)

// Process applies a new order to the OrderBook and executes matches if possible.
// Determinism constraint honored: No randoms or time.Now(). 
// Trade timestamp invariably inherits the Taker's timestamp.
//
// Matching Steps:
// 1. Identify order side (Bid or Ask)
// 2. Iterate through opposing side's price levels starting from the best available price
// 3. For Limit Orders: Check if the best price crosses the limit price bounds
// 4. Consume liquidity (FIFO) at the best price level up to the order's quantity
// 5. Generate Trade records at the resting maker's price
// 6. Clean up empty price levels dynamically
// 7. If quantity remains and it's a Limit Order, add it to the OrderBook
func (ob *OrderBook) Process(order *Order) []Trade {
	if order.Type == Cancel {
		ob.CancelOrder(order.ID)
		return nil
	}

	var trades []Trade

	if order.Side == Bid {
		trades = ob.matchBid(order)
	} else {
		trades = ob.matchAsk(order)
	}

	// Edge Case: Partial fills or entirely unmatched orders
	// If the order is a Limit order with remaining quantity, we rest it in the book.
	// Market orders with remaining quantity (e.g. empty book, lacking liquidity) are just discarded.
	if order.Type == Limit && order.Quantity > 0 {
		ob.AddOrder(order)
	}

	return trades
}

// matchBid matches an incoming BUY order with resting SELL orders (Asks).
func (ob *OrderBook) matchBid(order *Order) []Trade {
	var trades []Trade

	for order.Quantity > 0 {
		// Edge Case: Empty book on the ask side (no liquidity available)
		if len(ob.asksPrices) == 0 {
			break
		}

		bestAskPrice := ob.asksPrices[0]

		// Limit Order constraint: Taker price must be >= best ask price to cross
		if order.Type == Limit && bestAskPrice > order.Price {
			break
		}

		bestAskLevel := ob.asksMap[bestAskPrice]
		queue := bestAskLevel.Orders

		// Edge Case: Ghost price level (map/slice out of sync or level emptied without cleanup)
		if queue.Len() == 0 {
			ob.removeAskLevel(bestAskPrice)
			continue
		}

		element := queue.Front()
		makerOrder := element.Value.(*Order)

		// Trade quantity is the minimum of what we want vs what is available at the front of the queue
		tradeQty := math.Min(order.Quantity, makerOrder.Quantity)

		trades = append(trades, Trade{
			Price:       bestAskPrice, // Trade invariably executes at the maker's resting price
			Quantity:    tradeQty,
			BuyOrderID:  order.ID,        // Taker is buyer
			SellOrderID: makerOrder.ID,   // Maker is seller
			BuyerID:     order.UserID,
			SellerID:    makerOrder.UserID,
			TakerSide:   Bid,
			Timestamp:   order.Timestamp, // Deterministic to taker arrival time
		})

		// Deduct filled quantities
		order.Quantity -= tradeQty
		makerOrder.Quantity -= tradeQty

		// If the resting maker order is fully executed, pop it from the FIFO queue
		if makerOrder.Quantity == 0 {
			queue.Remove(element)
			delete(ob.ActiveOrders, makerOrder.ID)
		}

		// Clean up the price level entirely if it has been depleted
		if queue.Len() == 0 {
			ob.removeAskLevel(bestAskPrice)
		}
	}

	return trades
}

// matchAsk matches an incoming SELL order with resting BUY orders (Bids).
func (ob *OrderBook) matchAsk(order *Order) []Trade {
	var trades []Trade

	for order.Quantity > 0 {
		// Edge Case: Empty book on the bid side (no liquidity available)
		if len(ob.bidsPrices) == 0 {
			break
		}

		bestBidPrice := ob.bidsPrices[0]

		// Limit Order constraint: Taker price must be <= best bid price to cross
		if order.Type == Limit && bestBidPrice < order.Price {
			break
		}

		bestBidLevel := ob.bidsMap[bestBidPrice]
		queue := bestBidLevel.Orders

		// Edge Case: Ghost price level
		if queue.Len() == 0 {
			ob.removeBidLevel(bestBidPrice)
			continue
		}

		element := queue.Front()
		makerOrder := element.Value.(*Order)

		tradeQty := math.Min(order.Quantity, makerOrder.Quantity)

		trades = append(trades, Trade{
			Price:       bestBidPrice,    // Trade invariably executes at the maker's resting price
			Quantity:    tradeQty,
			BuyOrderID:  makerOrder.ID,   // Maker is buyer
			SellOrderID: order.ID,        // Taker is seller
			BuyerID:     makerOrder.UserID,
			SellerID:    order.UserID,
			TakerSide:   Ask,
			Timestamp:   order.Timestamp, // Deterministic to taker arrival time
		})

		order.Quantity -= tradeQty
		makerOrder.Quantity -= tradeQty

		if makerOrder.Quantity == 0 {
			queue.Remove(element)
			delete(ob.ActiveOrders, makerOrder.ID)
		}

		if queue.Len() == 0 {
			ob.removeBidLevel(bestBidPrice)
		}
	}

	return trades
}

// removeBidLevel safely and efficiently removes a bid price level.
func (ob *OrderBook) removeBidLevel(price float64) {
	delete(ob.bidsMap, price)
	
	for i, p := range ob.bidsPrices {
		if p == price {
			// Fast slice deletion by shifting elements
			ob.bidsPrices = append(ob.bidsPrices[:i], ob.bidsPrices[i+1:]...)
			break
		}
	}
}

// removeAskLevel safely and efficiently removes an ask price level.
func (ob *OrderBook) removeAskLevel(price float64) {
	delete(ob.asksMap, price)
	
	for i, p := range ob.asksPrices {
		if p == price {
			ob.asksPrices = append(ob.asksPrices[:i], ob.asksPrices[i+1:]...)
			break
		}
	}
}
