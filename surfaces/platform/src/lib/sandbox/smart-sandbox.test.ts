/**
 * Tests for Smart Sandbox analyzer
 * Verifies that code is routed to the correct sandbox tier
 */

import { describe, it, expect } from "vitest";

// Re-create the analyzer functions for testing
const WASM_COMPATIBLE_PACKAGES = new Set([
  "numpy", "pandas", "matplotlib", "scipy", "scikit-learn",
  "os", "sys", "pathlib", "json", "re", "math", "random", 
  "datetime", "collections", "itertools", "functools", 
  "statistics", "typing", "inspect", "textwrap", "string",
  "hashlib", "base64", "uuid", "time", "copy", "pickle",
  "pytest", "unittest", "mock",
]);

const DOCKER_ONLY_PACKAGES = new Set([
  "tensorflow", "torch", "transformers", "flask", "django", "fastapi",
  "selenium", "requests", "psycopg2", "pymongo", "redis",
]);

const WEBVM_REQUIRED_PATTERNS = [
  /^apt-get\s/m,
  /^yum\s+install/m,
  /^docker\s/m,
  /^sudo\s/m,
  /^systemctl\s/m,
  /^make\s/m,
  /^gcc\s/m,
  /^clang\s/m,
  /;\s*apt-get\s/,
  /&&\s*apt-get\s/,
  /\|\s*apt-get\s/,
];

