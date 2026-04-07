#!/bin/bash

# Fix utils/settings imports
find src/cli/ui/ink-app/utils/settings -name "*.ts" -o -name "*.tsx" | while read f; do
  sed -i '' "s|from '@modelcontextprotocol/sdk/types'|from './types'|g" "$f"
done

# Fix utils/swarm imports
find src/cli/ui/ink-app/utils/swarm -name "*.ts" -o -name "*.tsx" | while read f; do
  sed -i '' "s|from '@modelcontextprotocol/sdk/types'|from '../swarm/types'|g" "$f"
done

# Fix utils/secureStorage imports
find src/cli/ui/ink-app/utils/secureStorage -name "*.ts" -o -name "*.tsx" | while read f; do
  sed -i '' "s|from '@modelcontextprotocol/sdk/types'|from './types'|g" "$f"
done

# Fix components/keybindings imports
find src/cli/ui/ink-app/components/keybindings -name "*.ts" -o -name "*.tsx" | while read f; do
  sed -i '' "s|from '@modelcontextprotocol/sdk/types'|from './types'|g" "$f"
done

echo "Fixed remaining imports"
