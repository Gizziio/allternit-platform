#!/bin/bash
set -e

echo "📦 Packaging A2rchitech..."

# Create dist structure
mkdir -p dist/bin
mkdir -p dist/web
mkdir -p dist/workspace

# 1. Build Kernel (Rust)
echo "🦀 Building Kernel..."
cargo build -p kernel --release
cp target/release/kernel dist/bin/

# 2. Build Shell (Vite)
echo "⚛️ Building Shell UI..."
cd apps/shell
npm install
npm run build
cd ../..
cp -r apps/shell/dist/* dist/web/

# 3. Prepare Default Workspace
echo "📂 Initializing Workspace..."
cp -r workspace/* dist/workspace/ 2>/dev/null || true

# 4. Create Entry Script
cat <<EOF > dist/a2rchitech.sh
#!/bin/bash
# A2rchitech OS Entry Script
echo "🚀 Starting A2rchitech Kernel..."
./bin/kernel &
KERNEL_PID=\$!

echo "🌐 Opening Shell..."
# In a real app, we might use a lightweight electron wrapper or open browser
if [[ "\$OSTYPE" == "darwin"* ]]; then
  open web/index.html
else
  xdg-open web/index.html
fi

trap "kill \$KERNEL_PID" EXIT
wait \$KERNEL_PID
EOF

chmod +x dist/a2rchitech.sh

echo "✅ Distribution ready in ./dist/"
