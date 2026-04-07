/**
 * Structure Agent
 * Cleans up the layer tree structure
 */

import type { LayerNode, AgentResult, CleanupContext } from '../types'

export class StructureAgent {
  async process(layer: LayerNode, context: CleanupContext): Promise<AgentResult> {
    const modifications: any[] = []
    
    // Remove empty nodes
    const cleaned = this.removeEmptyNodes(layer, modifications)
    
    // Flatten redundant nesting
    const flattened = this.flattenRedundantGroups(cleaned, modifications)
    
    return {
      layer: flattened,
      modifications,
      warnings: []
    }
  }

  private removeEmptyNodes(layer: LayerNode, mods: any[]): LayerNode {
    if (!layer.children) return layer

    const originalCount = layer.children.length
    layer.children = layer.children.filter(child => {
      // Remove empty frames
      if (child.type === 'FRAME' && 
          (!child.children || child.children.length === 0) &&
          (!child.fills || child.fills.length === 0)) {
        mods.push({
          type: 'remove',
          target: child.name || 'unnamed',
          description: 'Removed empty frame'
        })
        return false
      }
      return true
    })

    // Recurse into remaining children
    layer.children = layer.children.map(child => 
      this.removeEmptyNodes(child, mods)
    )

    return layer
  }

  private flattenRedundantGroups(layer: LayerNode, mods: any[]): LayerNode {
    if (!layer.children) return layer

    // Flatten single-child groups without styling
    layer.children = layer.children.flatMap(child => {
      if (child.type === 'FRAME' && 
          child.children?.length === 1 &&
          (!child.fills || child.fills.length === 0)) {
        mods.push({
          type: 'merge',
          target: child.name || 'unnamed',
          description: 'Flattened single-child container'
        })
        
        const onlyChild = child.children[0]
        // Preserve position offset
        onlyChild.x = (onlyChild.x || 0) + (child.x || 0)
        onlyChild.y = (onlyChild.y || 0) + (child.y || 0)
        return [onlyChild]
      }
      return [child]
    })

    // Recurse
    layer.children = layer.children.map(child => 
      this.flattenRedundantGroups(child, mods)
    )

    return layer
  }
}
