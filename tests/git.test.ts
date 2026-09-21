import { describe, expect, it } from 'vitest';
import { checkCommitMessage, parseBranches, parseStatus, staleBranches } from '../src/lib/git.ts';

describe('branches', () => {
  const out = ['main|*|origin/main|[ahead 2, behind 1]|2026-09-20T10:00:00+00:00|feat: thing', 'old-idea||||2026-01-01T00:00:00+00:00|wip|with pipe', ''].join('\n');
  it('parses for-each-ref output', () => {
    const b = parseBranches(out);
    expect(b).toHaveLength(2);
    expect(b[0]).toMatchObject({ name: 'main', current: true, upstream: 'origin/main', ahead: 2, behind: 1, subject: 'feat: thing' });
    expect(b[1]).toMatchObject({ name: 'old-idea', current: false, upstream: null, ahead: 0, behind: 0, subject: 'wip|with pipe' });
  });
  it('finds stale branches excluding the current one', () => {
    const b = parseBranches(out);
    expect(staleBranches(b, 30, new Date('2026-09-21T00:00:00Z')).map((x) => x.name)).toEqual(['old-idea']);
    expect(staleBranches(b, 400, new Date('2026-09-21T00:00:00Z'))).toEqual([]);
  });
});

describe('commit messages', () => {
  it('accepts conventional headers and reports scope and breaking changes', () => {
    expect(checkCommitMessage('feat(api): add batch endpoint')).toMatchObject({ ok: true, type: 'feat', scope: 'api', breaking: false });
    expect(checkCommitMessage('fix!: drop legacy flag\n\nBREAKING CHANGE: flag removed').breaking).toBe(true);
    expect(checkCommitMessage('chore: bump deps').ok).toBe(true);
  });
  it('names each problem', () => {
    expect(checkCommitMessage('added stuff').problems).toEqual(['header must be "type(scope)?: subject"']);
    const r = checkCommitMessage('feature(): Fix it.\nno blank line');
    expect(r.ok).toBe(false);
    expect(r.problems).toEqual(expect.arrayContaining([expect.stringMatching(/type "feature"/), 'scope must not be empty when parentheses are present', 'subject must not end with a period', 'second line must be blank']));
    expect(checkCommitMessage(`feat: ${'x'.repeat(80)}`).problems[0]).toMatch(/limit 72/);
    expect(checkCommitMessage('feat: ok', 5).problems[0]).toMatch(/limit 5/);
  });
});

describe('status', () => {
  it('counts porcelain states', () => {
    const s = parseStatus(['M  staged.js', ' M unstaged.js', 'MM both.js', '?? new.txt', 'UU conflict.c', 'AA added-both.c', ''].join('\n'));
    expect(s).toMatchObject({ staged: 2, unstaged: 2, untracked: 1, conflicts: 2 });
    expect(s.files).toHaveLength(6);
    expect(parseStatus('')).toMatchObject({ staged: 0, files: [] });
  });
});
