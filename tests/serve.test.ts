import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listingHtml, mimeFor, resolveRequest, resolveSafe } from '../src/lib/serve.ts';

let root = '';
beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'devkit-serve-'));
  await fs.mkdir(path.join(root, 'sub'));
  await fs.writeFile(path.join(root, 'index.html'), '<h1>hi</h1>');
  await fs.writeFile(path.join(root, 'sub', 'a.txt'), 'a');
  await fs.writeFile(path.join(root, 'app.js'), '1');
});
afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('serve core', () => {
  it('maps MIME types with a safe default', () => {
    expect(mimeFor('x.html')).toMatch(/text\/html/);
    expect(mimeFor('x.JS')).toMatch(/javascript/);
    expect(mimeFor('x.unknown')).toBe('application/octet-stream');
  });
  it('never escapes the root', () => {
    expect(resolveSafe(root, '/../etc/passwd')).toBe(path.resolve(root, 'etc/passwd'));
    expect(resolveSafe(root, '/%2e%2e/%2e%2e/x')).toBe(path.resolve(root, 'x'));
    expect(resolveSafe(root, '/%00')).toBeNull();
    expect(resolveSafe(root, '/%zz')).toBeNull();
    expect(resolveSafe(root, '/sub/a.txt?x=1')).toBe(path.join(root, 'sub', 'a.txt'));
  });
  it('resolves files, index.html, listings, SPA fallback and 404', async () => {
    expect(await resolveRequest(root, '/app.js', false, true)).toEqual({ kind: 'file', file: path.join(root, 'app.js') });
    expect(await resolveRequest(root, '/', false, true)).toEqual({ kind: 'file', file: path.join(root, 'index.html') });
    expect(await resolveRequest(root, '/sub/', false, true)).toEqual({ kind: 'listing', entries: ['a.txt'] });
    expect(await resolveRequest(root, '/sub/', false, false)).toEqual({ kind: 'missing' });
    expect(await resolveRequest(root, '/nope', false, true)).toEqual({ kind: 'missing' });
    expect(await resolveRequest(root, '/nope', true, true)).toEqual({ kind: 'spa', file: path.join(root, 'index.html') });
    expect(await resolveRequest(root, '/%00', true, true)).toEqual({ kind: 'missing' });
    const empty = await fs.mkdtemp(path.join(os.tmpdir(), 'devkit-empty-'));
    expect(await resolveRequest(empty, '/nope', true, true)).toEqual({ kind: 'missing' });
  });
  it('escapes listing HTML', () => {
    const html = listingHtml('/sub', ['a b.txt', '<x>']);
    expect(html).toContain('href="/sub/a%20b.txt"');
    expect(html).toContain('&lt;x&gt;');
    expect(html).not.toContain('<x>');
  });
});