const DOCKER_REQUIRED_PATTERNS = [
  /!pip\s+install/,
  /open\s*\(\s*['"`]https?:/,
  /requests\./,
  /urllib/,
  /subprocess/,
  /os\.system/,
  /socket\./,
  /sqlite3/,
];

function extractImportsFromCode(code: string): string[] {
  const imports: string[] = [];
  
  const importRegex = /^\s*import\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    imports.push(match[1].toLowerCase());
  }
  
  const fromImportRegex = /^\s*from\s+([a-zA-Z_][a-zA-Z0-9_]*)\.?/gm;
  while ((match = fromImportRegex.exec(code)) !== null) {
    imports.push(match[1].toLowerCase());
  }
  
  const dunderImportRegex = /__import__\s*\(\s*['"`]([a-zA-Z_][a-zA-Z0-9_]*)['"`]/g;
  while ((match = dunderImportRegex.exec(code)) !== null) {
    imports.push(match[1].toLowerCase());
  }
  
  return [...new Set(imports)];
}

function requiresDockerPackage(pkg: string): boolean {
  if (DOCKER_ONLY_PACKAGES.has(pkg.toLowerCase())) {
    return true;
  }
  return !WASM_COMPATIBLE_PACKAGES.has(pkg.toLowerCase());
}

function determineExecutionMethod(
  code: string, 
  language?: string,
  packages?: string[]
): "wasm" | "docker" | "webvm" {
  if (language && language !== "python") {
    return "webvm";
  }
  
  for (const pattern of WEBVM_REQUIRED_PATTERNS) {
    if (pattern.test(code)) {
      return "webvm";
    }
  }
  
  for (const pattern of DOCKER_REQUIRED_PATTERNS) {
    if (pattern.test(code)) {
      return "docker";
    }
  }
  
  const extractedImports = extractImportsFromCode(code);
  const allPackages = new Set([
    ...(packages || []),
    ...extractedImports,
  ]);
  
  for (const pkg of allPackages) {
    if (requiresDockerPackage(pkg)) {
      return "docker";
    }
  }
  
  if (code.length > 10000) {
    return "docker";
  }
  
  return "wasm";
}

// Tests
describe("Smart Sandbox Analyzer", () => {
  describe("Language detection", () => {
    it("routes JavaScript to WebVM", () => {
      const code = `console.log("hello")`;
      expect(determineExecutionMethod(code, "javascript")).toBe("webvm");
    });

    it("routes Bash to WebVM", () => {
      const code = `echo "hello"`;
      expect(determineExecutionMethod(code, "bash")).toBe("webvm");
    });

    it("routes Rust to WebVM", () => {
      const code = `fn main() { println!("hello"); }`;
      expect(determineExecutionMethod(code, "rust")).toBe("webvm");
    });

    it("routes Python to appropriate tier", () => {
      const code = `print("hello")`;
      expect(determineExecutionMethod(code, "python")).toBe("wasm");
    });
  });

  describe("System command detection", () => {
    it("detects apt-get and routes to WebVM", () => {
      const code = `apt-get install nodejs`;
      expect(determineExecutionMethod(code)).toBe("webvm");
    });

    it("detects sudo and routes to WebVM", () => {
      const code = `sudo pip install package`;
      expect(determineExecutionMethod(code)).toBe("webvm");
    });

    it("detects gcc and routes to WebVM", () => {
      const code = `gcc -o output source.c`;
      expect(determineExecutionMethod(code)).toBe("webvm");
    });

    it("detects make and routes to WebVM", () => {
      const code = `make build`;
      expect(determineExecutionMethod(code)).toBe("webvm");
    });
  });

  describe("Network/IO detection", () => {
    it("detects requests and routes to Docker", () => {
      const code = `
import requests
response = requests.get("https://api.example.com")
`;
      expect(determineExecutionMethod(code)).toBe("docker");
    });

    it("detects subprocess and routes to Docker", () => {
      const code = `
import subprocess
subprocess.run(["ls", "-la"])
`;
      expect(determineExecutionMethod(code)).toBe("docker");
    });

    it("detects !pip install and routes to Docker", () => {
      const code = `!pip install tensorflow`;
      expect(determineExecutionMethod(code)).toBe("docker");
    });
  });

  describe("Package detection from imports", () => {
    it("routes numpy to WASM (compatible)", () => {
      const code = `
import numpy as np
arr = np.array([1, 2, 3])
`;
      expect(determineExecutionMethod(code)).toBe("wasm");
    });

    it("routes tensorflow to Docker (incompatible)", () => {
      const code = `
import tensorflow as tf
model = tf.keras.Sequential()
`;
      expect(determineExecutionMethod(code)).toBe("docker");
    });

    it("routes torch to Docker (incompatible)", () => {
      const code = `
import torch
x = torch.randn(3, 3)
`;
      expect(determineExecutionMethod(code)).toBe("docker");
    });

    it("routes standard library to WASM", () => {
      const code = `
import os
import sys
import json
from pathlib import Path
`;
      expect(determineExecutionMethod(code)).toBe("wasm");
    });

    it("routes unknown package to Docker", () => {
      const code = `
import some_obscure_package
`;
      expect(determineExecutionMethod(code)).toBe("docker");
    });
  });

  describe("Combined scenarios", () => {
    it("handles complex numpy script in WASM", () => {
      const code = `
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

data = np.random.randn(100)
df = pd.DataFrame({'values': data})
print(df.describe())

plt.plot(data)
plt.savefig('chart.png')
`;
      expect(determineExecutionMethod(code)).toBe("wasm");
    });

    it("handles web scraping in Docker", () => {
      const code = `
import requests
from bs4 import BeautifulSoup

url = "https://example.com"
response = requests.get(url)
soup = BeautifulSoup(response.text, 'html.parser')
print(soup.title)
`;
      expect(determineExecutionMethod(code)).toBe("docker");
    });

    it("handles ML training in Docker", () => {
      const code = `
import tensorflow as tf
from transformers import AutoModel

model = AutoModel.from_pretrained("bert-base")
# Training code...
`;
      expect(determineExecutionMethod(code)).toBe("docker");
    });

    it("handles build process in WebVM", () => {
      const code = `
# Build the project
make clean
make all
sudo make install
`;
      expect(determineExecutionMethod(code)).toBe("webvm");
    });
  });

  describe("Edge cases", () => {
    it("handles empty code", () => {
      expect(determineExecutionMethod("")).toBe("wasm");
    });

    it("handles very large scripts", () => {
      const largeCode = "x = 1\n".repeat(10000);
      expect(determineExecutionMethod(largeCode)).toBe("docker");
    });

    it("handles comments with restricted words", () => {
      const code = `
# This code uses apt-get for installation
# But we won't actually call it
import numpy as np
`;
      // Should NOT match apt-get in comment (pattern requires start of line or whitespace)
      expect(determineExecutionMethod(code)).toBe("wasm");
    });

    it("handles __import__ dynamically", () => {
      const code = `module = __import__("tensorflow")`;
      expect(determineExecutionMethod(code)).toBe("docker");
    });

    it("handles from X import Y syntax", () => {
      const code = `from tensorflow import keras`;
      expect(determineExecutionMethod(code)).toBe("docker");
    });

    it("handles import X.Y syntax", () => {
      const code = `import matplotlib.pyplot as plt`;
      expect(determineExecutionMethod(code)).toBe("wasm");
    });
  });
});

describe("Import extraction", () => {
  it("extracts simple imports", () => {
    const code = `import numpy`;
    expect(extractImportsFromCode(code)).toContain("numpy");
  });

  it("extracts aliased imports", () => {
    const code = `import numpy as np`;
    expect(extractImportsFromCode(code)).toContain("numpy");
  });

  it("extracts from imports", () => {
    const code = `from pandas import DataFrame`;
    expect(extractImportsFromCode(code)).toContain("pandas");
  });

  it("extracts multiple imports", () => {
    const code = `
import numpy
import pandas
import matplotlib
`;
    const imports = extractImportsFromCode(code);
    expect(imports).toContain("numpy");
    expect(imports).toContain("pandas");
    expect(imports).toContain("matplotlib");
  });

  it("handles __import__ syntax", () => {
    const code = `mod = __import__("numpy")`;
    expect(extractImportsFromCode(code)).toContain("numpy");
  });

  it("removes duplicates", () => {
    const code = `
import numpy
import numpy
import numpy
`;
    expect(extractImportsFromCode(code)).toHaveLength(1);
  });
});
