package api

import (
	"net/http"
	"strings"
	"time"

	"backend/internal/engine"
	"backend/internal/portfolio"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type OrderRequest struct {
	UserID   string  `json:"user_id" binding:"required"`
	Type     string  `json:"type" binding:"required"`
	Side     string  `json:"side" binding:"required"`
	Price    float64 `json:"price"`
	Quantity float64 `json:"quantity" binding:"required,gt=0"`
}

type CancelRequest struct {
	OrderID string `json:"order_id" binding:"required"`
}

func NewHandler(e *engine.Engine, pm *portfolio.Manager) *Handler {
	return &Handler{
		engine:    e,
		portfolio: pm,
	}
}

type Handler struct {
	engine    *engine.Engine
	portfolio *portfolio.Manager
}

func (h *Handler) PlaceOrder(c *gin.Context) {
	var req OrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	reqType := strings.ToUpper(req.Type)
	reqSide := strings.ToUpper(req.Side)

	// Validate Type
	if reqType != string(engine.Market) && reqType != string(engine.Limit) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid order type, must be LIMIT or MARKET"})
		return
	}

	// Validate Side
	if reqSide != string(engine.Bid) && reqSide != string(engine.Ask) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid side, must be BID or ASK"})
		return
	}

	// Validate Price for LIMIT orders
	if reqType == string(engine.Limit) && req.Price <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "price must be > 0 for LIMIT orders"})
		return
	}

	orderID := uuid.New().String()

	order := &engine.Order{
		ID:        orderID,
		UserID:    req.UserID,
		Type:      engine.OrderType(reqType),
		Side:      engine.Side(reqSide),
		Price:     req.Price,
		Quantity:  req.Quantity,
		Timestamp: time.Now().UnixNano(),
	}

	// Send order to engine via orderChannel
	h.engine.SubmitOrder(order)

	// Return JSON response success
	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"order_id": orderID,
	})
}

func (h *Handler) CancelOrder(c *gin.Context) {
	var req CancelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	order := &engine.Order{
		ID:        req.OrderID,
		Type:      engine.Cancel,
		Timestamp: time.Now().UnixNano(),
	}

	// Send cancel request to engine
	h.engine.SubmitOrder(order)

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"order_id": req.OrderID,
	})
}

func (h *Handler) GetPortfolio(c *gin.Context) {
	userID := c.Query("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "user_id is required"})
		return
	}

	p := h.portfolio.GetPortfolio(userID)
	c.JSON(http.StatusOK, gin.H{
		"cash":  p.Cash,
		"asset": p.Assets,
	})
}

// RegisterRoutes binds the handlers to the Gin router
func (h *Handler) RegisterRoutes(router *gin.Engine) {
	router.POST("/order", h.PlaceOrder)
	router.POST("/cancel", h.CancelOrder)
	router.GET("/portfolio", h.GetPortfolio)
}
