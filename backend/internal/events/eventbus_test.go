package events

import (
	"sync"
	"testing"
	"time"

	"backend/internal/engine"
)

// 1. FUNCTIONAL CORRECTNESS
func TestEventBus_FunctionalCorrectness(t *testing.T) {
	tradeChan := make(chan engine.Trade, 100)
	bus := NewEventBus(tradeChan)

	portChan := bus.Subscribe()
	wsChan := bus.Subscribe()

	bus.Start()

	expectedTrades := []engine.Trade{
		{BuyOrderID: "T1"},
		{BuyOrderID: "T2"},
		{BuyOrderID: "T3"},
	}

	for _, tr := range expectedTrades {
		tradeChan <- tr
	}

	time.Sleep(50 * time.Millisecond) // Allow routing

	// 1.1 All Subscribers Receive ALL Trades & 1.2 No Duplications
	if len(portChan) != len(expectedTrades) {
		t.Fatalf("Portfolio channel got %d trades, expected %d", len(portChan), len(expectedTrades))
	}
	if len(wsChan) != len(expectedTrades) {
		t.Fatalf("WS channel got %d trades, expected %d", len(wsChan), len(expectedTrades))
	}

	// 1.3 Order of Trades Preserved
	for i, expected := range expectedTrades {
		pGot := <-portChan
		wGot := <-wsChan
		if pGot.BuyOrderID != expected.BuyOrderID {
			t.Errorf("Portfolio order mismatch at index %d: expected %s, got %s", i, expected.BuyOrderID, pGot.BuyOrderID)
		}
		if wGot.BuyOrderID != expected.BuyOrderID {
			t.Errorf("WS order mismatch at index %d: expected %s, got %s", i, expected.BuyOrderID, wGot.BuyOrderID)
		}
	}
}

// 2. CONCURRENCY & 3. PERFORMANCE BEHAVIOR
func TestEventBus_SlowConsumerNoBlocking(t *testing.T) {
	tradeChan := make(chan engine.Trade, 100)
	bus := NewEventBus(tradeChan)

	fastChan := bus.Subscribe()
	slowChan := bus.Subscribe()
	bus.Start()

	var fastCount int
	var mu sync.Mutex

	// Actively drain fastChan
	go func() {
		for range fastChan {
			mu.Lock()
			fastCount++
			mu.Unlock()
		}
	}()

	// slowChan does NOT read. It will fill its 1000 buffer and block.
	// Since EventBus drops on block, it shouldn't freeze fastChan.
	numTrades := 2000
	for i := 0; i < numTrades; i++ {
		tradeChan <- engine.Trade{Price: float64(i)}
	}

	// Wait for bus to route all
	time.Sleep(100 * time.Millisecond)

	mu.Lock()
	defer mu.Unlock()

	// Ensure Engine Never Blocks (achieved if EventBus drops safely instead of stalling)
	if fastCount != numTrades {
		t.Errorf("Expected fast consumer to get ALL %d events, got %d", numTrades, fastCount)
	}

	// slowChan capped exactly at its 1000 channel buffer limit!
	if len(slowChan) != 1000 {
		t.Errorf("Expected slow consumer to have capped 1000 buffer, got %d", len(slowChan))
	}
}

// 4. FAILURE HANDLING
func TestEventBus_SubscriberCrashIsolation(t *testing.T) {
	tradeChan := make(chan engine.Trade, 10)
	bus := NewEventBus(tradeChan)

	goodChan := bus.Subscribe()
	crashingChan := bus.Subscribe()

	bus.Start()

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		defer func() {
			if r := recover(); r != nil {
				// Crashing module gracefully recovered its panic boundaries
			}
		}()
		<-crashingChan
		panic("Simulated WS Subsystem crash!")
	}()

	// Trigger the crash natively down that listener path
	tradeChan <- engine.Trade{BuyOrderID: "CRASH"}
	wg.Wait()

	// Validate remaining functional boundaries
	tradeChan <- engine.Trade{BuyOrderID: "SAFE"}
	time.Sleep(10 * time.Millisecond)

	if len(goodChan) != 2 {
		t.Errorf("Expected Good consumer to retain stability and queue 2 trades, got %d", len(goodChan))
	}
}
