import type {Project, Row} from './model';

/** Build a semicolon-delimited export safe to open in spreadsheet applications. */
export function createCsv(project: Project): string {
  const data = Object.entries(project)
    .filter(([, value]) => Array.isArray(value))
    .flatMap(([section, value]) => (value as Row[]).map(row => ({section, ...row})));
  const columns = [...new Set(data.flatMap(row => Object.keys(row)))];
  const cell = (value: unknown) => {
    let text = String(value ?? '');
    // Spreadsheet applications may execute cells beginning with formula markers.
    // Prefix an apostrophe even after leading whitespace/control characters.
    if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [columns.map(cell).join(';'), ...data.map(row => columns.map(column => cell(row[column as keyof typeof row])).join(';'))].join('\r\n');
}
