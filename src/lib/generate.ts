/** Project generator: renders a template directory (files with {{name}} placeholders) into a target. */

import { promises as fs } from 'node:fs';
import path from 'node:path';

export const NAME_RULE = /^[a-z][a-z0-9-]{0,63}$/;

export function validateName(name: string): string[] {
  const p: string[] = [];
  if (!NAME_RULE.test(name)) p.push('name must be lowercase letters, digits and dashes, starting with a letter (max 64)');
  return p;
}

export function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => vars[key] ?? whole);
}

export interface Rendered {
  files: { path: string; content: string }[];
}

/** Reads every file under `templateDir` and renders it with `vars`; paths may contain placeholders too. */
export async function renderTemplate(templateDir: string, vars: Record<string, string>): Promise<Rendered> {
  const files: Rendered['files'] = [];
  async function walk(dir: string, rel: string): Promise<void> {
    for (const entry of (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const abs = path.join(dir, entry.name);
      const relPath = path.posix.join(rel, entry.name.replace(/^_dot_/, '.'));
      if (entry.isDirectory()) await walk(abs, relPath);
      else files.push({ path: render(relPath, vars), content: render(await fs.readFile(abs, 'utf8'), vars) });
    }
  }
  await walk(templateDir, '');
  if (files.length === 0) throw new Error(`template ${templateDir} is empty`);
  return { files };
}

/** Writes rendered files into `target`, refusing to overwrite anything that exists. */
export async function writeRendered(target: string, rendered: Rendered): Promise<string[]> {
  const written: string[] = [];
  for (const f of rendered.files) {
    const abs = path.join(target, f.path);
    try {
      await fs.access(abs);
      throw new Error(`refusing to overwrite ${abs}`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, f.content, 'utf8');
    written.push(f.path);
  }
  return written;
}
