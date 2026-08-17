// Local type shims for the already-installed React runtime.
// @types/react / @types/react-dom are NOT installed in this node_modules
// layout, and we keep dependency changes at zero. These shims provide just
// enough typing to type-check .tsx. The `paths` mapping in tsconfig.json
// redirects the specifiers below to THIS file so TypeScript treats it as the
// canonical declaration (not an augmentation of the untyped JS package).
// Vite still bundles the real react runtime at build time.

declare module 'react' {
  export type FC<P = {}> = (props: P) => any;
  export type ReactNode = any;
  export type CSSProperties = Record<string, any>;
  export interface FormEvent<T = Element> { preventDefault(): void; currentTarget: any; }
  export interface ChangeEvent<T = Element> { currentTarget: any; target: any; }
  export interface MouseEvent<T = Element> { currentTarget: any; preventDefault(): void; }
  export type Dispatch<A> = (value: A | ((prev: A) => A)) => void;
  export function useState<S>(initial: S | (() => S)): [S, Dispatch<S>];
  export function useState<S = undefined>(): [S | undefined, Dispatch<S | undefined>];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useMemo<T>(factory: () => T, deps?: any[]): T;
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps?: any[]): T;
  export function useRef<T>(initial: T): { current: T };
  const React: {
    StrictMode: any;
    createElement: any;
    Fragment: any;
    useState: typeof useState;
    useEffect: typeof useEffect;
    useMemo: typeof useMemo;
    useCallback: typeof useCallback;
    useRef: typeof useRef;
  };
  export default React;
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare module 'react-dom/client' {
  export function createRoot(el: any): { render(node: any): void; unmount(): void };
}

declare module 'react-router-dom' {
  export function useNavigate(): (path: string) => void;
  export function BrowserRouter(props: { children: any }): any;
  export function Routes(props: { children: any }): any;
  export function Route(props: any): any;
}

// The new JSX transform (jsx: "react-jsx") resolves intrinsic elements via the
// global JSX namespace. Provide it so .tsx compiles without @types/react.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
    interface Element {}
  }
}

export {};
