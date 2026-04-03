package engine

// Trade represents an executed transaction between a buyer and a seller.
type Trade struct {
	Price       float64
	Quantity    float64
	BuyOrderID  string
	SellOrderID string
	BuyerID     string
	SellerID    string
	TakerSide   Side  // Direction of the order that triggered this trade
	Timestamp   int64 // Unix timestamp conceptually matching the taking order's time
}
