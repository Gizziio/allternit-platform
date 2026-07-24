// Package mesh wraps tailscale.com/tsnet behind a minimal, gomobile-friendly
// API so the Allternit iOS app can embed a userspace Tailscale node.
//
// gomobile constraints honored here: exported identifiers only, supported
// types only (string, bool, error), no channels, no generics.
package mesh

import (
	"context"
	"errors"
	"io"
	"net/http"
	"sync"
	"time"

	"tailscale.com/tsnet"
)

// maxGetBody caps the response size returned by Get so a large tailnet
// response cannot blow up the app's memory.
const maxGetBody = 4 << 20 // 4 MiB

// Node is a single embedded tailnet node. Create it with NewNode, then call
// Start. A Node is not reusable after Close.
type Node struct {
	mu       sync.Mutex
	hostname string
	srv      *tsnet.Server
}

// NewNode creates a Node that will join the tailnet under the given hostname.
// The node is not started yet; call Start.
func NewNode(hostname string) *Node {
	return &Node{hostname: hostname}
}

// Start brings the node up on the tailnet and blocks until it is online or
// the attempt fails.
//
// controlURL is the coordination server (leave empty for the hosted Tailscale
// control plane, or pass a Headscale URL). authKey is a pre-auth key (or a
// Headscale pre-auth key). dataDir must be a writable, persistent directory
// inside the app's sandbox (e.g. Application Support/mesh); tsnet stores its
// node key and state there.
func (n *Node) Start(controlURL, authKey, dataDir string) error {
	n.mu.Lock()
	defer n.mu.Unlock()
	if n.srv != nil {
		return errors.New("mesh: node already started")
	}
	if dataDir == "" {
		return errors.New("mesh: dataDir is required")
	}
	srv := &tsnet.Server{
		Dir:        dataDir,
		Hostname:   n.hostname,
		ControlURL: controlURL,
		AuthKey:    authKey,
		Ephemeral:  false,
		Logf:       func(string, ...any) {}, // stay quiet on iOS
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	if _, err := srv.Up(ctx); err != nil {
		return err
	}
	n.srv = srv
	return nil
}

// MeshIP returns the node's tailnet IPv4 address (100.64.0.0/10 range), or
// an empty string if the node is not up.
func (n *Node) MeshIP() string {
	n.mu.Lock()
	srv := n.srv
	n.mu.Unlock()
	if srv == nil {
		return ""
	}
	lc, err := srv.LocalClient()
	if err != nil {
		return ""
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	st, err := lc.Status(ctx)
	if err != nil || st.Self == nil {
		return ""
	}
	for _, ip := range st.Self.TailscaleIPs {
		if ip.Is4() {
			return ip.String()
		}
	}
	return ""
}

// Get fetches an HTTP URL through the tailnet using this node's identity and
// returns the response body (capped at 4 MiB). Use it to reach tailnet-only
// services (e.g. http://other-node:8080/...).
func (n *Node) Get(url string) (string, error) {
	n.mu.Lock()
	srv := n.srv
	n.mu.Unlock()
	if srv == nil {
		return "", errors.New("mesh: node not started")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	resp, err := srv.HTTPClient().Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxGetBody))
	if err != nil {
		return "", err
	}
	return string(body), nil
}

// Close shuts the node down and releases its resources. The Node must not be
// used afterwards; create a fresh one with NewNode to reconnect.
func (n *Node) Close() error {
	n.mu.Lock()
	defer n.mu.Unlock()
	if n.srv == nil {
		return nil
	}
	err := n.srv.Close()
	n.srv = nil
	return err
}
