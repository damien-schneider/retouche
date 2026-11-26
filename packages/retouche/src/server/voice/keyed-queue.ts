export type KeyedQueue = <T>(key: string, task: () => Promise<T>) => Promise<T>;

export function createKeyedQueue(): KeyedQueue {
  const tails = new Map<string, Promise<null>>();
  return async <T>(key: string, task: () => Promise<T>): Promise<T> => {
    const previous = tails.get(key);
    const { promise: done, resolve } = Promise.withResolvers<null>();
    tails.set(key, done);
    try {
      await previous;
      return await task();
    } finally {
      resolve(null);
      if (tails.get(key) === done) {
        tails.delete(key);
      }
    }
  };
}
