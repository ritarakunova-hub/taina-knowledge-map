import test from 'node:test';
import assert from 'node:assert/strict';
import {isCurrentSaveRevision} from '../src/save-revision.ts';

test('latest save completion may update the visible save status', () => {
  assert.equal(isCurrentSaveRevision(7, 7), true);
});

test('stale save completion cannot overwrite a newer pending save status', () => {
  assert.equal(isCurrentSaveRevision(6, 7), false);
});

test('invalid revision values are rejected', () => {
  assert.equal(isCurrentSaveRevision(0, 0), false);
  assert.equal(isCurrentSaveRevision(-1, 1), false);
  assert.equal(isCurrentSaveRevision(1.5, 1.5), false);
});
