export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

const unsettled = (): void => {};

export function deferred<T>(): Deferred<T> {
  let settle: (value: T) => void = unsettled;
  let fail: (error: Error) => void = unsettled;
  const promise = new Promise<T>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return { promise, reject: fail, resolve: settle };
}
