/**
 * Export Utilities
 * 
 * Export certificates and verification reports in various formats.
 */

import type {
  VerificationCertificate,
  CertificateExportFormat,
  CertificateExportOptions,
  OrchestratedVerificationResult,
  StoredVerification,
} from "../types";

import { formatCertificate, formatVerificationResult } from "./formatting";

/**
 * Export options
 */
export interface ExportOptions {
  format: CertificateExportFormat;
  includeMetadata?: boolean;
  includeRawEvidence?: boolean;
  prettyPrint?: boolean;
}

/**
 * Export a certificate
 */
export function exportCertificate(
  certificate: VerificationCertificate,
  options: ExportOptions
): string {
  switch (options.format) {
    case "json":
      return exportAsJson(certificate, options);
    case "markdown":
      return exportAsMarkdown(certificate, options);
    case "html":
      return exportAsHtml(certificate, options);
    case "pdf":
      throw new Error("PDF export requires additional dependencies");
    default:
      throw new Error(`Unknown export format: ${options.format}`);
  }
}

/**
 * Export as JSON
 */
function exportAsJson(
  certificate: VerificationCertificate,
  options: ExportOptions
): string {
  const data = options.includeMetadata
    ? certificate
    : { ...certificate, metadata: undefined };
  
  if (options.prettyPrint) {
    return JSON.stringify(data, null, 2);
  }
  
  return JSON.stringify(data);
}

/**
 * Export as Markdown
 */
function exportAsMarkdown(
  certificate: VerificationCertificate,
  options: ExportOptions
): string {
  return formatCertificate(certificate, {
    includeMetadata: options.includeMetadata,
    includeRawEvidence: options.includeRawEvidence,
  });
}

/**
 * Export as HTML
 */
function exportAsHtml(
  certificate: VerificationCertificate,
  options: ExportOptions
): string {
  const markdown = exportAsMarkdown(certificate, options);
  
  // Simple markdown to HTML conversion
  let html = markdown
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headers
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Code blocks
    .replace(/```[\s\S]*?```/g, match => {
      const code = match.slice(3, -3).trim();
      return `<pre><code>${code}</code></pre>`;
    })
    // Line breaks
    .replace(/\n\n/g, "</p><p>")
    // Wrap in paragraphs
    .replace(/^(.+)$/gm, "<p>$1</p>");
  
  return `<!DOCTYPE html>
<html>
<head>
  <title>Verification Certificate - ${certificate.id}</title>
  <style>
    body { font-family: 'Allternit Sans', Inter, ui-sans-serif, system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
    h1, h2, h3 { color: #333; }
    code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; }
    pre { background: #f4f4f4; padding: 1em; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    .passed { color: #2ecc71; }
    .failed { color: #e74c3c; }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;
}

/**
 * Export a verification report
 */
export function exportVerificationReport(
  verifications: StoredVerification[],
  options: ExportOptions & {
    title?: string;
    includeStatistics?: boolean;
  }
): string {
  switch (options.format) {
    case "json":
      return JSON.stringify(verifications, null, options.prettyPrint ? 2 : undefined);
    
    case "markdown":
      return exportReportAsMarkdown(verifications, options);
    
    case "html":
      return exportReportAsHtml(verifications, options);
    
    default:
      throw new Error(`Report export not supported for format: ${options.format}`);
  }
}

/**
 * Export report as Markdown
 */
function exportReportAsMarkdown(
  verifications: StoredVerification[],
  options: ExportOptions & { title?: string; includeStatistics?: boolean }
): string {
  const lines: string[] = [];
  
  lines.push(`# ${options.title || "Verification Report"}`);
  lines.push("");
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push(`Total Verifications: ${verifications.length}`);
  lines.push("");
  
  if (options.includeStatistics) {
    lines.push("## Summary");
    lines.push("");
    
    const passed = verifications.filter(v => v.result.passed).length;
    const failed = verifications.length - passed;
    
    lines.push(`- **Passed:** ${passed} (${((passed / verifications.length) * 100).toFixed(1)}%)`);
    lines.push(`- **Failed:** ${failed} (${((failed / verifications.length) * 100).toFixed(1)}%)`);
    lines.push("");
    
    // By confidence
    const byConfidence = {
      high: verifications.filter(v => v.result.confidence === "high").length,
      medium: verifications.filter(v => v.result.confidence === "medium").length,
      low: verifications.filter(v => v.result.confidence === "low").length,
    };
    
    lines.push("### By Confidence");
    lines.push(`- High: ${byConfidence.high}`);
    lines.push(`- Medium: ${byConfidence.medium}`);
    lines.push(`- Low: ${byConfidence.low}`);
    lines.push("");
  }
  
  // Individual verifications
  lines.push("## Verifications");
  lines.push("");
  
  for (const v of verifications) {
    lines.push(`### ${v.id}`);
    lines.push(`- **Timestamp:** ${new Date(v.timestamp).toLocaleString()}`);
    lines.push(`- **Type:** ${v.type}`);
    lines.push(`- **Result:** ${v.result.passed ? "✓ PASSED" : "✗ FAILED"}`);
    lines.push(`- **Confidence:** ${v.result.confidence}`);
    lines.push(`- **Methods:** ${v.result.methodsUsed.join(", ")}`);
    
    if (v.confirmed) {
      lines.push(`- **Confirmed:** ${v.confirmed.correct ? "Correct" : "Incorrect"} by ${v.confirmed.confirmedBy}`);
    }
    
    lines.push("");
    lines.push(v.fullResult.reason);
    lines.push("");
    
    if (options.includeMetadata && v.certificate) {
      lines.push("#### Certificate Details");
      lines.push(`- Premises: ${v.certificate.premises.length}`);
      lines.push(`- Traces: ${v.certificate.executionTraces.length}`);
      lines.push(`- Conclusion: ${v.certificate.conclusion.answer}`);
      lines.push("");
    }
  }
  
  return lines.join("\n");
}

