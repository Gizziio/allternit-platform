// TODO(types): TEMPORARY SHIM — this module was stubbed in burn batch b0001
// but still exports DeepImmutable for artifact files that import it here
// (recovered from the root-commit src/types/utils.ts; function types are
// preserved because WorkspaceTab and others call DeepImmutable-wrapped fns).
export type DeepImmutable<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepImmutable<T[K]> }
    : T

export function utils_ts(): void {
  // Not yet implemented
}

export default utils_ts
