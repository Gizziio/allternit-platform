/**
 * Utility types
 * TEMPORARY SHIM
 */

export type DeepImmutable<T> = {
  readonly [K in keyof T]: DeepImmutable<T[K]>
}

export type Nullable<T> = T | null | undefined

export type DeepReadonly<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>
}

export type ValueOf<T> = T[keyof T]

// Permutations of union types
export type Permutations<T extends string, U extends string = T> = 
  T extends any ? (U extends T ? never : U) | `${T}_${Permutations<Exclude<U, T>>}` : never
