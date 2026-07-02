/**
 * Data Grid CSV Utilities
 */

export function parseCSV(csvText: string): { headers: string[]; rows: string[][] } {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map(line => parseCSVLine(line));
  
  return { headers, rows };
}

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

export function generateCSV(headers: string[], rows: Record<string, any>[]): string {
  const escapeValue = (value: any): string => {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  
  const lines = [
    headers.map(escapeValue).join(','),
    ...rows.map(row => headers.map(h => escapeValue(row[h])).join(','))
  ];
  
  return lines.join('\n');
}
