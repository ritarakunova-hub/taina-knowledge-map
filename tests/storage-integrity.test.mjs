import test from 'node:test';
import assert from 'node:assert/strict';
import {validateActiveProjectRecord, validateWorkspacePointer, previousActiveProjectToDelete} from '../src/storage-integrity.ts';

test('active project record is accepted only when its ID matches the pointer', () => {
  const record = {id: 'project-1', schemaVersion: 2};
  assert.equal(validateActiveProjectRecord('project-1', record), record);
});

test('a dangling active pointer fails closed instead of opening a fresh project', () => {
  assert.throws(() => validateActiveProjectRecord('project-1', undefined), /не найден/);
});

test('a mismatched active pointer fails closed', () => {
  assert.throws(() => validateActiveProjectRecord('project-1', {id: 'project-2'}), /не совпадает/);
});

test('a malformed active pointer fails closed', () => {
  assert.throws(() => validateActiveProjectRecord({id: 'project-1'}, {id: 'project-1'}), /указатель/);
});

test('an empty workspace without an active pointer is a valid first launch', () => {
  assert.doesNotThrow(() => validateWorkspacePointer(undefined, 0));
  assert.doesNotThrow(() => validateWorkspacePointer(null, 0));
});

test('orphaned project records without an active pointer fail closed', () => {
  assert.throws(() => validateWorkspacePointer(undefined, 1), /указатель активного проекта отсутствует/);
  assert.throws(() => validateWorkspacePointer(null, 3), /указатель активного проекта отсутствует/);
});

test('invalid project count fails closed', () => {
  assert.throws(() => validateWorkspacePointer(undefined, -1), /Не удалось проверить/);
  assert.throws(() => validateWorkspacePointer(undefined, 1.5), /Не удалось проверить/);
});


test('saving the same project ID preserves its active record', () => {
  assert.equal(previousActiveProjectToDelete('project-1', 'project-1'), null);
});

test('replacing a project removes only the previous active project record', () => {
  assert.equal(previousActiveProjectToDelete('project-old', 'project-new'), 'project-old');
});

test('missing or malformed previous pointers never select a record for deletion', () => {
  assert.equal(previousActiveProjectToDelete(undefined, 'project-new'), null);
  assert.equal(previousActiveProjectToDelete({id: 'project-old'}, 'project-new'), null);
  assert.equal(previousActiveProjectToDelete(' ', 'project-new'), null);
});
