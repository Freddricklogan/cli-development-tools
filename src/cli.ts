#!/usr/bin/env node
import { Command } from 'commander';
import { registerApi } from './commands/api.ts';
import { registerGen } from './commands/gen.ts';
import { registerGit } from './commands/git.ts';
import { registerOrganize } from './commands/organize.ts';
import { registerServe } from './commands/serve.ts';

export function buildProgram(): Command {
  const program = new Command();
  program.name('devkit').description('Five development chores in one command: api, serve, git, gen, organize').version('1.0.0');
  registerApi(program);
  registerServe(program);
  registerGit(program);
  registerGen(program);
  registerOrganize(program);
  return program;
}

buildProgram()
  .parseAsync(process.argv)
  .catch((err: unknown) => {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
