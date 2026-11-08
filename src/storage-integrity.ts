/** Fail closed when the IndexedDB active-project pointer and stored record disagree. */
export function validateActiveProjectRecord(activeId: unknown, record: unknown): unknown {
  if (typeof activeId !== 'string' || !activeId.trim()) {
    throw new Error('Локальный указатель активного проекта повреждён. Данные не изменены.');
  }
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Активный проект не найден в локальном хранилище. Данные не изменены.');
  }
  if ((record as {id?: unknown}).id !== activeId) {
    throw new Error('Идентификатор проекта не совпадает с указателем локального хранилища. Данные не изменены.');
  }
  return record;
}

/** A missing active pointer is a fresh workspace only when no project records remain. */
export function validateWorkspacePointer(activeId: unknown, projectCount: number): void {
  if (activeId !== undefined && activeId !== null) return;
  if (!Number.isSafeInteger(projectCount) || projectCount < 0) {
    throw new Error('Не удалось проверить локальное хранилище. Данные не изменены.');
  }
  if (projectCount > 0) {
    throw new Error('В локальном хранилище есть проекты, но указатель активного проекта отсутствует. Данные не изменены. Восстановите проект из резервной копии.');
  }
}


/** Return the previous active project ID when a save switches project identity. */
export function previousActiveProjectToDelete(previousId: unknown, nextId: unknown): string | null {
  if (typeof previousId !== 'string' || !previousId.trim()) return null;
  if (typeof nextId !== 'string' || !nextId.trim() || previousId === nextId) return null;
  return previousId;
}
