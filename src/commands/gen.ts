import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Command } from 'commander';
import { renderTemplate, validateName, writeRendered } from '../lib/generate.ts';

export const TEMPLATES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates');

export function registerGen(program: Command): void {
  program
    .command('gen')
    .description('Scaffold a project from a template (node-lib, python-pkg, static-site)')
    .argument('<template>', 'template name')
    .argument('<name>', 'project name (lowercase, dashes)')
    .option('-o, --out <dir>', 'parent directory', '.')
    .option('--description <text>', 'one-line description', 'A new project')
    .option('--author <name>', 'author', 'Freddrick Logan')
    .option('--list', 'list templates and exit')
    .action(async (template: string, name: string, opts: { out: string; description: string; author: string; list?: boolean }) => {
      const available = (await fs.readdir(TEMPLATES_DIR)).sort();
      if (opts.list) {
        console.log(available.join('\n'));
        return;
      }
      if (!available.includes(template)) throw new Error(`unknown template "${template}"; available: ${available.join(', ')}`);
      const problems = validateName(name);
      if (problems.length) throw new Error(problems.join('; '));
      const vars = { name, name_snake: name.replace(/-/g, '_'), description: opts.description, author: opts.author };
      const rendered = await renderTemplate(path.join(TEMPLATES_DIR, template), vars);
      const target = path.resolve(opts.out, name);
      const written = await writeRendered(target, rendered);
      console.log(`created ${target} with ${written.length} files:`);
      for (const f of written) console.log(`  ${f}`);
    });
}
