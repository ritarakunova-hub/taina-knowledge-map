import type {Project} from './model';
import {migrateProject, validProject} from './integrity.ts';

// Keep imported backups bounded to reduce memory exhaustion from accidental or hostile files.
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export function parseProjectImport(text: string): Project {
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) {
    throw new Error('Файл слишком большой. Максимальный размер резервной копии — 5 МБ.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Файл не является корректным JSON.');
  }
  if (!validProject(parsed)) {
    throw new Error('Файл не прошёл проверку структуры или содержит недопустимые связи.');
  }
  return migrateProject(parsed);
}
