/**
 * A2R Vision Action Parser
 * 
 * Ports the Python action_parser.py logic to TypeScript.
 * Handles coordinate transformation, smart resizing, and structured action parsing.
 */

export interface ParsedAction {
  reflection?: string;
  thought?: string;
  action_type: string;
  action_inputs: Record<string, any>;
  text: string;
}

const IMAGE_FACTOR = 28;
const MIN_PIXELS = 100 * 28 * 28;
const MAX_PIXELS = 16384 * 28 * 28;
const MAX_RATIO = 200;

export class VisionParser {
  /**
   * Rescales the image dimensions to be divisible by factor and within pixel limits.
   */
  static smartResize(height: number, width: number): { h: number; w: number } {
    if (Math.max(height, width) / Math.min(height, width) > MAX_RATIO) {
      throw new Error(`Aspect ratio must be smaller than ${MAX_RATIO}`);
    }

    let hBar = Math.max(IMAGE_FACTOR, Math.round(height / IMAGE_FACTOR) * IMAGE_FACTOR);
    let wBar = Math.max(IMAGE_FACTOR, Math.round(width / IMAGE_FACTOR) * IMAGE_FACTOR);

    if (hBar * wBar > MAX_PIXELS) {
      const beta = Math.sqrt((height * width) / MAX_PIXELS);
      hBar = Math.floor(height / beta / IMAGE_FACTOR) * IMAGE_FACTOR;
      wBar = Math.floor(width / beta / IMAGE_FACTOR) * IMAGE_FACTOR;
    } else if (hBar * wBar < MIN_PIXELS) {
      const beta = Math.sqrt(MIN_PIXELS / (height * width));
      hBar = Math.ceil((height * beta) / IMAGE_FACTOR) * IMAGE_FACTOR;
      wBar = Math.ceil((width * beta) / IMAGE_FACTOR) * IMAGE_FACTOR;
    }

    return { h: hBar, w: wBar };
  }

  /**
   * Parses model output string into structured actions.
   */
  static parseActionToStructure(
    text: string, 
    originHeight: number, 
    originWidth: number
  ): ParsedAction[] {
    const { h: smartH, w: smartW } = this.smartResize(originHeight, originWidth);
    
    // Normalize text
    let processed = text.trim();
    processed = processed.replace(/start_point=/g, "start_box=");
    processed = processed.replace(/end_point=/g, "end_box=");
    processed = processed.replace(/point=/g, "start_box=");

    // Extract Thought/Reflection
    let thought: string | undefined;
    let reflection: string | undefined;

    const thoughtMatch = processed.match(/(?:Thought|Reflection|Action_Summary): (.+?)(?=\s*Action: |$)/s);
    if (thoughtMatch) {
      thought = thoughtMatch[1].trim();
    }

    const actionIndex = processed.indexOf("Action: ");
    if (actionIndex === -1) {
      throw new Error("No 'Action:' tag found in model response");
    }

    const actionStr = processed.substring(actionIndex + 8).trim();
    const rawActions = actionStr.split(/\)\n\n/);
    const results: ParsedAction[] = [];

    for (const raw of rawActions) {
      let cleanRaw = raw.trim();
      if (!cleanRaw.endsWith(")")) cleanRaw += ")";

      // Basic regex-based parser (simulating AST parsing for simple calls)
      const callMatch = cleanRaw.match(/^(\w+)\((.*)\)$/);
      if (!callMatch) continue;

      const funcName = callMatch[1];
      const argsStr = callMatch[2];
      const args: Record<string, any> = {};

      // Parse key=value pairs
      const argPairs = argsStr.matchAll(/(\w+)=(['"])(.*?)\2/g);
      for (const pair of argPairs) {
        let key = pair[1];
        let val = pair[3];

        if (key === "start_box" || key === "end_box") {
          // Coordinate transformation
          const coords = val.replace(/[()]/g, "").split(",").map(n => parseFloat(n));
          
          let floatCoords: number[];
          // Qwen2.5vl absolute to relative conversion
          if (coords.length === 2) {
            floatCoords = [coords[0] / smartW, coords[1] / smartH, coords[0] / smartW, coords[1] / smartH];
          } else {
            floatCoords = [coords[0] / smartW, coords[1] / smartH, coords[2] / smartW, coords[3] / smartH];
          }
          val = JSON.stringify(floatCoords);
        }
        args[key] = val;
      }

      results.push({
        reflection,
        thought,
        action_type: funcName,
        action_inputs: args,
        text: processed
      } as any);
    }

    return results;
  }
}
