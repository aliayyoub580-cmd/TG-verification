const { spawn } = require('node:child_process');
const path = require('node:path');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const services = [
  { name: 'backend', directory: 'backend' },
  { name: 'frontend', directory: 'frontend' },
];
let shuttingDown = false;
let children = [];

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) child.kill();
  }

  setTimeout(() => process.exit(exitCode), 100).unref();
}

children = services.map(({ name, directory }) => {
  const child = spawn(npmCommand, ['run', 'dev'], {
    cwd: path.join(process.cwd(), directory),
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });

  child.on('error', (error) => {
    console.error(`Failed to start ${name}:`, error.message);
    shutdown(1);
  });

  child.on('exit', (code, signal) => {
    if (!shuttingDown && (code !== 0 || signal)) {
      console.error(`${name} stopped unexpectedly.`);
      shutdown(code || 1);
    }
  });

  return child;
});

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
