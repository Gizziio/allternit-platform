/** Build a minimal one-page PDF with real text — pdf.js parses it (xref is
 * intentionally loose; pdf.js reconstructs it). */
export function makeHelloPdf(): Buffer {
  const text = 'BT /F1 24 Tf 72 720 Td (Hello Allternit PDF) Tj ET';
  const parts = [
    '%PDF-1.4\n',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n',
    '4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n',
    `5 0 obj<</Length ${text.length}>>stream\n${text}\nendstream\nendobj\n`,
    'trailer<</Root 1 0 R>>\n%%EOF',
  ];
  return Buffer.from(parts.join(''), 'latin1');
}
