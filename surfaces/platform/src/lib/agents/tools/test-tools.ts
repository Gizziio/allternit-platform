/**
 * Test Tools
 * 
 * Native agent tools for running tests:
 * - run_tests: Execute test suites
 * - check_coverage: Get test coverage reports
 */

import type { ToolDefinition, ToolExecutionHandler } from "./index";

// ============================================================================
// Run Tests Tool
// ============================================================================

export const RUN_TESTS_DEFINITION: ToolDefinition = {
  name: "run_tests",
  description: `Run the test suite for a project.

Use this tool to:
- Run all tests
- Run specific test files
- Run tests matching a pattern
- Check test results

Supports multiple test runners: Jest, Vitest, Mocha, pytest, cargo test, go test.

Examples:
- Run all tests: path="/workspace/project"
- Specific file: path="...", testPathPattern="Component.test.tsx"
- With coverage: path="...", coverage=true
- Watch mode: path="...", watch=false (disabled for automation)`,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the project root",
        default: ".",
      },
      testPathPattern: {
        type: "string",
        description: "Pattern to match test files",
      },
      testNamePattern: {
        type: "string",
        description: "Pattern to match test names",
      },
      coverage: {
        type: "boolean",
        description: "Collect coverage information",
        default: false,
      },
      verbose: {
        type: "boolean",
        description: "Show verbose output",
        default: true,
      },
      timeout: {
        type: "number",
        description: "Test timeout in milliseconds",
        default: 30000,
      },
    },
    required: [],
  },
};

export interface TestResult {
  success: boolean;
  testRunner: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number; // milliseconds
  failures: Array<{
    testName: string;
    filePath?: string;
    error: string;
    stackTrace?: string;
  }>;
  output: string;
}

export const executeRunTests: ToolExecutionHandler = async (context, parameters) => {
  const {
    path = ".",
    testPathPattern,
    testNamePattern,
    coverage = false,
    verbose = true,
    timeout = 30000,
  } = parameters;

  try {
    // Detect test runner from project files
    const testRunner = await detectTestRunner(String(path));

    // Mock implementation - would call backend API to run actual tests
    const mockResult: TestResult = {
      success: true,
      testRunner,
      totalTests: 42,
      passed: 42,
      failed: 0,
      skipped: 0,
      duration: 2540,
      failures: [],
      output: verbose
        ? "PASS src/components/Button.test.tsx\nPASS src/utils/helpers.test.ts\n\nTest Suites: 5 passed, 5 total\nTests: 42 passed, 42 total"
        : "All tests passed",
    };

    return { result: mockResult };
  } catch (error) {
    return {
      result: null,
      error: error instanceof Error ? error.message : "Failed to run tests",
    };
  }
};

async function detectTestRunner(projectPath: string): Promise<string> {
  // Check for common test runner config files
  const runners = [
    { name: "vitest", files: ["vitest.config.ts", "vitest.config.js"] },
    { name: "jest", files: ["jest.config.js", "jest.config.ts", "jest.json"] },
    { name: "mocha", files: [".mocharc.js", ".mocharc.json"] },
    { name: "pytest", files: ["pytest.ini", "setup.cfg", "pyproject.toml"] },
    { name: "cargo", files: ["Cargo.toml"] },
    { name: "go", files: ["go.mod"] },
  ];

  // In production, check actual file system
  // For now, return a default
  return "vitest";
}

// ============================================================================
// Check Coverage Tool
// ============================================================================

export const CHECK_COVERAGE_DEFINITION: ToolDefinition = {
  name: "check_coverage",
  description: `Check test coverage for a project.

Use this tool to:
- Get overall coverage percentage
- See coverage by file
- Identify uncovered code
- Check coverage trends

Examples:
- Check coverage: path="/workspace/project"
- Show uncovered files: path="...", showUncovered=true`,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the project root",
        default: ".",
      },
      showUncovered: {
        type: "boolean",
        description: "List files with low coverage",
        default: false,
      },
      threshold: {
        type: "number",
        description: "Coverage threshold percentage (0-100)",
        default: 80,
      },
    },
    required: [],
  },
};

export interface CoverageReport {
  overall: {
    lines: number;
    statements: number;
    functions: number;
    branches: number;
  };
  files: Array<{
    path: string;
    lines: number;
    statements: number;
    uncoveredLines?: number[];
  }>;
  summary: {
    totalFiles: number;
    filesAboveThreshold: number;
    filesBelowThreshold: number;
  };
}

