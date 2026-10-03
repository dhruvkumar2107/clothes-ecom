import { cp, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const standalone = path.join(root, '.next', 'standalone');

await mkdir(path.join(standalone, '.next'), { recursive: true });
await cp(path.join(root, 'public'), path.join(standalone, 'public'), { recursive: true });
await cp(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'), {
  recursive: true,
});

const server = spawn(process.execPath, [path.join(standalone, 'server.js')], {
  cwd: standalone,
  env: process.env,
  stdio: 'inherit',
});

server.on('error', (error) => {
  console.error('Failed to start the standalone server:', error);
  process.exitCode = 1;
});
server.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
