import type { Command } from 'commander';
import { buildSpec, parseAssertion, run } from '../lib/http.ts';

export function registerApi(program: Command): void {
  program
    .command('api')
    .description('Send an HTTP request, time it, and evaluate assertions (exit 1 if any fail)')
    .argument('<url>', 'request URL')
    .option('-X, --method <method>', 'HTTP method', 'GET')
    .option('-H, --header <header...>', 'header as "Name: value" (repeatable)')
    .option('-d, --body <body>', 'request body (JSON is detected)')
    .option('-t, --timeout <ms>', 'timeout in milliseconds', (v) => Number(v), 10000)
    .option('-a, --assert <assertion...>', 'status=200 | header:name=value | json:path=value | body~=text | time<ms')
    .option('--json', 'print the outcome as JSON')
    .action(async (url: string, opts: { method: string; header?: string[]; body?: string; timeout: number; assert?: string[]; json?: boolean }) => {
      const specOpts: Parameters<typeof buildSpec>[1] = { method: opts.method, timeout: opts.timeout };
      if (opts.header) specOpts.header = opts.header;
      if (opts.body !== undefined) specOpts.body = opts.body;
      const spec = buildSpec(url, specOpts);
      const assertions = (opts.assert ?? []).map(parseAssertion);
      const outcome = await run(spec, assertions, (u, init) => fetch(u, init));
      if (opts.json) {
        console.log(JSON.stringify({ request: spec, ...outcome, body: outcome.body.slice(0, 4000) }, null, 2));
      } else {
        console.log(`${spec.method} ${spec.url} → ${outcome.status} ${outcome.statusText} in ${outcome.ms.toFixed(0)} ms`);
        for (const c of outcome.checks) console.log(`  ${c.passed ? 'PASS' : 'FAIL'} ${c.assertion.kind}${c.assertion.key ? ':' + c.assertion.key : ''} expected ${c.assertion.expected}, got ${c.actual}`);
        if (outcome.json !== null) console.log(JSON.stringify(outcome.json, null, 2).slice(0, 2000));
        else console.log(outcome.body.slice(0, 2000));
      }
      process.exitCode = outcome.ok ? 0 : 1;
    });
}
