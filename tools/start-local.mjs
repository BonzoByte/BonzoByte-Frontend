import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, '..');
const angularCli = path.join(
  workspaceRoot,
  'node_modules',
  '@angular',
  'cli',
  'bin',
  'ng.js',
);
const frontendPort = process.env.BONZOBYTE_FRONTEND_PORT || '4200';

const children = [
  spawn(process.execPath, [path.join(scriptDirectory, 'local-archive-server.mjs')], {
    cwd: workspaceRoot,
    env: process.env,
    stdio: 'inherit',
  }),
  spawn(
    process.execPath,
    [
      angularCli,
      'serve',
      '--configuration',
      'development',
      '--port',
      frontendPort,
    ],
    {
      cwd: workspaceRoot,
      env: process.env,
      stdio: 'inherit',
    },
  ),
];

let stopping = false;

function stop(exitCode = 0) {
  if (stopping) {
    return;
  }

  stopping = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => process.exit(exitCode), 1000).unref();
}

for (const child of children) {
  child.on('error', error => {
    console.error('[start-local] Child process failed:', error);
    stop(1);
  });

  child.on('exit', code => {
    if (!stopping) {
      stop(code || 0);
    }
  });
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
