// React 19 (Canary) type declarations - extending existing React 18 types
// This adds support for React 19 features like `use()` hook and Server Components

import 'react';

declare module 'react' {
  // React 19 - use hook for unwrapping promises and contexts
  export function use<T>(promise: Promise<T>): T;
  export function use<T>(context: React.Context<T>): T;

  // React 19 - useEffectEvent (experimental)
  export function useEffectEvent<T extends (...args: any[]) => any>(callback: T): T;

  // React 19 - useActionState
  export function useActionState<State, Payload>(
    action: (state: Awaited<State>, payload: Payload) => State | Promise<State>,
    initialState: Awaited<State>,
    permalink?: string
  ): [state: Awaited<State>, dispatch: (payload: Payload) => void, isPending: boolean];

  // React 19 - useFormStatus
  export function useFormStatus(): {
    pending: boolean;
    data: FormData | null;
    method: string | null;
    action: ((formData: FormData) => void) | null;
  };

  // React 19 - useOptimistic
  export function useOptimistic<T, A>(
    passthrough: T,
    reducer?: (state: T, action: A) => T
  ): [T, (action: A) => void];
}

// Support for react/compiler-runtime
declare module 'react/compiler-runtime' {
  export function c(cacheSize: number): (slot: number) => any;
}
