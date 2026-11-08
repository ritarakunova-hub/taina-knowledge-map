import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validProject, mergeProjects, migrateProject} from '../src/integrity.ts';

const project = (id, name) => ({
  schemaVersion: 1, id,
  company: {name, industry: '', teamSize: '', departments: '', ownerName: ''},
  scenario: 'solo', diagnostic: {},
  sources: [{id: `${id}-s1`, name: 'Source'}],
  processes: [{id: `${id}-p1`, name: 'Process'}],
  documents: [{id: `${id}-d1`, name: 'Document', process: `${id}-p1`}],
  gaps: [], owners: [],
  aiTests: [{id: `${id}-a1`, name: 'Question', source: `${id}-s1`}],
  tasks: [], changes: [], updatedAt: new Date().toISOString()
});

test('import validation rejects malformed projects, duplicate IDs and dangling references', () => {
  const value = project('p1', 'A');
  assert.equal(validProject(value), true);
  assert.equal(validProject({...value, sources: [...value.sources, {id: value.sources[0].id, name: 'Duplicate'}]}), false);
  assert.equal(validProject({...value, sources: [{id: '', name: 'Bad'}]}), false);
  assert.equal(validProject({...value, aiTests: [{id: 'a2', name: 'Broken link', source: 'missing'}]}), false);
});

test('migration fills missing V2 collections and company fields without losing data', () => {
  const old = project('old', 'Legacy');
  delete old.tasks;
  delete old.diagnostic;
  assert.equal(validProject(old), true);
  const migrated = migrateProject(old);
  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual(migrated.tasks, []);
  assert.equal(migrated.company.name, 'Legacy');
  assert.equal(migrated.sources[0].name, 'Source');
});

test('merge remaps duplicate IDs and preserves imported references', () => {
  const current = project('current', 'Current');
  const incoming = project('incoming', 'Imported');
  incoming.sources[0].id = current.sources[0].id;
  incoming.aiTests[0].source = incoming.sources[0].id;
  const result = mergeProjects(current, incoming);
  const importedSource = result.project.sources.find(row => row.name === 'Source' && row.id !== current.sources[0].id);
  const importedTest = result.project.aiTests.find(row => row.id !== current.aiTests[0].id);
  assert.equal(result.conflicts, 1);
  assert.equal(result.project.company.name, 'Current');
  assert.equal(result.project.sources.length, 2);
  assert.notEqual(importedSource.id, current.sources[0].id);
  assert.equal(importedTest.source, importedSource.id);
  assert.equal(validProject(result.project), true);
});

test("validates a user backup when a newly added draft row has an empty name", () => {
  const value = project('draft', 'Draft');
  value.sources.push({id: 'draft-s2', name: ''});
  assert.equal(validProject(value), true);
  const migrated = migrateProject(value);
  assert.equal(validProject(migrated), true);
});

test('merge remaps cross-register ID collisions and keeps dependent links intact', () => {
  const current = project('current-cross', 'Current');
  const incoming = project('incoming-cross', 'Imported');
  incoming.processes[0].id = current.sources[0].id;
  incoming.documents[0].process = incoming.processes[0].id;
  const result = mergeProjects(current, incoming);
  const importedProcess = result.project.processes.find(row => row.name === 'Process' && row.id !== current.processes[0].id);
  const importedDocument = result.project.documents.find(row => row.id === 'incoming-cross-d1');
  assert.equal(result.conflicts, 1);
  assert.ok(importedProcess);
  assert.equal(importedDocument.process, importedProcess.id);
  assert.equal(validProject(result.project), true);
});

test('deleting a linked record clears references but preserves dependent records', async () => {
  const {deleteRecord} = await import('../src/integrity.ts');
  const value = project('p3', 'C');
  value.owners = [{id: 'owner-1', name: 'Owner'}];
  value.sources[0].owner = 'owner-1';
  value.processes[0].owner = 'owner-1';
  value.documents[0].owner = 'owner-1';
  value.gaps = [{id: 'gap-1', name: 'Gap', owner: 'owner-1', process: value.processes[0].id, document: value.documents[0].id}];
  value.tasks = [{id: 'task-1', name: 'Task', owner: 'owner-1'}];
  const next = deleteRecord(value, 'owners', 'owner-1');
  assert.equal(next.owners.length, 0);
  assert.equal(next.sources[0].owner, '');
  assert.equal(next.processes[0].owner, '');
  assert.equal(next.documents[0].owner, '');
  assert.equal(next.gaps[0].owner, '');
  assert.equal(next.tasks[0].owner, '');
  assert.equal(value.owners.length, 1, 'original project remains unchanged');
  assert.equal(validProject(next), true);
});

test('deleting a process, source or document clears every supported dependent link', async () => {
  const {deleteRecord} = await import('../src/integrity.ts');
  const value = project('delete-links', 'Delete links');
  value.processes = [{id:'process-1', name:'Process'}];
  value.sources = [{id:'source-1', name:'Source', process:'process-1'}];
  value.documents = [{id:'document-1', name:'Document', process:'process-1'}];
  value.gaps = [{id:'gap-1', name:'Gap', process:'process-1', document:'document-1'}];
  value.aiTests = [{id:'test-1', name:'Test', source:'source-1', sourceIds:['source-1'], documentIds:['document-1']}];

  const withoutProcess = deleteRecord(value, 'processes', 'process-1');
  assert.equal(withoutProcess.sources[0].process, '');
  assert.equal(withoutProcess.documents[0].process, '');
  assert.equal(withoutProcess.gaps[0].process, '');
  assert.equal(validProject(withoutProcess), true);

  const withoutSource = deleteRecord(value, 'sources', 'source-1');
  assert.equal(withoutSource.aiTests[0].source, '');
  assert.deepEqual(withoutSource.aiTests[0].sourceIds, []);
  assert.equal(validProject(withoutSource), true);

  const withoutDocument = deleteRecord(value, 'documents', 'document-1');
  assert.equal(withoutDocument.gaps[0].document, '');
  assert.deepEqual(withoutDocument.aiTests[0].documentIds, []);
  assert.equal(validProject(withoutDocument), true);
});

