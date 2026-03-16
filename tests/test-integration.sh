#!/bin/bash
# A2R Integration Test Script
# Tests connectivity between all components

# set -e  # Don't exit on error, show all test results

echo "======================================"
echo "A2R Product Integration Test"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: Cloud Backend
echo "[1/4] Testing Cloud Backend..."
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "${GREEN}✓${NC} Cloud Backend is running on port 8080"
else
    echo "${RED}✗${NC} Cloud Backend is NOT running"
    echo "      Start it with: cd 7-apps/cloud-backend && npm start"
    exit 1
fi

# Test 2: Desktop Cowork Port
echo ""
echo "[2/4] Testing Desktop Cowork Mode..."
if lsof -i :3010 > /dev/null 2>&1; then
    echo "${GREEN}✓${NC} Desktop Cowork controller is running on port 3010"
else
    echo "${RED}✗${NC} Desktop Cowork controller is NOT running (expected if Desktop not started)"
fi

# Test 3: Desktop Native Messaging Port
echo ""
echo "[3/4] Testing Desktop Native Messaging..."
if lsof -i :3011 > /dev/null 2>&1; then
    echo "${GREEN}✓${NC} Desktop Native Messaging is running on port 3011"
else
    echo "${RED}✗${NC} Desktop Native Messaging is NOT running (expected if Desktop not started)"
fi

# Test 4: Check Thin Client exists
echo ""
echo "[4/4] Checking Thin Client packages..."
if [ -f "7-apps/thin-client/release/Gizzi Thin Client-0.1.0-arm64.dmg" ]; then
    echo "${GREEN}✓${NC} Thin Client macOS ARM64 package exists"
else
    echo "${RED}✗${NC} Thin Client package not found"
fi

if [ -f "7-apps/thin-client/release/Gizzi Thin Client-0.1.0.dmg" ]; then
    echo "${GREEN}✓${NC} Thin Client macOS Intel package exists"
fi

if [ -f "7-apps/thin-client/release/Gizzi Thin Client Setup 0.1.0.exe" ]; then
    echo "${GREEN}✓${NC} Thin Client Windows package exists"
fi

if [ -f "7-apps/thin-client/release/gizzi-thin-client-0.1.0-x86_64.AppImage" ]; then
    echo "${GREEN}✓${NC} Thin Client Linux package exists"
fi

echo ""
echo "======================================"
echo "Test Summary"
echo "======================================"
echo ""
echo "Core services status:"
echo "- Cloud Backend: Running (required)"
echo "- Desktop: Not running (start manually)"
echo ""
echo "Next steps:"
echo "1. Load extension in Chrome:"
echo "   chrome://extensions -> Developer mode -> Load unpacked"
echo "   Select: 7-apps/chrome-extension/dist/"
echo ""
echo "2. Run Thin Client:"
echo "   open '7-apps/thin-client/release/Gizzi Thin Client-0.1.0-arm64.app'"
echo ""
echo "3. Test connection modes:"
echo "   - Cloud mode: Connects to localhost:8080"
echo "   - Cowork mode: Connects to localhost:3010"
echo ""
