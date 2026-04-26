#!/bin/bash
set -e

echo "Building Allternit Agent Workspace WASM package..."

# Clean previous builds
rm -rf pkg target/wasm32-unknown-unknown

# Build the WASM target
echo "Building wasm32 target..."
cargo build --target wasm32-unknown-unknown --no-default-features --features wasm --release

# Generate bindings
echo "Generating WASM bindings..."
wasm-bindgen target/wasm32-unknown-unknown/release/allternit_agent_workspace.wasm \
  --out-dir pkg \
  --typescript \
  --target web

# Create package.json if it doesn't exist
if [ ! -f pkg/package.json ]; then
    cat > pkg/package.json << 'JSON'
{
  "name": "@allternit/agent-workspace",
  "version": "0.1.0",
  "description": "Allternit Agent Workspace - WASM bindings for browser integration",
  "main": "allternit_agent_workspace.js",
  "types": "allternit_agent_workspace.d.ts",
  "files": [
    "allternit_agent_workspace.js",
    "allternit_agent_workspace.d.ts",
    "allternit_agent_workspace_bg.wasm",
    "allternit_agent_workspace_bg.wasm.d.ts"
  ],
  "sideEffects": false,
  "repository": {
    "type": "git",
    "url": "https://github.com/allternitchitect/allternit"
  },
  "license": "MIT OR Apache-2.0",
  "keywords": ["allternit", "agent", "workspace", "wasm", "ai"]
}
JSON
fi

echo "WASM package built successfully!"
echo "Location: $(pwd)/pkg/"
echo ""
echo "Files:"
ls -la pkg/
