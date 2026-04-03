package market

import (
	"crypto/rand"
	"fmt"
	"math"
	mathrand "math/rand"
	"time"

	"backend/internal/engine"
)

// ActiveOrder tracks orders placed by the simulator to cancel them later.
type ActiveOrder struct {
	ID    string
	Side  engine.Side
	Price float64
	Tick  int
}

// MarketGenerator drives a synthetic market using a GBM-based reference price
// with mean reversion, placing limit orders around the current price.
type MarketGenerator struct {
	engineOrderChannel chan<- *engine.Order

	currentPrice   float64
	referencePrice float64

	// Configurable parameters
	mu         float64 // drift
	sigma      float64 // volatility
	k          float64 // mean reversion strength
	N          int     // orders per side per tick
	maxTickAge int     // ticks before an order is cancelled

	// State tracking
	activeOrders []ActiveOrder
	tickCounter  int
}

// NewMarketGenerator initializes a GBM-driven order flow simulator.
// It accepts oracle for compatibility but uses its fallback/initial price
// strictly as the referencePrice to prevent drifting infinitely.
func NewMarketGenerator(orderChannel chan<- *engine.Order, oracle *PriceOracle) *MarketGenerator {
	s0 := oracle.Fallback()
	if s0 <= 0 {
		s0 = 100.0 // Ensure valid initial price
	}

	return &MarketGenerator{
		engineOrderChannel: orderChannel,
		currentPrice:       s0,
		referencePrice:     s0,
		mu:                 0.0005, // small drift
		sigma:              0.015,  // reduced volatility (0.01 to 0.02)
		k:                  0.0005, // light mean reversion pull
		N:                  5,      // 5 bids and 5 asks per tick
		maxTickAge:         50,     // e.g. 5 seconds at 10 ticks/sec
		activeOrders:       make([]ActiveOrder, 0, 1000),
	}
}

// Start runs the tick loop continuously at ~10 ticks/sec
func (m *MarketGenerator) Start() {
	go func() {
		// ~10 ticks/sec -> 100ms
		ticker := time.NewTicker(100 * time.Millisecond)
		defer ticker.Stop()

		for range ticker.C {
			m.tickCounter++

			// ── LIMIT EXTREME Z VALUES ──
			z := mathrand.NormFloat64()
			z = math.Max(math.Min(z, 2.5), -2.5)

			// ── 1. IMPLEMENT GBM PRICE EVOLUTION (WITH DT) ──
			dt := 0.1
			drift := (m.mu - 0.5*m.sigma*m.sigma) * dt
			diffusion := m.sigma * math.Sqrt(dt) * z
			newPrice := m.currentPrice * math.Exp(drift+diffusion)

			// ── 3. CLAMP MAX MOVEMENT PER TICK ──
			maxMove := 0.002 * m.currentPrice
			delta := newPrice - m.currentPrice
			if delta > maxMove {
				delta = maxMove
			} else if delta < -maxMove {
				delta = -maxMove
			}
			newPrice = m.currentPrice + delta

			// ── 4. ADD SMOOTHING ──
			newPrice = 0.8*m.currentPrice + 0.2*newPrice

			// ── 6. KEEP MEAN REVERSION LIGHT ──
			newPrice += m.k * (m.referencePrice - newPrice)

			m.currentPrice = newPrice

			// ── 8. SAFETY: Ensure price never goes negative ──
			if m.currentPrice < 0.01 {
				m.currentPrice = 0.01
			}

			// ── 3. GENERATE LIMIT ORDERS ──
			// Generate N bids and N asks
			for i := 0; i < m.N; i++ {
				m.generateLimitOrder(engine.Bid)
				m.generateLimitOrder(engine.Ask)
			}

			// ── 5. CANCEL OLD ORDERS ──
			m.cancelOldOrders()
		}
	}()
}

// generateLimitOrder creates a single limit order at a random distance from the current price.
func (m *MarketGenerator) generateLimitOrder(side engine.Side) {
	// spread = random value (e.g., 0.5 to 60)
	// Add 20% chance for an "aggressive" order that crosses the mid to trigger trades.
	spread := 0.5 + mathrand.Float64()*59.5
	if mathrand.Float64() < 0.20 {
		spread = -0.1 - mathrand.Float64()*0.5 // Crosses by 0.1 to 0.6
	}
	
	// quantity = random (0.01 to 3)
	qty := 0.01 + mathrand.Float64()*2.99

	var price float64
	if side == engine.Bid {
		price = m.currentPrice - spread
		if price <= 0.01 {
			price = 0.01
		}
	} else {
		price = m.currentPrice + spread
	}

	// ── 6. ORDER CREATION FUNCTION ──
	// Note: We use engine.Order which fulfills backend fields like ID, Side, Type, Price, Quantity, Timestamp
	id := generateID()
	
	// Snap price and qty to 2 decimals for realistic values
	snapPrice := math.Round(price*100) / 100
	snapQty := math.Round(qty*1000) / 1000
	if snapQty <= 0 {
		snapQty = 0.01 // Safety
	}

	ord := &engine.Order{
		ID:        id,
		Type:      engine.Limit,
		Side:      side,
		Price:     snapPrice,
		Quantity:  snapQty,
		Timestamp: time.Now().UnixNano(),
	}

	// ── 4. TRACK ACTIVE ORDERS ──
	m.activeOrders = append(m.activeOrders, ActiveOrder{
		ID:    id,
		Side:  side,
		Price: snapPrice,
		Tick:  m.tickCounter,
	})

	// ── 9. INTEGRATION ──
	// Push orders into existing queue/channel cleanly
	m.engineOrderChannel <- ord
}

func (m *MarketGenerator) cancelOldOrders() {
	var kept []ActiveOrder

	for _, ao := range m.activeOrders {
		age := m.tickCounter - ao.Tick
		if age > m.maxTickAge {
			// Send cancel message
			m.engineOrderChannel <- &engine.Order{
				ID:        ao.ID,
				Type:      engine.Cancel,
				Side:      ao.Side,
				Price:     ao.Price,
				Timestamp: time.Now().UnixNano(),
			}
		} else {
			kept = append(kept, ao)
		}
	}

	m.activeOrders = kept
}

func generateID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("%x", b)
}

