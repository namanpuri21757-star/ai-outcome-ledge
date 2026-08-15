/**
 * The Worker itself has no Node API surface, so `types` in tsconfig.json
 * is deliberately just `@cloudflare/workers-types` — adding `@types/node`
 * would let a Node import into `src/` typecheck and then fail at the
 * edge. One test needs to read `wrangler.jsonc` from disk to prove the
 * cron triggers and the job table still agree, so it gets exactly the
 * one function it uses and nothing else.
 */
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
}
