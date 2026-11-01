import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

import * as prettier from 'prettier';

function git(...args) {
  return execFileSync('git', ['--no-optional-locks', ...args], { encoding: 'utf8' });
}

// PRs use the base SHA, pushes the previous SHA; manual runs check the last commit.
const suppliedBase = process.env.FORMAT_BASE;
if (suppliedBase && !/^[a-f\d]{40}$/i.test(suppliedBase)) {
  throw new Error('FORMAT_BASE must be a full Git commit SHA.');
}
const base =
  suppliedBase && !/^0+$/.test(suppliedBase) ? suppliedBase : git('rev-parse', 'HEAD^').trim();

// Include local changes so engineers can run the same gate before committing.
const candidates = new Set(
  [
    git('diff', '--name-only', '--diff-filter=ACMR', '-z', base, 'HEAD'),
    git('diff', '--name-only', '--diff-filter=ACMR', '-z', 'HEAD'),
    git('ls-files', '--others', '--exclude-standard', '-z'),
  ].flatMap((output) => output.split('\0').filter(Boolean)),
);

let checked = 0;
let failed = 0;
for (const file of [...candidates].sort()) {
  const info = await prettier.getFileInfo(file, { ignorePath: '.prettierignore' });
  if (info.ignored || !info.inferredParser) continue;
  const options = await prettier.resolveConfig(file);
  const formatted = await prettier.check(await readFile(file, 'utf8'), {
    ...options,
    filepath: file,
  });
  checked++;
  if (!formatted) {
    failed++;
    console.error(`Formatting required: ${file}`);
  }
}

console.log(`Checked ${checked} changed supported files; ${failed} formatting failures.`);
process.exitCode = failed ? 1 : 0;
