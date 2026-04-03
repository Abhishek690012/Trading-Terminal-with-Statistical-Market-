package main

import (
	"fmt"
	"time"

	"backend/internal/api"
	"backend/internal/engine"
	"backend/internal/events"
	"backend/internal/market"
	"backend/internal/portfolio"
	"backend/internal/ws"

	"github.com/gin-gonic/gin"
)

func main() {
	fmt.Println("Initializing Trading Engine and Market Generator...")

	// 1. Initialize Engine
	eng := engine.NewEngine()

	// 2. Initialize Price Oracle (reference price = 100)
	// The oracle is updated every ~100ms from the engine's OrderBookDepth
	// snapshot. The generator reads it each tick to place orders around the
	// live mid-price — price is NEVER generated directly.
	oracle := market.NewPriceOracle(100.0)

	// 3. Initialize Market Generator (ZI + Market Maker, no GBM)
	gen := market.NewMarketGenerator(eng.OrderChannel(), oracle)

	// 4. Start Engine Goroutine
	eng.Start()

	// 5. Start Market Generator Goroutine
	gen.Start()

	// 6. Initialize Event Bus
	bus := events.NewEventBus(eng.TradeChannel())
	bus.Start()

	// 7. Initialize Portfolio Manager
	portMgr := portfolio.NewManager()
	go portMgr.Listen(bus.Subscribe())

	// 8. Initialize WebSocket Broadcaster
	wsBroadcaster := ws.NewBroadcaster()
	wsBroadcaster.Start()

	// 9. Initialize API Handler
	handler := api.NewHandler(eng, portMgr)
	router := gin.Default()

	// Enable CORS for frontend development
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	handler.RegisterRoutes(router)

	// 10. WebSocket Endpoint
	router.GET("/ws", func(c *gin.Context) {
		ws.ServeWS(wsBroadcaster, c.Writer, c.Request)
	})

	// 11. Run API Server in goroutine
	go func() {
		fmt.Println("API Server starting on :8080...")
		if err := router.Run(":8080"); err != nil {
			fmt.Printf("Failed to run server: %v\n", err)
		}
	}()

	fmt.Println("Systems running. Listening for trades and updates...")

	// 12. Main Logging / Broadcast Loop
	logChan := bus.Subscribe()
	for {
		select {
		case trade := <-logChan:
			// 1. Print executed trades to terminal
			fmt.Printf("[TRADE] Price: %.2f | Qty: %6.2f | Buyer: %s | Seller: %s | Time: %s\n",
				trade.Price,
				trade.Quantity,
				trade.BuyOrderID[:8],
				trade.SellOrderID[:8],
				time.Unix(0, trade.Timestamp).Format("15:04:05.000"),
			)

			// 2. Broadcast trade to WebSocket clients with full schema
			wsBroadcaster.Broadcast(ws.TradeMessage{
				Type:      "trade",
				Price:     trade.Price,
				Quantity:  trade.Quantity,
				Timestamp: trade.Timestamp / 1e6,
				Side:      string(trade.TakerSide),
			})

		case depth := <-eng.BroadcastChannel():
			// 1. Update the price oracle from the latest order book snapshot.
			if len(depth.Bids) > 0 && len(depth.Asks) > 0 {
				oracle.SetMid((depth.Bids[0][0] + depth.Asks[0][0]) / 2.0)
			} else if len(depth.Bids) > 0 {
				oracle.SetMid(depth.Bids[0][0])
			} else if len(depth.Asks) > 0 {
				oracle.SetMid(depth.Asks[0][0])
			}

			// 2. Broadcast orderbook snapshot to WebSocket clients
			wsBroadcaster.Broadcast(ws.OrderBookMessage{
				Type: "orderbook",
				Bids: depth.Bids,
				Asks: depth.Asks,
			})
		}
	}
}
