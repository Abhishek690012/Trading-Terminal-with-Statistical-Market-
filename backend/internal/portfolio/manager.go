package portfolio

import (
	"sync"
	"backend/internal/engine"
)

// Portfolio represents the current financial state of a user.
type Portfolio struct {
	Cash   float64 `json:"cash"`
	Assets float64 `json:"assets"`
}

// Manager orchestrates all user portfolios in memory securely.
type Manager struct {
	mu         sync.RWMutex
	portfolios map[string]*Portfolio
}

// NewManager creates a thread-safe portfolio manager component.
func NewManager() *Manager {
	return &Manager{
		portfolios: make(map[string]*Portfolio),
	}
}

// getPortfolioInternal retrieves or creates a portfolio instance for an ID. Requires active Write Lock.
func (m *Manager) getPortfolioInternal(userID string) *Portfolio {
	port, exists := m.portfolios[userID]
	if !exists {
		// Default startup conditions: User receives 100,000 cash, 0 assets.
		port = &Portfolio{
			Cash:   100000.0,
			Assets: 0.0,
		}
		m.portfolios[userID] = port
	}
	return port
}

// GetPortfolio returns a snapshot (by value) of the user's balances safely.
func (m *Manager) GetPortfolio(userID string) Portfolio {
	m.mu.RLock()
	defer m.mu.RUnlock()

	port, exists := m.portfolios[userID]
	if !exists {
		return Portfolio{
			Cash:   100000.0,
			Assets: 0.0,
		}
	}
	return *port
}

// UpdateBalances safely commits a trade to user accounts.
func (m *Manager) UpdateBalances(buyerID string, sellerID string, price float64, quantity float64) {
	m.mu.Lock()
	defer m.mu.Unlock()

	cost := price * quantity

	// 1. Process Buyer: decrease cash, increase asset
	if buyerID != "" {
		buyerPort := m.getPortfolioInternal(buyerID)
		buyerPort.Cash -= cost
		buyerPort.Assets += quantity
	}

	// 2. Process Seller: increase cash, decrease asset
	if sellerID != "" {
		sellerPort := m.getPortfolioInternal(sellerID)
		sellerPort.Cash += cost
		sellerPort.Assets -= quantity
	}
}

// Listen spawns a background process that permanently consumes engine trades to record portfolio deltas.
// Best to be driven as a goroutine: go manager.Listen(e.TradeChannel())
func (m *Manager) Listen(tradeChan <-chan engine.Trade) {
	for trade := range tradeChan {
		m.UpdateBalances(trade.BuyerID, trade.SellerID, trade.Price, trade.Quantity)
	}
}
