package ws

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

// Configure the Gorilla WebSocket upgrader.
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Permissive CheckOrigin enables UI connections natively during testing
	CheckOrigin: func(r *http.Request) bool {
		return true 
	},
}

// ServeWS processes the standard HTTP request routing, upgrading it to a persistent WebSocket connection.
func ServeWS(b *Broadcaster, w http.ResponseWriter, r *http.Request) {
	// Upgrade the HTTP request to WebSocket protocol
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade WebSocket connection: %v", err)
		return
	}

	// Successfully upgraded; register this brand-new client to receive engine broadcasts safely
	b.Register(conn)

	// Guarantee cleanup routines are run reliably when this underlying goroutine eventually terminates
	defer func() {
		b.Unregister(conn)
	}()

	// The Gorilla WebSocket must indefinitely block and read messages from the client.
	// A long-running Read loop is required to natively detect when the peer disconnects/closes their window.
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			// Filter and mute normal, expected closure events to prevent log spamming
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WS client read error: %v", err)
			}
			break // Break tears down the loop, executing the deferred Unregister cleanly
		}
		// Inbound messaging (Client -> Server) feature logic slot if required in the future
	}
}
