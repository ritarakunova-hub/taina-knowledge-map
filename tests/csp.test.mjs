import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('production CSP does not permit inline styles and JSX does not require them', async () => {
  const config = await readFile(new URL('../vite.config.ts', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(config, /style-src 'self'/);
  assert.doesNotMatch(config, /style-src[^\"']*unsafe-inline/);
  assert.doesNotMatch(app, /style\s*=\s*\{\{/);
  assert.match(app, /<progress max=\{7\} value=\{journeyDone\}/);
  assert.match(css, /\.journey-track progress\{/);
});
