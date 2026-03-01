#!/bin/bash
set -e

echo "Building A2R Agent Workspace WASM package..."

# Clean previous builds
rm -rf pkg target/wasm32-unknown-unknown

# Build the WASM target
echo "Building wasm32 target..."
cargo build --target wasm32-unknown-unknown --no-default-features --features wasm --release

# Generate bindings
echo "Generating WASM bindings..."
wasm-bindgen target/wasm32-unknown-unknown/release/a2r_agent_workspace.wasm \
  --out-dir pkg \
  --typescript \
  --target web

# Create package.json if it doesn't exist
if [ ! -f pkg/package.json ]; then
    cat > pkg/package.json << 'JSON'
{
  "name": "@a2r/agent-workspace",
  "version": "0.1.0",
  "description": "A2R Agent Workspace - WASM bindings for browser integration",
  "main": "a2r_agent_workspace.js",
  "types": "a2r_agent_workspace.d.ts",
  "files": [
    "a2r_agent_workspace.js",
    "a2r_agent_workspace.d.ts",
    "a2r_agent_workspace_bg.wasm",
    "a2r_agent_workspace_bg.wasm.d.ts"
  ],
  "sideEffects": false,
  "repository": {
    "type": "git",
    "url": "https://github.com/a2rchitect/a2rchitech"
  },
  "license": "MIT OR Apache-2.0",
  "keywords": ["a2r", "agent", "workspace", "wasm", "ai"]
}
JSON
fi

echo "WASM package built successfully!"
echo "Location: $(pwd)/pkg/"
echo ""
echo "Files:"
ls -la pkg/