/**
 * Export report as HTML
 */
function exportReportAsHtml(
  verifications: StoredVerification[],
  options: ExportOptions & { title?: string; includeStatistics?: boolean }
): string {
  const markdown = exportReportAsMarkdown(verifications, options);
  
  // Convert markdown to HTML
  let html = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/```[\s\S]*?```/g, match => {
      const code = match.slice(3, -3).trim();
      return `<pre><code>${code}</code></pre>`;
    })
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.+<\/li>\n)+/g, match => `<ul>${match}</ul>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(.+)$/gm, (match) => {
      if (match.startsWith("<")) return match;
      return `<p>${match}</p>`;
    });
  
  return `<!DOCTYPE html>
<html>
<head>
  <title>${options.title || "Verification Report"}</title>
  <style>
    body { 
      font-family: 'Allternit Sans', Inter, ui-sans-serif, system-ui, -apple-system, sans-serif; 
      max-width: 1000px; 
      margin: 0 auto; 
      padding: 2rem;
      line-height: 1.6;
    }
    h1 { color: #1a1a1a; border-bottom: 2px solid #333; padding-bottom: 0.3em; }
    h2 { color: #333; margin-top: 2em; }
    h3 { color: #444; }
    code { 
      background: #f4f4f4; 
      padding: 0.2em 0.4em; 
      border-radius: 3px;
      font-family: 'Allternit Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
      font-size: 0.9em;
    }
    pre { 
      background: #f8f8f8; 
      padding: 1em; 
      overflow-x: auto;
      border-radius: 5px;
      border: 1px solid #e0e0e0;
    }
    pre code { background: none; padding: 0; }
    ul { padding-left: 1.5em; }
    li { margin: 0.3em 0; }
    p { margin: 1em 0; }
    .verification { 
      border: 1px solid #ddd; 
      padding: 1em; 
      margin: 1em 0;
      border-radius: 5px;
      background: #fafafa;
    }
    .passed { color: #2ecc71; }
    .failed { color: #e74c3c; }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;
}

/**
 * Generate a comparison report between two certificates
 */
export function exportComparisonReport(
  cert1: VerificationCertificate,
  cert2: VerificationCertificate,
  options: ExportOptions
): string {
  const comparison = compareCertificates(cert1, cert2);
  
  const lines: string[] = [];
  
  lines.push("# Certificate Comparison Report");
  lines.push("");
  
  lines.push("## Summary");
  lines.push(`- **Conclusions Agree:** ${comparison.conclusionsAgree ? "Yes" : "No"}`);
  lines.push(`- **Confidence Matches:** ${comparison.confidenceMatches ? "Yes" : "No"}`);
  lines.push(`- **Common Premises:** ${comparison.commonPremises.length}`);
  lines.push(`- **Differences:** ${comparison.differences.length}`);
  lines.push("");
  
  if (comparison.differences.length > 0) {
    lines.push("## Differences");
    lines.push("");
    
    for (const diff of comparison.differences) {
      lines.push(`### ${diff.type.toUpperCase()}`);
      lines.push(`**Significance:** ${diff.significance}`);
      lines.push(diff.description);
      lines.push("");
    }
  }
  
  return lines.join("\n");
}

/**
 * Compare two certificates
 */
function compareCertificates(
  cert1: VerificationCertificate,
  cert2: VerificationCertificate
) {
  const commonPremises = cert1.premises
    .filter(p1 => cert2.premises.some(p2 => p1.statement === p2.statement))
    .map(p => p.id);
  
  const uniqueToFirst = cert1.premises
    .filter(p1 => !cert2.premises.some(p2 => p1.statement === p2.statement))
    .map(p => p.id);
  
  const uniqueToSecond = cert2.premises
    .filter(p2 => !cert1.premises.some(p1 => p1.statement === p2.statement))
    .map(p => p.id);
  
  const differences: Array<{
    type: "premise" | "trace" | "conclusion" | "evidence";
    description: string;
    significance: "high" | "medium" | "low";
  }> = [];
  
  if (cert1.conclusion.answer !== cert2.conclusion.answer) {
    differences.push({
      type: "conclusion",
      description: `Certificate 1 concludes ${cert1.conclusion.answer}, Certificate 2 concludes ${cert2.conclusion.answer}`,
      significance: "high",
    });
  }
  
  return {
    conclusionsAgree: cert1.conclusion.answer === cert2.conclusion.answer,
    confidenceMatches: cert1.conclusion.confidence.level === cert2.conclusion.confidence.level,
    commonPremises,
    uniqueToFirst,
    uniqueToSecond,
    traceCoverage: {
      first: cert1.executionTraces.length,
      second: cert2.executionTraces.length,
      overlap: 0, // Would need more sophisticated comparison
    },
    differences,
  };
}
