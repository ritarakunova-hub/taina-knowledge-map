/** Acquire the single-writer lock for this browser profile.
 * A null result means another tab already owns the project.
 * The returned release function must be called when the app unmounts.
 */
export function acquireProjectWriterLock(
  locks: Pick<LockManager, 'request'>,
): Promise<(() => void) | null> {
  return new Promise((resolve, reject) => {
    void locks.request(
      'taina-knowledge-map-writer',
      { ifAvailable: true, mode: 'exclusive' },
      async lock => {
        if (!lock) {
          resolve(null);
          return;
        }
        let release!: () => void;
        const held = new Promise<void>(done => { release = done; });
        resolve(release);
        await held;
      },
    ).catch(reject);
  });
}
