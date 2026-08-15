/**
 * `types` in tsconfig.json is deliberately just `vite/client` — adding
 * `@types/node` would let a Node import into `src/` typecheck and then
 * fail in the browser. Two tests read the source tree from disk to
 * enforce architectural rules that no unit test can, so they get exactly
 * the functions they use and nothing else.
 */
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function readdirSync(path: string): string[];
  export function statSync(path: string): { isDirectory(): boolean };
}

declare module 'node:path' {
  export function join(...parts: string[]): string;
}
