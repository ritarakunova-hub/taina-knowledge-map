import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseProjectImport, MAX_IMPORT_BYTES} from '../src/import.ts';

const valid = {
  schemaVersion: 2, id: 'import-test', company: {name: 'Test', industry: '', teamSize: '', departments: '', ownerName: ''},
  scenario: 'solo', diagnostic: {}, sources: [], processes: [], documents: [], gaps: [], owners: [], aiTests: [], tasks: [], changes: [], verificationConfirmed: false, updatedAt: new Date().toISOString()
};

test('JSON import parses and migrates a valid project', () => {
  const parsed = parseProjectImport(JSON.stringify(valid));
  assert.equal(parsed.id, valid.id);
  assert.equal(parsed.schemaVersion, 2);
});

test('JSON import rejects malformed JSON and invalid project structures', () => {
  assert.throws(() => parseProjectImport('{not json'), /корректным JSON/);
  assert.throws(() => parseProjectImport(JSON.stringify({...valid, sources: 'not-an-array'})), /структуры/);
});

test('JSON import rejects oversized payloads before parsing', () => {
  const huge = ' '.repeat(MAX_IMPORT_BYTES + 1);
  assert.throws(() => parseProjectImport(huge), /5 МБ/);
});
