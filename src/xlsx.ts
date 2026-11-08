import type {Project, Row} from './model';

const enc = new TextEncoder();
function xml(value: unknown) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[<>&'"]/g, char => ({'<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'}[char]!));
}
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const u16 = (value: number) => [value & 255, (value >>> 8) & 255];
const u32 = (value: number) => [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255];

// A minimal, uncompressed ZIP writer for the OpenXML workbook parts.
function zip(files: {name: string; data: string}[]) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = enc.encode(file.name);
    const data = enc.encode(file.data);
    const crc = crc32(data);
    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...name, ...data
    ]);
    localParts.push(local);
    const central = new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name
    ]);
    centralParts.push(central);
    offset += local.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
    ...u32(centralSize), ...u32(offset), ...u16(0)
  ]);
  const all = [...localParts, ...centralParts, end];
  const output = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of all) { output.set(part, cursor); cursor += part.length; }
  return new Blob([output.buffer as ArrayBuffer], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}

function columnName(index: number) {
  let value = index + 1;
  let name = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}
function sheet(rows: unknown[][]) {
  const body = rows.map((row, rowIndex) =>
    `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => {
      const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
    }).join('')}</row>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

type Tab = {name: string; headers: string[]; rows: unknown[][]};
const rowTab = (name: string, rows: Row[], headers: string[]): Tab => ({
  name,
  headers,
  rows: rows.map(row => headers.map(key => row[key] ?? ''))
});

/** Nine useful sheets: company profile, seven working registers, and change history. */
export function createXlsx(project: Project) {
  const tabs: Tab[] = [
    {name: 'Компания', headers: ['Параметр', 'Значение'], rows: [
      ['Название', project.company.name], ['Сфера деятельности', project.company.industry],
      ['Размер команды', project.company.teamSize], ['Подразделения', project.company.departments],
      ['Владелец проекта', project.company.ownerName], ['Сценарий работы', project.scenario],
      ...Object.entries(project.diagnostic || {}).map(([key, value]) => [`Диагностика: ${key}`, value])
    ]},
    rowTab('Источники', project.sources, ['id', 'name', 'type', 'location', 'owner', 'process', 'status']),
    rowTab('Процессы', project.processes, ['id', 'name', 'department', 'purpose', 'inputs', 'steps', 'outputs', 'owner', 'status']),
    rowTab('Документы', project.documents, ['id', 'name', 'type', 'version', 'process', 'owner', 'nextReview', 'status']),
    rowTab('Проблемы', project.gaps, ['id', 'name', 'type', 'risk', 'priority', 'process', 'document', 'owner', 'dueDate', 'status']),
    rowTab('Ответственные', project.owners, ['id', 'name', 'role']),
    rowTab('AI тесты', project.aiTests, ['id', 'name', 'expectedAnswer', 'source', 'result', 'notes']),
    rowTab('План', project.tasks, ['id', 'name', 'stage', 'priority', 'owner', 'dueDate', 'status']),
    {name: 'Журнал изменений', headers: ['ID', 'Дата и время', 'Изменение'], rows: (project.changes || []).map(change => [change.id, change.at, change.message])}
  ];

  const files: {name: string; data: string}[] = [];
  const names = tabs.map(tab => tab.name);
  files.push({name: '[Content_Types].xml', data:
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${names.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`
  });
  files.push({name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'});
  files.push({name: 'xl/workbook.xml', data:
    `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name, index) => `<sheet name="${xml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>`
  });
  files.push({name: 'xl/_rels/workbook.xml.rels', data:
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}</Relationships>`
  });
  tabs.forEach((tab, index) => files.push({
    name: `xl/worksheets/sheet${index + 1}.xml`,
    data: sheet([tab.headers, ...tab.rows])
  }));
  return zip(files);
}

export function exportXlsx(project: Project) {
  const blob = createXlsx(project);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'taina-knowledge-map.xlsx';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
