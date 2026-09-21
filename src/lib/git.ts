/** Git helpers as pure parsers over command output, plus the runner that produces that output. */

export interface BranchInfo {
  name: string;
  current: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
  lastCommit: string; // ISO date
  subject: string;
}

/** Parses `git for-each-ref --format='%(refname:short)|%(HEAD)|%(upstream:short)|%(upstream:track)|%(committerdate:iso-strict)|%(subject)' refs/heads`. */
export function parseBranches(output: string): BranchInfo[] {
  const out: BranchInfo[] = [];
  for (const line of output.split('\n')) {
    if (!line.trim()) continue;
    const [name = '', head = '', upstream = '', track = '', date = '', ...rest] = line.split('|');
    const ahead = /ahead (\d+)/.exec(track);
    const behind = /behind (\d+)/.exec(track);
    out.push({
      name,
      current: head.trim() === '*',
      upstream: upstream || null,
      ahead: ahead ? Number(ahead[1]) : 0,
      behind: behind ? Number(behind[1]) : 0,
      lastCommit: date,
      subject: rest.join('|')
    });
  }
  return out;
}

/** Branches whose last commit is older than `days` relative to `now`, excluding the current branch. */
export function staleBranches(branches: readonly BranchInfo[], days: number, now: Date): BranchInfo[] {
  const cutoff = now.getTime() - days * 86400000;
  return branches.filter((b) => !b.current && Date.parse(b.lastCommit) < cutoff);
}

export const CONVENTIONAL_TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'] as const;

export interface CommitCheck {
  ok: boolean;
  problems: string[];
  type?: string;
  scope?: string;
  breaking: boolean;
}

/** Validates a commit message against the Conventional Commits 1.0 header rules and a subject-length limit. */
export function checkCommitMessage(message: string, maxSubject = 72): CommitCheck {
  const problems: string[] = [];
  const header = message.split('\n')[0] ?? '';
  const m = /^(\w+)(\(([^)]*)\))?(!)?: (.+)$/.exec(header);
  if (!m) {
    problems.push('header must be "type(scope)?: subject"');
    return { ok: false, problems, breaking: false };
  }
  const type = m[1] ?? '';
  const scope = m[3];
  const breaking = m[4] === '!' || /^BREAKING CHANGE:/m.test(message);
  const subject = m[5] ?? '';
  if (!(CONVENTIONAL_TYPES as readonly string[]).includes(type)) problems.push(`type "${type}" is not one of ${CONVENTIONAL_TYPES.join(', ')}`);
  if (scope !== undefined && scope.trim() === '') problems.push('scope must not be empty when parentheses are present');
  if (subject.trim() !== subject) problems.push('subject must not have leading or trailing spaces');
  if (subject.endsWith('.')) problems.push('subject must not end with a period');
  if (header.length > maxSubject) problems.push(`header is ${header.length} characters (limit ${maxSubject})`);
  const lines = message.split('\n');
  if (lines.length > 1 && (lines[1] ?? '') !== '') problems.push('second line must be blank');
  const result: CommitCheck = { ok: problems.length === 0, problems, type, breaking };
  if (scope !== undefined) result.scope = scope;
  return result;
}

/** Parses `git status --porcelain` into counts by state. */
export function parseStatus(output: string): { staged: number; unstaged: number; untracked: number; conflicts: number; files: string[] } {
  let staged = 0;
  let unstaged = 0;
  let untracked = 0;
  let conflicts = 0;
  const files: string[] = [];
  for (const line of output.split('\n')) {
    if (line.length < 3) continue;
    const x = line[0] ?? ' ';
    const y = line[1] ?? ' ';
    const file = line.slice(3);
    files.push(file);
    if (x === '?' && y === '?') untracked += 1;
    else if (x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')) conflicts += 1;
    else {
      if (x !== ' ') staged += 1;
      if (y !== ' ') unstaged += 1;
    }
  }
  return { staged, unstaged, untracked, conflicts, files };
}
