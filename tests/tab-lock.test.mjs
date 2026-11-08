import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireProjectWriterLock } from '../src/tab-lock.ts';

test('writer lock reports busy when another tab owns the lock', async () => {
  const locks = { request: async (_name, _options, callback) => callback(null) };
  assert.equal(await acquireProjectWriterLock(locks), null);
});

test('writer lock remains held until the app releases it', async () => {
  let callbackFinished = false;
  const locks = { request: async (_name, _options, callback) => {
    await callback({ name: 'taina-knowledge-map-writer' });
    callbackFinished = true;
  }};
  const release = await acquireProjectWriterLock(locks);
  assert.equal(typeof release, 'function');
  assert.equal(callbackFinished, false);
  release();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(callbackFinished, true);
});
