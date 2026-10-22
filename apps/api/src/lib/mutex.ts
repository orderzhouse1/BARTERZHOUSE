/**
 * Serializes async operations that share the same key, so that a check-then-write
 * sequence (e.g. compare-and-swap on an in-memory record) cannot be interleaved by
 * a concurrent call for the same key.
 */
export class KeyedMutex {
  private readonly queue = new Map<string, Promise<unknown>>();

  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.queue.get(key) ?? Promise.resolve();
    const result = previous.then(fn, fn);
    this.queue.set(
      key,
      result.catch(() => undefined),
    );
    return result;
  }
}
