import path from 'node:path';
import type { Command } from 'commander';
import { apply, plan, scan } from '../lib/organize.ts';

export function registerOrganize(program: Command): void {
  program
    .command('organize')
    .description('Sort the files in a directory into category folders; dry run by default')
    .argument('[dir]', 'directory', '.')
    .option('--apply', 'actually move files (default is a dry run)', false)
    .option('--dedupe', 'detect byte-identical duplicates by SHA-256 and remove the copies', false)
    .option('--json', 'print the plan as JSON')
    .action(async (dir: string, opts: { apply: boolean; dedupe: boolean; json?: boolean }) => {
      const root = path.resolve(dir);
      const entries = await scan(root, opts.dedupe);
      const p = plan(root, entries, { dedupe: opts.dedupe });
      if (opts.json) console.log(JSON.stringify(p, null, 2));
      else {
        for (const m of p.moves) console.log(`${path.basename(m.from)} → ${m.category}/`);
        for (const d of p.duplicates) console.log(`duplicate of ${d.keep}: ${d.remove.join(', ')}`);
        if (p.skipped.length) console.log(`skipped hidden: ${p.skipped.join(', ')}`);
        console.log(`${p.moves.length} move(s), ${p.duplicates.reduce((n, d) => n + d.remove.length, 0)} duplicate copy(ies)${opts.apply ? '' : ' — dry run; add --apply to execute'}`);
      }
      if (opts.apply) {
        const r = await apply(root, p);
        console.log(`moved ${r.moved}, removed ${r.removed}${r.collisions.length ? `, skipped ${r.collisions.length} (target exists)` : ''}`);
      }
    });
}
