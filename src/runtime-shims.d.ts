declare module 'react' {
  export function useState<T>(initial:T|(()=>T)):[T,(value:T|((old:T)=>T))=>void];
  export function useRef<T>(initial:T):{current:T};
  export function useEffect(effect:()=>void|(()=>void),deps?:unknown[]):void;
  const React:any; export default React;
}
declare module 'react-dom/client' { export function createRoot(node:Element):{render(value:unknown):void}; }
declare module 'react/jsx-runtime' { export const jsx:any; export const jsxs:any; export const Fragment:any; }
declare module '*.css' { const css:string; export default css; }
declare namespace JSX { interface IntrinsicElements {[element:string]:any} }
declare module 'idb' { export function openDB(name:string, version:number, options?:{upgrade?: (db:any)=>void}):Promise<any>; }
declare module 'vite' { export function defineConfig(config:any):any; }
declare module '@vitejs/plugin-react' { const react:()=>any; export default react; }
