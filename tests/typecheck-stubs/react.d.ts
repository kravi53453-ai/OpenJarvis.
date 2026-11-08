declare module 'react' {
  export type ReactNode = any; export type ChangeEvent<T = any> = { target: T & { value: string; checked: boolean; files: FileList | null } };
  export type KeyboardEvent<T = any> = { key: string; shiftKey: boolean; preventDefault(): void; target: T };
  export const useState: <T>(v: T | (() => T)) => [T, (v: T | ((p: T) => T)) => void];
  export const useEffect: (f: () => void | (() => void), d?: any[]) => void;
  export const useCallback: <T>(f: T, d: any[]) => T; export function useRef<T>(v: T): { current: T }; export function useRef<T>(v: null): { current: T | null }; export const lazy: (f: () => Promise<any>) => any; export const Suspense: any;
}
declare module 'react/jsx-runtime' { export const jsx: any, jsxs: any, Fragment: any }
declare module 'react-dom/client' { export const createRoot: any }
declare namespace JSX { interface IntrinsicElements { [k: string]: any } interface IntrinsicAttributes { key?: any } }
