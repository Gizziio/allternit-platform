// Command mesh-node is a small tsnet sidecar for `gizzi serve --mesh`. It
// joins the tailnet in pure userspace mode (no root, no TUN, no system
// tailscaled) and listens on the tailnet, forwarding each accepted connection
// to the local gizzi port. Unlike a userspace tailscaled — which gives the
// host no routable 100.x interface — tsnet's Listen accepts inbound tailnet
// connections directly, so the node's mesh IP is actually reachable from
// other tailnet nodes (e.g. the iOS app with its embedded tsnet).
//
// Contract with the parent process (gizzi-code's mesh.ts): on success exactly
// one line is printed to stdout — `MESH_READY ip=<100.x addr>` — which the
// parent scrapes. Any failure prints `MESH_ERROR reason=...` to stderr and
// exits non-zero. SIGTERM/SIGINT shut down cleanly (exit 0).
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"net"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"tailscale.com/tsnet"
)

const defaultControlURL = "https://allternit-headscale.fly.dev"

func defaultDataDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(os.TempDir(), "gizzi-mesh-node")
	}
	return filepath.Join(home, ".local", "share", "gizzi-code", "mesh-node")
}

func main() {
	hostname := flag.String("hostname", "gizzi-node", "hostname to join the tailnet under")
	controlURL := flag.String("control-url", defaultControlURL, "coordination server (Headscale) URL")
	authKey := flag.String("auth-key", os.Getenv("MESH_AUTH_KEY"), "pre-auth key (or env MESH_AUTH_KEY)")
	dataDir := flag.String("data-dir", defaultDataDir(), "tsnet state directory (node key lives here)")
	forwardPort := flag.Int("forward", 4096, "local gizzi port to proxy tailnet connections to")
	listenPort := flag.Int("listen", 0, "tailnet-side listen port (default: same as --forward)")
	upTimeout := flag.Duration("up-timeout", 60*time.Second, "how long to wait for the tailnet join")
	debug := flag.Bool("debug", false, "log tsnet and connection events to stderr")
	flag.Parse()

	listen := *listenPort
	if listen == 0 {
		listen = *forwardPort
	}

	// Stay quiet by default: stdout is reserved for the MESH_READY contract
	// line and stderr for MESH_ERROR; anything else only with --debug.
	logf := func(string, ...any) {}
	if *debug {
		logf = func(format string, args ...any) {
			fmt.Fprintf(os.Stderr, "mesh-node: "+format+"\n", args...)
		}
	}

	if err := run(*hostname, *controlURL, *authKey, *dataDir, *forwardPort, listen, *upTimeout, logf); err != nil {
		fmt.Fprintf(os.Stderr, "MESH_ERROR reason=%s\n", err)
		os.Exit(1)
	}
}

func run(hostname, controlURL, authKey, dataDir string, forwardPort, listenPort int, upTimeout time.Duration, logf func(string, ...any)) error {
	if err := os.MkdirAll(dataDir, 0o700); err != nil {
		return fmt.Errorf("creating data dir: %w", err)
	}
	srv := &tsnet.Server{
		Dir:        dataDir,
		Hostname:   hostname,
		ControlURL: controlURL,
		AuthKey:    authKey,
		Ephemeral:  false,
		Logf:       logf,
	}
	ctx, cancel := context.WithTimeout(context.Background(), upTimeout)
	defer cancel()
	st, err := srv.Up(ctx)
	if err != nil {
		return fmt.Errorf("joining tailnet (check the auth key and control URL): %w", err)
	}
	var ip string
	if st.Self != nil {
		for _, addr := range st.Self.TailscaleIPs {
			if addr.Is4() {
				ip = addr.String()
				break
			}
		}
	}
	if ip == "" {
		return errors.New("tailnet joined but no tailnet IPv4 address was assigned")
	}

	ln, err := srv.Listen("tcp", fmt.Sprintf(":%d", listenPort))
	if err != nil {
		return fmt.Errorf("listening on tailnet port %d: %w", listenPort, err)
	}

	// The parent scrapes exactly this line; keep it the only stdout output.
	fmt.Printf("MESH_READY ip=%s\n", ip)

	done := make(chan struct{})
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
	go func() {
		<-sigCh
		close(done)
		ln.Close()
	}()

	for {
		conn, err := ln.Accept()
		if err != nil {
			select {
			case <-done:
				// SIGTERM path: close listener, close server, exit 0.
				return srv.Close()
			default:
				return fmt.Errorf("accepting on tailnet listener: %w", err)
			}
		}
		logf("accepted tailnet connection from %s", conn.RemoteAddr())
		go forward(conn, forwardPort, logf)
	}
}

// forward bridges one tailnet-side connection to the local gizzi port.
func forward(tailnetConn net.Conn, forwardPort int, logf func(string, ...any)) {
	local, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", forwardPort), 10*time.Second)
	if err != nil {
		logf("dialing 127.0.0.1:%d: %v", forwardPort, err)
		tailnetConn.Close()
		return
	}
	proxyConn(local, tailnetConn)
}
