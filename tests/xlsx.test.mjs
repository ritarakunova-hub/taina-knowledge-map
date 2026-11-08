import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createXlsx} from '../src/xlsx.ts';

test('XLSX export creates a valid ZIP OpenXML workbook with nine useful tabs', async () => {
  const project = {
    company: {name: 'North & South', industry: 'Service', teamSize: '10', departments: '', ownerName: ''},
    scenario: 'solo', diagnostic: {},
    sources: [{id: 's1', name: 'Инструкция & порядок'}],
    processes: [], documents: [], gaps: [], owners: [], aiTests: [], tasks: [],
    changes: [{id: 'c1', at: '2026-11-06T10:00:00Z', message: 'Created'}]
  };
  const bytes = new Uint8Array(await createXlsx(project).arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  let offset = 0;
  const files = new Map();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (offset + 4 < bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLength));
    const start = offset + 30 + nameLength + extraLength;
    files.set(name, new TextDecoder().decode(bytes.slice(start, start + size)));
    offset = start + size;
  }
  const workbook = files.get('xl/workbook.xml');
  assert.equal((workbook.match(/<sheet /g) || []).length, 9);
  assert.match(workbook, /Компания/);
  assert.match(workbook, /Источники/);
  assert.match(workbook, /Журнал изменений/);
  assert.match(files.get('xl/worksheets/sheet1.xml'), /North &amp; South/);
  assert.match(files.get('xl/worksheets/sheet2.xml'), /Инструкция &amp; порядок/);
  assert.match(files.get('xl/worksheets/sheet9.xml'), /Created/);
  assert.equal(files.size, 13);
  assert.equal(view.getUint32(offset, true), 0x02014b50);
});

test('XLSX treats formula-like user input as inert text and strips invalid XML controls', async () => {
  const project = {
    company: {name: '=HYPERLINK("https://bad.example","click")\u0001', industry: '', teamSize: '', departments: '', ownerName: ''},
    scenario: 'solo', diagnostic: {}, sources: [], processes: [], documents: [], gaps: [], owners: [], aiTests: [], tasks: [], changes: []
  };
  const bytes = new Uint8Array(await createXlsx(project).arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  let sheetXml = '';
  while (offset + 30 < bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLength));
    const start = offset + 30 + nameLength + extraLength;
    const content = new TextDecoder().decode(bytes.slice(start, start + size));
    if (name === 'xl/worksheets/sheet1.xml') sheetXml = content;
    offset = start + size;
  }
  assert.match(sheetXml, /t="inlineStr"/);
  assert.match(sheetXml, /=HYPERLINK\(&quot;https:\/\/bad\.example&quot;,&quot;click&quot;\)/);
  assert.doesNotMatch(sheetXml, /<f>/);
  assert.doesNotMatch(sheetXml, /\u0001/);
});


test('XLSX preserves source review dates and process rules, decisions, exceptions and controls', async () => {
  const project = {
    company: {name: 'Demo', industry: '', teamSize: '', departments: '', ownerName: ''},
    scenario: 'team', diagnostic: {},
    sources: [{id: 's1', name: 'CRM guide', nextReview: '2027-02-01'}],
    processes: [{
      id: 'sales', name: 'Продажи', criticality: 'Высокий',
      purpose: 'Продать', inputs: 'Лид', steps: 'Связаться', outputs: 'Сделка',
      rules: 'Без обещаний скидки', decisions: 'Скидка только по согласованию',
      exceptions: 'VIP передать руководителю', kpi: 'Конверсия',
      control: 'Проверка звонков', nextReview: '2027-03-01', owner: 'o1', status: 'Действует'
    }],
    documents: [], gaps: [], owners: [], aiTests: [], tasks: [], changes: []
  };
  const bytes = new Uint8Array(await createXlsx(project).arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = new Map();
  let offset = 0;
  while (offset + 30 < bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLength));
    const start = offset + 30 + nameLength + extraLength;
    files.set(name, new TextDecoder().decode(bytes.slice(start, start + size)));
    offset = start + size;
  }
  assert.match(files.get('xl/worksheets/sheet2.xml'), /2027-02-01/);
  const processSheet = files.get('xl/worksheets/sheet3.xml');
  for (const value of ['2027-03-01', 'Без обещаний скидки', 'Скидка только по согласованию', 'VIP передать руководителю', 'Конверсия', 'Проверка звонков']) {
    assert.ok(processSheet.includes(value), `Process export is missing ${value}`);
  }
});
