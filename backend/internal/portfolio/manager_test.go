package portfolio

import (
	"math"
	"sync"
	"testing"
	"time"

	"backend/internal/engine"
)

func TestNewManager(t *testing.T) {
	m := NewManager()
	if m == nil {
		t.Fatal("Expected NewManager to return a valid instance")
	}

	// Unseen user should default to 100,000 cash and 0 assets.
	port := m.GetPortfolio("user1")
	if port.Cash != 100000.0 {
		t.Errorf("Expected 100000 cash, got %f", port.Cash)
	}
	if port.Assets != 0.0 {
		t.Errorf("Expected 0 assets, got %f", port.Assets)
	}
}

func TestUpdateBalances(t *testing.T) {
	m := NewManager()

	// buyerID="alice", sellerID="bob", price=100, quantity=5
	m.UpdateBalances("alice", "bob", 100.0, 5.0)

	alice := m.GetPortfolio("alice")
	if alice.Cash != 100000.0-500.0 {
		t.Errorf("Expected Alice cash 99500, got %f", alice.Cash)
	}
	if alice.Assets != 5.0 {
		t.Errorf("Expected Alice assets 5, got %f", alice.Assets)
	}

	bob := m.GetPortfolio("bob")
	if bob.Cash != 100000.0+500.0 {
		t.Errorf("Expected Bob cash 100500, got %f", bob.Cash)
	}
	if bob.Assets != -5.0 {
		t.Errorf("Expected Bob assets -5, got %f", bob.Assets)
	}
}

func TestListenConcurrency(t *testing.T) {
	m := NewManager()
	tradeChan := make(chan engine.Trade, 100)

	go m.Listen(tradeChan)

	var wg sync.WaitGroup
	// Simulate 100 concurrent trades
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			tradeChan <- engine.Trade{
				Price:      10.0,
				Quantity:   2.0,
				BuyerID:    "traderA",
				SellerID:   "traderB",
			}
		}()
	}

	wg.Wait()
	// give the channel a tiny bit of time to drain
	time.Sleep(50 * time.Millisecond)

	traderA := m.GetPortfolio("traderA")
	traderB := m.GetPortfolio("traderB")

	// 100 trades * 10 price * 2 quantity = 2000 total cash exchanged
	expectedCashA := 100000.0 - 2000.0
	expectedAssetsA := 200.0
	expectedCashB := 100000.0 + 2000.0
	expectedAssetsB := -200.0

	if math.Abs(traderA.Cash-expectedCashA) > 0.001 {
		t.Errorf("Expected Trader A cash %f, got %f", expectedCashA, traderA.Cash)
	}
	if math.Abs(traderA.Assets-expectedAssetsA) > 0.001 {
		t.Errorf("Expected Trader A assets %f, got %f", expectedAssetsA, traderA.Assets)
	}
	if math.Abs(traderB.Cash-expectedCashB) > 0.001 {
		t.Errorf("Expected Trader B cash %f, got %f", expectedCashB, traderB.Cash)
	}
	if math.Abs(traderB.Assets-expectedAssetsB) > 0.001 {
		t.Errorf("Expected Trader B assets %f, got %f", expectedAssetsB, traderB.Assets)
	}
}
