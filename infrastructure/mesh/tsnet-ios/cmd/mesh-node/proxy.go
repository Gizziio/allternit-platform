package main

import (
	"io"
	"net"
	"sync"
)

// proxyConn shuttles bytes between a and b in both directions until both
// copies finish, then closes both. A half-close is propagated to the other
// side when the connection supports it (TCP), so a peer that signals EOF
// still receives the remaining response from the other direction.
func proxyConn(a, b net.Conn) {
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		io.Copy(a, b)
		closeWrite(a)
	}()
	go func() {
		defer wg.Done()
		io.Copy(b, a)
		closeWrite(b)
	}()
	wg.Wait()
	a.Close()
	b.Close()
}

// closeWrite propagates EOF without closing the read side; a no-op for
// connection types without half-close support.
func closeWrite(c net.Conn) {
	if tc, ok := c.(*net.TCPConn); ok {
		_ = tc.CloseWrite()
	}
}
