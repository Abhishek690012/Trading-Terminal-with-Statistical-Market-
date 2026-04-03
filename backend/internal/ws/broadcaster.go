package ws

import (
	"log"
	"time"

	"github.com/gorilla/websocket"
)

// Broadcaster manages active WebSocket clients and broadcasts JSON messages to them.
type Broadcaster struct {
	// Registered connected clients.
	clients map[*websocket.Conn]bool

	// Inbound requests from the clients to register.
	register chan *websocket.Conn

	// Inbound requests from the clients to unregister.
	unregister chan *websocket.Conn

	// Inbound messages to broadcast to connected clients.
	broadcast chan interface{}
}

// NewBroadcaster creates and initializes a new Broadcaster instance.
func NewBroadcaster() *Broadcaster {
	return &Broadcaster{
		clients:    make(map[*websocket.Conn]bool),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
		broadcast:  make(chan interface{}, 1000), // Buffer messages to keep it non-blocking
	}
}

// Start runs the broadcaster in a new background goroutine using a select event loop.
func (b *Broadcaster) Start() {
	go func() {
		for {
			select {
			case client := <-b.register:
				b.clients[client] = true
				log.Printf("WS Client registered. Total clients: %d", len(b.clients))

			case client := <-b.unregister:
				if _, ok := b.clients[client]; ok {
					b.removeClient(client)
					log.Printf("WS Client unregistered. Total clients: %d", len(b.clients))
				}

			case message := <-b.broadcast:
				// Push the message to all connected clients
				for client := range b.clients {
					// Set a more relaxed write deadline to ensure slow network clients don't block the loop
					err := client.SetWriteDeadline(time.Now().Add(2 * time.Second))
					if err != nil {
						log.Printf("WS SetWriteDeadline error: %v", err)
						b.removeClient(client)
						continue
					}

					// Use JSON encoding for WebSocket messages natively
					err = client.WriteJSON(message)
					if err != nil {
						log.Printf("WS Write error: %v", err)
						b.removeClient(client)
					}
				}
			}
		}
	}()
}

// Register requests the addition of a new client connection to the broadcast pool.
func (b *Broadcaster) Register(client *websocket.Conn) {
	b.register <- client
}

// Unregister requests the removal of an active client connection from the pool.
func (b *Broadcaster) Unregister(client *websocket.Conn) {
	b.unregister <- client
}

// Broadcast securely pushes a message into the broadcast channel.
func (b *Broadcaster) Broadcast(message interface{}) {
	select {
	case b.broadcast <- message:
	default:
		log.Println("Broadcaster overloaded. Dropping broadcast message.")
	}
}

// removeClient cleans up a client connection and removes it from the active map.
func (b *Broadcaster) removeClient(client *websocket.Conn) {
	client.Close() // Make sure underlying connection is forcefully closed
	delete(b.clients, client)
}
