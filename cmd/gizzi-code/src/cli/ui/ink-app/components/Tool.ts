/**
 * Tool Component Types
 * TEMPORARY SHIM
 */

export interface ToolProps {
  name: string
  description: string
}

export class Tool {
  name: string
  description: string
  
  constructor(props: ToolProps) {
    this.name = props.name
    this.description = props.description
  }
}

export default { Tool }
