import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { beforeAll, describe, expect, it } from 'vitest';

const run = promisify(execFile);
const BIN = path.resolve('dist/cli.js');

beforeAll(async () => {
  await run('npm', ['run', 'build', '--silent']);
}, 120000);

describe('built binary', () => {
  it('prints help and version', async () => {
    const { stdout } = await run('node', [BIN, '--help']);
    for (const c of ['api', 'serve', 'git', 'gen', 'organize']) expect(stdout).toContain(c);
    expect((await run('node', [BIN, '--version'])).stdout.trim()).toBe('1.0.0');
  });
  it('gen scaffolds a project and organize plans a dry run', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'devkit-e2e-'));
    const { stdout } = await run('node', [BIN, 'gen', 'node-lib', 'sample-lib', '--out', dir]);
    expect(stdout).toContain('created');
    const pkg = JSON.parse(await fs.readFile(path.join(dir, 'sample-lib', 'package.json'), 'utf8')) as { name: string };
    expect(pkg.name).toBe('sample-lib');
    await fs.writeFile(path.join(dir, 'photo.png'), 'x');
    const { stdout: plan } = await run('node', [BIN, 'organize', dir, '--json']);
    const planned = JSON.parse(plan) as { moves: { category: string }[] };
    expect(planned.moves[0]?.category).toBe('Images');
    await expect(run('node', [BIN, 'gen', 'nope', 'x', '--out', dir])).rejects.toMatchObject({ code: 1 });
    await fs.rm(dir, { recursive: true, force: true });
  });
  it('checks a commit message from a file with exit codes', async () => {
    const f = path.join(os.tmpdir(), `devkit-msg-${String(process.pid)}.txt`);
    await fs.writeFile(f, 'feat(cli): add e2e test\n');
    expect((await run('node', [BIN, 'git', 'check-commit', f])).stdout).toContain('ok: feat(cli)');
    await fs.writeFile(f, 'bad message\n');
    await expect(run('node', [BIN, 'git', 'check-commit', f])).rejects.toMatchObject({ code: 1 });
  });
  it('serves a directory with SPA fallback and safe paths', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'devkit-srv-'));
    await fs.writeFile(path.join(dir, 'index.html'), '<h1>app</h1>');
    const { createServer } = await import('../src/commands/serve.ts');
    const server = createServer(dir, { spa: true, listings: true, cors: true });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const base = `http://127.0.0.1:${String(port)}`;
    const a = await fetch(`${base}/`);
    expect(a.status).toBe(200);
    expect(a.headers.get('content-type')).toMatch(/text\/html/);
    expect(a.headers.get('access-control-allow-origin')).toBe('*');
    expect(await (await fetch(`${base}/deep/route`)).text()).toContain('app');
    // Traversal is clipped to the root; in SPA mode an unknown path serves index.html, never a file outside.
    const trav = await fetch(`${base}/..%2f..%2fetc/passwd`);
    expect(trav.status).toBe(200);
    expect(await trav.text()).toContain('app');
    expect((await fetch(`${base}/%00`)).status).toBe(404);
    server.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
});
