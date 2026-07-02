// Permissive React ambient declarations.
// The project references React APIs but does not install @types/react.
// We keep the surface intentionally loose so downstream code type-checks.

declare module 'react' {
  export type ReactNode = any
  export type ReactElement<P = any, T = any> = any
  export type JSXElementConstructor<P = any> = any
  export type ComponentType<P = any> = any
  export type FC<P = {}> = any
  export type FunctionComponent<P = {}> = any
  export type ComponentClass<P = {}, S = {}> = any
  export class Component<P = {}, S = {}> {
    constructor(props: P)
    props: P
    state: S
    setState(state: any): void
    render(): ReactNode
  }
  export type PropsWithChildren<P = unknown> = P & { children?: any }
  export interface Context<T> {
    Provider: any
    Consumer: any
    displayName?: string
  }

  export const Fragment: any
  export const Suspense: any
  export function createElement(type: any, props?: any, ...children: any[]): any
  export function cloneElement(element: any, props?: any, ...children: any[]): any
  export function createContext<T>(defaultValue: T): Context<T>
  export function forwardRef<T, P = {}>(render: any): any
  export function memo<P = {}>(component: any): any
  export function lazy(factory: any): any

  export function use<T>(value: any): any
  export function useEffect(effect: any, deps?: any[]): void
  export function useState<T>(initial: any): any
  export function useRef<T>(initial: any): any
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps?: any[]): T
  export function useMemo<T>(factory: () => T, deps?: any[]): T
  export function useContext<T>(context: Context<T>): T
  export function useReducer<S, A>(reducer: any, initialState: any): any
  export function useId(): string
  export function useLayoutEffect(effect: any, deps?: any[]): void
  export function useSyncExternalStore<S>(
    subscribe: (callback: () => void) => () => void,
    getSnapshot: () => S,
    getServerSnapshot?: () => S,
  ): S
  export function useEffectEvent<T extends (...args: any[]) => any>(callback: T): T
  export function useActionState<State, Payload>(
    action: any,
    initialState: any,
    permalink?: string,
  ): any
  export function useFormStatus(): any
  export function useOptimistic<T, A>(passthrough: any, reducer?: any): any

  export type Ref<T> = any

  export namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any
    }
  }
}

declare module 'react/compiler-runtime' {
  export function c(cacheSize: number): (slot: number) => any
}
