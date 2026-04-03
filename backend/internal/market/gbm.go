// Package market provides the synthetic market simulation components.
// gbm.go is intentionally empty — the GBM price simulator has been replaced
// by an order-flow-driven model (generator.go + oracle.go) where price
// emerges from the matching engine rather than being generated directly.
package market
