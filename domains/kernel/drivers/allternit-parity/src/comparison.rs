//! Parity Comparison Utilities

use crate::capture::NormalizedReceipt;

/// Result of comparing two receipts
#[derive(Debug)]
pub struct ComparisonResult {
    pub matches: bool,
    pub differences: Vec<Difference>,
}

/// A single difference between receipts
#[derive(Debug)]
pub struct Difference {
    pub path: String,
    pub expected: String,
    pub actual: String,
}

/// Compare two normalized receipts
pub fn compare_receipts(
    expected: &NormalizedReceipt,
    actual: &NormalizedReceipt,
) -> ComparisonResult {
    let mut differences = Vec::new();

    // Compare method
    if expected.method != actual.method {
        differences.push(Difference {
            path: "method".to_string(),
            expected: expected.method.clone(),
            actual: actual.method.clone(),
        });
    }

    // Compare request
    if expected.request != actual.request {
        differences.push(Difference {
            path: "request".to_string(),
            expected: expected.request.to_string(),
            actual: actual.request.to_string(),
        });
    }

    // Compare response
    if expected.response != actual.response {
        differences.push(Difference {
            path: "response".to_string(),
            expected: expected.response.to_string(),
            actual: actual.response.to_string(),
        });
    }

    // Compare exit code
    if expected.exit_code != actual.exit_code {
        differences.push(Difference {
            path: "exit_code".to_string(),
            expected: expected.exit_code.to_string(),
            actual: actual.exit_code.to_string(),
        });
    }

    ComparisonResult {
        matches: differences.is_empty(),
        differences,
    }
}
