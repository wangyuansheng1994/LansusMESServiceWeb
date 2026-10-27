import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function git(repo, args, env, input) {
  return execFileSync('git', args, {
    cwd: repo,
    env,
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

export function captureSourceProvenance(repo, options = {}) {
  const temporaryDirectory = options.indexFile
    ? null
    : fs.mkdtempSync(path.join(os.tmpdir(), 'mes-source-index-'));
  const indexFile = options.indexFile ?? path.join(temporaryDirectory, 'index');
  const env = { ...process.env, GIT_INDEX_FILE: indexFile };
  try {
    let commit;
    try {
      commit = git(repo, ['rev-parse', 'HEAD'], env).toString('utf8').trim();
    } catch {
      return {
        commit: 'unknown',
        displayCommit: 'unknown',
        dirty: false,
        diffHash: createHash('sha256').update('git-unavailable').digest('hex'),
        diffBuffer: Buffer.alloc(0),
        untrackedFiles: [],
      };
    }
    if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`invalid HEAD in ${repo}`);

    git(repo, ['read-tree', 'HEAD'], env);
    const untracked = git(repo, ['ls-files', '--others', '--exclude-standard', '-z'], env);
    git(repo, ['add', '--intent-to-add', '--', '.'], env);
    const diffBuffer = git(repo, ['diff', '--binary', '--full-index', '--no-ext-diff'], env);
    return {
      commit,
      displayCommit: `${commit.slice(0, 12)}${diffBuffer.length ? '+dirty' : ''}`,
      dirty: diffBuffer.length > 0,
      diffHash: createHash('sha256').update(diffBuffer).digest('hex'),
      diffBuffer,
      untrackedFiles: untracked.toString('utf8').split('\0').filter(Boolean),
    };
  } finally {
    if (temporaryDirectory) fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}
