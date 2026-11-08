/** A completion may update UI state only if it belongs to the latest save revision. */
export function isCurrentSaveRevision(completed: number, current: number): boolean {
  return Number.isSafeInteger(completed) && Number.isSafeInteger(current) && completed > 0 && completed === current;
}
