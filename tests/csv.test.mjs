import test from 'node:test';
import assert from 'node:assert/strict';
import {createCsv} from '../src/csv.ts';

test('CSV export quotes cells and neutralizes spreadsheet formulas', () => {
  const project = {sources: [
    {id: 's1', name: '=HYPERLINK("https://bad.example","click")', type: 'Документ', location: '  +SUM(1,1)', owner: '', process: '', status: '-1'},
    {id: 's2', name: '@command', type: 'Документ', location: '\t=1+1', owner: '', process: '', status: 'Открыта'}
  ]};
  const csv = createCsv(project);
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/bad\.example"",""click""\)"/);
  assert.match(csv, /"'  \+SUM\(1,1\)"/);
  assert.match(csv, /"'-1"/);
  assert.match(csv, /"'@command"/);
  assert.match(csv, /"'\t=1\+1"/);
});
