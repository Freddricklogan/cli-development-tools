import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { apply, categoryFor, plan, scan } from '../src/lib/organize.ts';

describe('planner', () => {
  it('categorises by extension with Other as the fallback', () => {
    expect(categoryFor('a.JPG')).toBe('Images');
    expect(categoryFor('b.csv')).toBe('Spreadsheets');
    expect(categoryFor('c.py')).toBe('Code');
    expect(categoryFor('d.xyz')).toBe('Other');
    expect(categoryFor('noext')).toBe('Other');
  });
  it('plans moves, skips hidden files, and groups duplicates without moving the copies', () => {
    const p = plan('/r', [{ name: 'a.png', size: 1, hash: 'h1' }, { name: 'b.png', size: 1, hash: 'h1' }, { name: 'c.txt', size: 2, hash: 'h2' }, { name: '.DS_Store', size: 0, hash: 'h3' }], { dedupe: true });
    expect(p.moves.map((m) => m.to)).toEqual([path.join('/r', 'Images', 'a.png'), path.join('/r', 'Documents', 'c.txt')]);
    expect(p.duplicates).toEqual([{ keep: 'a.png', remove: ['b.png'] }]);
    expect(p.skipped).toEqual(['.DS_Store']);
    const noDedupe = plan('/r', [{ name: 'a.png', size: 1, hash: 'h1' }, { name: 'b.png', size: 1, hash: 'h1' }], { dedupe: false });
    expect(noDedupe.moves).toHaveLength(2);
    expect(noDedupe.duplicates).toEqual([]);
  });
});

describe('scan and apply', () => {
  it('scans files with hashes and applies a plan without overwriting', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'devkit-org-'));
    await fs.writeFile(path.join(root, 'one.txt'), 'same');
    await fs.writeFile(path.join(root, 'two.txt'), 'same');
    await fs.writeFile(path.join(root, 'pic.png'), 'img');
    await fs.mkdir(path.join(root, 'Images'));
    await fs.writeFile(path.join(root, 'Images', 'pic.png'), 'existing');
    await fs.mkdir(path.join(root, 'folder'));
    const entries = await scan(root, true);
    expect(entries.map((e) => e.name)).toEqual(['one.txt', 'pic.png', 'two.txt']);
    expect(entries[0]?.hash).toBe(entries[2]?.hash);
    const p = plan(root, entries, { dedupe: true });
    const r = await apply(root, p);
    expect(r).toEqual({ moved: 1, removed: 1, collisions: [path.join(root, 'pic.png')] });
    expect(await fs.readFile(path.join(root, 'Documents', 'one.txt'), 'utf8')).toBe('same');
    expect(await fs.readFile(path.join(root, 'Images', 'pic.png'), 'utf8')).toBe('existing'); // not overwritten
    await expect(fs.access(path.join(root, 'two.txt'))).rejects.toThrow();
    await fs.rm(root, { recursive: true, force: true });
  });
});
