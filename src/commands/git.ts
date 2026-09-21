import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { promisify } from 'node:util';
import type { Command } from 'commander';
import { checkCommitMessage, parseBranches, parseStatus, staleBranches } from '../lib/git.ts';

const execFileAsync = promisify(execFile);

async function git(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { maxBuffer: 1 << 24 });
  return stdout;
}

const FORMAT = '%(refname:short)|%(HEAD)|%(upstream:short)|%(upstream:track)|%(committerdate:iso-strict)|%(subject)';

export function registerGit(program: Command): void {
  const g = program.command('git').description('Branch summaries, stale-branch listing and commit-message checks');
  g.command('branches')
    .description('List local branches with upstream, ahead/behind and last commit')
    .option('--json', 'print JSON')
    .action(async (opts: { json?: boolean }) => {
      const branches = parseBranches(await git(['for-each-ref', `--format=${FORMAT}`, 'refs/heads']));
      if (opts.json) console.log(JSON.stringify(branches, null, 2));
      else for (const b of branches) console.log(`${b.current ? '*' : ' '} ${b.name.padEnd(30)} ${b.upstream ?? '(no upstream)'} +${b.ahead}/-${b.behind}  ${b.lastCommit.slice(0, 10)}  ${b.subject}`);
    });
  g.command('stale')
    .description('List branches with no commit in the last N days')
    .option('-d, --days <days>', 'age threshold', (v) => Number(v), 30)
    .option('--json', 'print JSON')
    .action(async (opts: { days: number; json?: boolean }) => {
      const stale = staleBranches(parseBranches(await git(['for-each-ref', `--format=${FORMAT}`, 'refs/heads'])), opts.days, new Date());
      if (opts.json) console.log(JSON.stringify(stale, null, 2));
      else if (stale.length === 0) console.log(`no branches older than ${opts.days} days`);
      else for (const b of stale) console.log(`${b.name.padEnd(30)} last commit ${b.lastCommit.slice(0, 10)}`);
    });
  g.command('status')
    .description('Counts of staged, unstaged, untracked and conflicted files')
    .option('--json', 'print JSON')
    .action(async (opts: { json?: boolean }) => {
      const s = parseStatus(await git(['status', '--porcelain']));
      if (opts.json) console.log(JSON.stringify(s, null, 2));
      else console.log(`staged ${s.staged} · unstaged ${s.unstaged} · untracked ${s.untracked} · conflicts ${s.conflicts}`);
    });
  g.command('check-commit')
    .description('Validate a commit message against Conventional Commits (reads a file, or the last commit)')
    .argument('[file]', 'path to a message file (for a commit-msg hook)')
    .option('--max <chars>', 'header length limit', (v) => Number(v), 72)
    .action(async (file: string | undefined, opts: { max: number }) => {
      const message = file ? await fs.readFile(file, 'utf8') : await git(['log', '-1', '--pretty=%B']);
      const r = checkCommitMessage(message, opts.max);
      if (r.ok) console.log(`ok: ${r.type ?? ''}${r.scope ? `(${r.scope})` : ''}${r.breaking ? ' [breaking]' : ''}`);
      else {
        for (const p of r.problems) console.error(`problem: ${p}`);
        process.exitCode = 1;
      }
    });
}
