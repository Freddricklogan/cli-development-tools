import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, renderTemplate, validateName, writeRendered } from '../src/lib/generate.ts';

const TEMPLATES = path.resolve('templates');

describe('generator', () => {
  it('validates names and renders placeholders, leaving unknown ones intact', () => {
    expect(validateName('my-lib')).toEqual([]);
    expect(validateName('My Lib')).toHaveLength(1);
    expect(validateName('9x')).toHaveLength(1);
    expect(render('{{a}} and {{b}}', { a: '1' })).toBe('1 and {{b}}');
  });
  it('renders each shipped template with dotfiles and path placeholders', async () => {
    for (const t of ['node-lib', 'python-pkg', 'static-site']) {
      const r = await renderTemplate(path.join(TEMPLATES, t), { name: 'demo-kit', name_snake: 'demo_kit', description: 'D', author: 'A' });
      expect(r.files.length).toBeGreaterThan(2);
      expect(r.files.every((f) => !f.content.includes('{{name}}'))).toBe(true);
    }
    const py = await renderTemplate(path.join(TEMPLATES, 'python-pkg'), { name: 'demo-kit', name_snake: 'demo_kit', description: 'D', author: 'A' });
    expect(py.files.map((f) => f.path)).toContain('src/demo_kit/__init__.py');
    expect(py.files.map((f) => f.path)).toContain('.gitignore');
    const empty = await fs.mkdtemp(path.join(os.tmpdir(), 'devkit-empty-'));
    await expect(renderTemplate(empty, {})).rejects.toThrow(/empty/);
  });
  it('writes files and refuses to overwrite', async () => {
    const target = await fs.mkdtemp(path.join(os.tmpdir(), 'devkit-gen-'));
    const r = await renderTemplate(path.join(TEMPLATES, 'static-site'), { name: 'site', name_snake: 'site', description: 'D', author: 'A' });
    const written = await writeRendered(target, r);
    expect(written).toEqual(['README.md', 'index.html', 'main.js', 'style.css']);
    expect(await fs.readFile(path.join(target, 'index.html'), 'utf8')).toContain('<title>site</title>');
    await expect(writeRendered(target, r)).rejects.toThrow(/refusing to overwrite/);
    await fs.rm(target, { recursive: true, force: true });
  });
});
