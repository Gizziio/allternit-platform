export declare const Binary: {
  search<T, K>(
    arr: T[],
    target: K,
    keyFn: (item: T) => K,
  ): { index: number; found: boolean }
}
