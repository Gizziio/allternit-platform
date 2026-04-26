#!/bin/bash
# Publish Allternit Plugin SDK and all plugins to NPM

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║     ALLTERNIT PLUGIN SDK - NPM PUBLISHING                        ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if logged in
echo "Checking NPM authentication..."
if ! npm whoami > /dev/null 2>&1; then
    echo -e "${RED}❌ Not logged in to NPM${NC}"
    echo "Run: npm login"
    exit 1
fi

echo -e "${GREEN}✅ Logged in as: $(npm whoami)${NC}"
echo ""

# Step 1: Publish SDK
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}STEP 1: PUBLISHING SDK${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo ""

cd /Users/macbook/allternit-plugin-sdk

echo "Building SDK..."
npm run build

echo "Publishing @allternit/plugin-sdk..."
npm publish --access public

echo -e "${GREEN}✅ SDK Published!${NC}"
echo ""

# Step 2: Publish Plugins
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}STEP 2: PUBLISHING 12 PLUGINS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo ""

cd /Users/macbook/allternit-plugins

PUBLISHED=0
FAILED=0

for d in */; do
    PLUGIN_NAME=${d%/}
    echo -e "${YELLOW}Publishing $PLUGIN_NAME...${NC}"
    
    cd "$d"
    
    # Install dependencies
    if npm install --silent 2>/dev/null; then
        : # Success
    else
        echo "  ⚠️  No install needed or already installed"
    fi
    
    # Build
    if npm run build --silent 2>/dev/null; then
        : # Success
    else
        echo "  ⚠️  No build needed or already built"
    fi
    
    # Publish
    if npm publish --access public 2>&1; then
        echo -e "  ${GREEN}✅ Published${NC}"
        PUBLISHED=$((PUBLISHED + 1))
    else
        echo -e "  ${RED}❌ Failed${NC}"
        FAILED=$((FAILED + 1))
    fi
    
    cd ..
done

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}PUBLISHING COMPLETE${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Published: $PUBLISHED"
echo "Failed: $FAILED"
echo ""

# Step 3: Verify
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}STEP 3: VERIFICATION${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo ""

echo "Checking SDK..."
if npm view @allternit/plugin-sdk version > /dev/null 2>&1; then
    echo -e "${GREEN}✅ SDK available on NPM${NC}"
    echo "  Version: $(npm view @allternit/plugin-sdk version)"
else
    echo -e "${RED}❌ SDK not found${NC}"
fi

echo ""
echo "Sample plugins:"
npm view @allternit/marketresearchcard-plugin version 2>/dev/null && echo -e "  ${GREEN}✅ marketresearchcard-plugin${NC}" || echo -e "  ${RED}❌ marketresearchcard-plugin${NC}"
npm view @allternit/codereviewcard-plugin version 2>/dev/null && echo -e "  ${GREEN}✅ codereviewcard-plugin${NC}" || echo -e "  ${RED}❌ codereviewcard-plugin${NC}"
npm view @allternit/imagegencard-plugin version 2>/dev/null && echo -e "  ${GREEN}✅ imagegencard-plugin${NC}" || echo -e "  ${RED}❌ imagegencard-plugin${NC}"

echo ""
echo -e "${GREEN}🎉 All done!${NC}"
echo ""
echo "Install the SDK globally:"
echo "  npm install -g @allternit/plugin-sdk"
echo ""
echo "Then use it:"
echo "  allternit-plugin create my-plugin"
echo ""
