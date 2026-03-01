#!/bin/bash
# A2rchitech OS Entry Script
echo "🚀 Starting A2rchitech Kernel..."
./bin/kernel &
KERNEL_PID=$!

echo "🌐 Opening Shell..."
# In a real app, we might use a lightweight electron wrapper or open browser
if [[ "$OSTYPE" == "darwin"* ]]; then
  open web/index.html
else
  xdg-open web/index.html
fi

trap "kill $KERNEL_PID" EXIT
wait $KERNEL_PID
