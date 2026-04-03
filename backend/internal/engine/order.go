package engine

// Side represents the direction of an order: Buy (Bid) or Sell (Ask).
type Side string

const (
	Bid Side = "BID"
	Ask Side = "ASK"
)

// OrderType defines whether an order is a Market or Limit order.
type OrderType string

const (
	Market OrderType = "MARKET"
	Limit  OrderType = "LIMIT"
	Cancel OrderType = "CANCEL"
)

// Order represents a single trade order.
type Order struct {
	ID        string
	UserID    string
	Type      OrderType
	Price     float64
	Quantity  float64
	Side      Side
	Timestamp int64 // Unix timestamp to enforce time-priority
}
