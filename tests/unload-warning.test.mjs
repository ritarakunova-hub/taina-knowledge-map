import test from 'node:test';
import assert from 'node:assert/strict';
import {hasUnsavedChanges} from '../src/unload-warning.ts';

test('pending save warns before leaving the page', () => {
  assert.equal(hasUnsavedChanges('Сохраняю…'), true);
});

test('failed save warns before leaving the page', () => {
  assert.equal(hasUnsavedChanges('Ошибка сохранения — скачайте резервную копию'), true);
});

test('success and idle states do not trigger an unload warning', () => {
  assert.equal(hasUnsavedChanges('Сохранено локально'), false);
  assert.equal(hasUnsavedChanges('Готово'), false);
});
