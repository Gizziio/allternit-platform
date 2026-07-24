package main

import (
	"bufio"
	"io"
	"net"
	"testing"
	"time"
)

// TestProxyConn bridges a client to a plain TCP echo server through proxyConn
// and verifies bidirectional flow plus half-close propagation: after the
// client CloseWrites, the echo server sees EOF and closes, and the client
// still reads the echoed reply followed by EOF.
func TestProxyConn(t *testing.T) {
	// Echo server: copies back until EOF, then closes.
	echoLn, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer echoLn.Close()
	go func() {
		conn, err := echoLn.Accept()
		if err != nil {
			return
		}
		io.Copy(conn, conn)
		conn.Close()
	}()

	// Tailnet-side stand-in: a plain listener whose accepted conn is proxied
	// to the echo server, exactly like forward() does.
	proxyLn, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer proxyLn.Close()
	go func() {
		conn, err := proxyLn.Accept()
		if err != nil {
			return
		}
		upstream, err := net.Dial("tcp", echoLn.Addr().String())
		if err != nil {
			conn.Close()
			return
		}
		proxyConn(upstream, conn)
	}()

	client, err := net.Dial("tcp", proxyLn.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	client.SetDeadline(time.Now().Add(5 * time.Second))

	if _, err := client.Write([]byte("ping\n")); err != nil {
		t.Fatal(err)
	}
	line, err := bufio.NewReader(client).ReadString('\n')
	if err != nil {
		t.Fatalf("reading echo: %v", err)
	}
	if line != "ping\n" {
		t.Fatalf("echo mismatch: got %q", line)
	}

	// Half-close: the echo server must see EOF and close, which propagates
	// back as EOF on the client without the proxy hanging.
	if err := client.(*net.TCPConn).CloseWrite(); err != nil {
		t.Fatal(err)
	}
	if _, err := client.Read(make([]byte, 1)); err != io.EOF {
		t.Fatalf("expected EOF after half-close, got %v", err)
	}
}
