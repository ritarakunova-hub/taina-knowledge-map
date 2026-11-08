/** Warn before leaving while a debounced save is pending or the last save failed. */
export function hasUnsavedChanges(saveState: string): boolean {
  return saveState === 'Сохраняю…' || saveState.startsWith('Ошибка сохранения');
}