test('legacy migration never silently marks verification as confirmed', () => {
  const old = project('legacy-verify', 'Legacy');
  delete old.verificationConfirmed;
  const migrated = migrateProject(old);
  assert.equal(migrated.verificationConfirmed, false);
});

test('import validation rejects malformed field types and invalid project metadata', () => {
  const value = project('strict-import', 'Strict');
  assert.equal(validProject({...value, company: {...value.company, industry: 42}}), false);
  assert.equal(validProject({...value, scenario: 'shared-cloud'}), false);
  assert.equal(validProject({...value, sources: [{id: 's-bad', name: 'Source', owner: {id: 'x'}}]}), false);
  assert.equal(validProject({...value, changes: [{id: 'c1', at: 'now', message: 17}]}), false);
  assert.equal(validProject({...value, verificationConfirmed: 'yes'}), false);
});

test('merge does not mutate either source project when validation fails', () => {
  const current = project('safe-current', 'Current');
  const incoming = project('safe-incoming', 'Incoming');
  incoming.documents[0].process = 'missing-process';
  const beforeCurrent = structuredClone(current);
  const beforeIncoming = structuredClone(incoming);
  assert.throws(() => mergeProjects(current, incoming));
  assert.deepEqual(current, beforeCurrent);
  assert.deepEqual(incoming, beforeIncoming);
});


test('verification sign-off is invalidated when reviewed evidence changes', async () => {
  const {invalidateVerificationOnScopeChange} = await import('../src/integrity.ts');
  const before = project('verify-scope', 'Scope');
  before.verificationConfirmed = true;
  const after = structuredClone(before);
  after.sources[0].location = 'New location';
  invalidateVerificationOnScopeChange(before, after);
  assert.equal(after.verificationConfirmed, false);
  assert.equal(before.verificationConfirmed, true);
});

test('verification sign-off remains valid for unrelated edits', async () => {
  const {invalidateVerificationOnScopeChange} = await import('../src/integrity.ts');
  const before = project('verify-unrelated', 'Scope');
  before.verificationConfirmed = true;
  const after = structuredClone(before);
  after.tasks.push({id: 'task-new', name: 'Unrelated task'});
  invalidateVerificationOnScopeChange(before, after);
  assert.equal(after.verificationConfirmed, true);
});

test('current-schema backups cannot hide missing collections behind default values', () => {
  const current = {...project('current-schema', 'Current'), schemaVersion: 2};
  delete current.sources;
  assert.equal(validProject(current), false, 'schema V2 must contain every collection');
  const legacy = project('legacy-schema', 'Legacy');
  delete legacy.sources;
  legacy.aiTests = [];
  assert.equal(validProject(legacy), true, 'schema V1 may omit collections that migration knows how to add');
});


test('merging imported evidence invalidates the current verification sign-off', () => {
  const current = project('merge-verified-current', 'Current');
  current.schemaVersion = 2;
  current.verificationConfirmed = true;
  const incoming = project('merge-verified-incoming', 'Incoming');
  incoming.schemaVersion = 2;
  const result = mergeProjects(current, incoming);
  assert.equal(result.project.verificationConfirmed, false);
  assert.equal(current.verificationConfirmed, true, 'merge must not mutate the original');
});

test('import validation bounds total records and individual field sizes', () => {
  const tooMany = project('many', 'Many');
  tooMany.sources = Array.from({length: 5001}, (_, index) => ({id: `s-${index}`, name: 'Source'}));
  assert.equal(validProject(tooMany), false, 'too many rows must be rejected before rendering');

  const tooLargeField = project('large-field', 'Large');
  tooLargeField.sources[0].name = 'x'.repeat(100001);
  assert.equal(validProject(tooLargeField), false, 'oversized individual text fields must be rejected');
});

test('import validation rejects non-text diagnostic values and oversized change logs', () => {
  const badDiagnostic = project('bad-diagnostic', 'Bad');
  badDiagnostic.diagnostic = {storage: {unexpected: 'object'}};
  assert.equal(validProject(badDiagnostic), false);

  const hugeHistory = project('huge-history', 'History');
  hugeHistory.changes = Array.from({length: 1001}, (_, index) => ({id: `c-${index}`, at: '2026-01-01', message: 'Changed'}));
  assert.equal(validProject(hugeHistory), false);
});


test('import validation rejects prototype-sensitive keys anywhere in the object graph', () => {
  const polluted = project('polluted', 'Polluted');
  polluted.diagnostic = JSON.parse('{"__proto__":{"polluted":true}}');
  assert.equal(validProject(polluted), false);
  const nested = project('nested', 'Nested');
  nested.diagnostic = JSON.parse('{"safe":{"constructor":{"prototype":{"polluted":true}}}}');
  assert.equal(validProject(nested), false);
  assert.equal({}.polluted, undefined);
});

test('import validation rejects excessively deep or oversized object graphs without recursion', () => {
  const deep = project('deep', 'Deep');
  let cursor = deep.diagnostic;
  for (let i = 0; i < 70; i++) cursor = cursor.next = {};
  assert.equal(validProject(deep), false);
  const wide = project('wide', 'Wide');
  wide.diagnostic = Object.fromEntries(Array.from({length: 101}, (_, i) => [`k${i}`, 'v']));
  assert.equal(validProject(wide), false);
});
