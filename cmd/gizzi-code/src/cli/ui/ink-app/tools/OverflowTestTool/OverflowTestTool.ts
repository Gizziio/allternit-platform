/**
 * Overflow Test Tool
 * TEMPORARY SHIM
 */

export const OVERFLOW_TEST_TOOL_NAME = 'overflow_test'
export class OverflowTestTool {
  static async call(): Promise<unknown> {
    return { success: true }
  }
}
export default OverflowTestTool