export const executeCheckCoverage: ToolExecutionHandler = async (context, parameters) => {
  const { path = ".", showUncovered = false, threshold = 80 } = parameters as { path?: string; showUncovered?: boolean; threshold?: number };

  try {
    const mockReport: CoverageReport = {
      overall: {
        lines: 87.5,
        statements: 89.2,
        functions: 85.0,
        branches: 82.3,
      },
      files: [
        {
          path: "src/components/Button.tsx",
          lines: 95,
          statements: 96,
        },
        {
          path: "src/utils/helpers.ts",
          lines: 78,
          statements: 80,
          uncoveredLines: [15, 16, 42],
        },
      ],
      summary: {
        totalFiles: 25,
        filesAboveThreshold: 20,
        filesBelowThreshold: 5,
      },
    };

    // Filter to show only uncovered files if requested
    if (showUncovered) {
      mockReport.files = mockReport.files.filter((f) => f.lines < threshold);
    }

    return { result: mockReport };
  } catch (error) {
    return {
      result: null,
      error: error instanceof Error ? error.message : "Failed to check coverage",
    };
  }
};

// ============================================================================
// Lint Check Tool
// ============================================================================

export const LINT_CHECK_DEFINITION: ToolDefinition = {
  name: "lint_check",
  description: `Run linter on the project code.

Use this tool to:
- Check code style
- Find potential errors
- Ensure code quality
- Run ESLint, Prettier, or other linters

Examples:
- Check all files: path="/workspace/project"
- Specific files: path="...", files=["src/index.ts"]
- Auto-fix: path="...", fix=true (requires confirmation)`,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the project root",
        default: ".",
      },
      files: {
        type: "array",
        description: "Specific files to lint (defaults to all)",
        items: { type: "string" },
      },
      fix: {
        type: "boolean",
        description: "Automatically fix issues where possible",
        default: false,
      },
    },
    required: [],
  },
};

export interface LintResult {
  linter: string;
  success: boolean;
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
  issues: Array<{
    file: string;
    line: number;
    column: number;
    severity: "error" | "warning";
    message: string;
    rule?: string;
  }>;
  fixed: boolean;
}

export const executeLintCheck: ToolExecutionHandler = async (context, parameters) => {
  const { path = ".", files, fix = false } = parameters as { path?: string; files?: string[]; fix?: boolean };

  try {
    const mockResult: LintResult = {
      linter: "ESLint",
      success: true,
      errorCount: 0,
      warningCount: 2,
      fixableErrorCount: 0,
      fixableWarningCount: 2,
      issues: [
        {
          file: "src/utils/helpers.ts",
          line: 42,
          column: 5,
          severity: "warning",
          message: "'unusedVar' is assigned a value but never used",
          rule: "@typescript-eslint/no-unused-vars",
        },
      ],
      fixed: fix,
    };

    return { result: mockResult };
  } catch (error) {
    return {
      result: null,
      error: error instanceof Error ? error.message : "Failed to run linter",
    };
  }
};

// ============================================================================
// Type Check Tool
// ============================================================================

export const TYPE_CHECK_DEFINITION: ToolDefinition = {
  name: "type_check",
  description: `Run TypeScript type checker on the project.

Use this tool to:
- Check for type errors
- Validate type safety
- Find potential runtime issues

Examples:
- Type check project: path="/workspace/project"
- Strict mode: path="...", strict=true`,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the project root",
        default: ".",
      },
      strict: {
        type: "boolean",
        description: "Use strict type checking",
        default: false,
      },
    },
    required: [],
  },
};

export interface TypeCheckResult {
  success: boolean;
  errorCount: number;
  errors: Array<{
    file: string;
    line: number;
    column: number;
    message: string;
    code: number;
  }>;
  duration: number;
}

export const executeTypeCheck: ToolExecutionHandler = async (context, parameters) => {
  const { path = ".", strict = false } = parameters;

  try {
    const mockResult: TypeCheckResult = {
      success: true,
      errorCount: 0,
      errors: [],
      duration: 3240,
    };

    return { result: mockResult };
  } catch (error) {
    return {
      result: null,
      error: error instanceof Error ? error.message : "Failed to type check",
    };
  }
};
